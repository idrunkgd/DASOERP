import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";

/**
 * Compteurs affichés en badge dans la sidebar. On renvoie UNIQUEMENT ce
 * qui demande une action de l'user (docs à signer, tâches à faire, dossiers
 * à traiter, factures en attente…). Pas des totaux : sinon ça devient du bruit.
 *
 * Chaque compteur est calculé en parallèle + protégé individuellement — si
 * une requête échoue (schéma pas à jour, modèle absent…), le badge tombe à 0
 * plutôt que de crasher toute la sidebar.
 */
export const dynamic = "force-dynamic";

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try { return await fn(); } catch { return 0; }
}

export async function GET() {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({});

  const userId = session.user.id;
  const perms = await getUserEffectivePermissions(userId, session.user.role);
  const has = (p: string) => perms.includes(p as any);

  // Bornes du jour + de la semaine ISO (lundi 00:00 → dimanche 23:59)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(startOfDay);
  const dow = (weekStart.getDay() + 6) % 7; // 0 = lundi
  weekStart.setDate(weekStart.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    policies,
    tasks,
    missionRequests,
    offers,
    contracts,
    timesheetMissing,
    leavesToApprove,
    myLeavesPending,
    onboarding,
    testsToGrade,
    invoicesUnpaid
  ] = await Promise.all([
    // /policies — docs assignés en attente pour moi
    safeCount(() =>
      prisma.documentSignature.count({ where: { userId, status: "PENDING" } })
    ),

    // /commercial — tâches assignées à moi non terminées
    has("contacts.read")
      ? safeCount(() =>
          prisma.contactInteraction.count({
            where: { assigneeId: userId, completedAt: null }
          })
        )
      : 0,

    // /mission-requests — demandes non terminales
    has("consulting.read")
      ? safeCount(() =>
          prisma.missionRequest.count({
            where: { status: { in: ["NEW", "QUALIFYING", "PRESENTING"] } }
          })
        )
      : 0,

    // /offers — offres envoyées / en négo (en attente de réponse client)
    has("offers.read")
      ? safeCount(() =>
          prisma.offer.count({
            where: { status: { in: ["SENT", "NEGOTIATION"] } }
          })
        )
      : 0,

    // /contracts — brouillons à finaliser
    has("contracts.read")
      ? safeCount(() =>
          prisma.contract.count({ where: { status: "DRAFT" } })
        )
      : 0,

    // /timesheet — semaine courante pas remplie ET user actuellement sur une
    // mission active (PLANNED/ACTIVE/EXTENDED). Un user sans mission n'a pas
    // à remplir de timesheet → pas de badge parasite.
    has("timesheet.self.write")
      ? safeCount(async () => {
          const hasActiveMission = await prisma.mission.count({
            where: {
              consultantId: userId,
              status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] }
            }
          });
          if (hasActiveMission === 0) return 0;
          const count = await prisma.timesheetEntry.count({
            where: { userId, date: { gte: weekStart, lt: weekEnd } }
          });
          return count === 0 ? 1 : 0;
        })
      : 0,

    // /leaves — pour manager : demandes SUBMITTED à approuver
    has("leaves.approve")
      ? safeCount(() =>
          prisma.leaveRequest.count({ where: { status: "SUBMITTED" } })
        )
      : 0,

    // /leaves — pour l'user : mes demandes en attente
    !has("leaves.approve") && has("leaves.read")
      ? safeCount(() =>
          prisma.leaveRequest.count({
            where: { userId, status: "SUBMITTED" }
          })
        )
      : 0,

    // /onboarding — parcours IN_PROGRESS dont je suis createdBy
    has("onboarding.read")
      ? safeCount(() =>
          prisma.onboarding.count({
            where: { status: "IN_PROGRESS", createdById: userId }
          })
        )
      : 0,

    // /tests — soumissions terminées mais pas encore validées (à corriger)
    has("tests.manage")
      ? safeCount(() =>
          prisma.testAssignment.count({
            where: {
              status: "COMPLETED",
              submission: { is: { completedAt: { not: null } } }
            }
          })
        )
      : 0,

    // /finance — milestones INVOICED non payés (factures en attente)
    has("finance.read")
      ? safeCount(() =>
          prisma.billingMilestone.count({
            where: { status: "INVOICED", paidAt: null }
          })
        )
      : 0
  ]);

  // Fusion des deux sources /leaves (manager OU user, jamais les deux)
  const leaves = leavesToApprove + myLeavesPending;

  return NextResponse.json({
    "/policies": policies,
    "/commercial": tasks,
    "/mission-requests": missionRequests,
    "/offers": offers,
    "/contracts": contracts,
    "/timesheet": timesheetMissing,
    "/leaves": leaves,
    "/onboarding": onboarding,
    "/tests": testsToGrade,
    "/finance": invoicesUnpaid
  });
}
