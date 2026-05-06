"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  subjectId: z.string().min(1),
  scheduledAt: z.string().min(1).transform(v => new Date(v)),
  kind: z.enum(["ONBOARDING","CHECK_IN","ANNUAL_REVIEW","END_OF_MISSION","PERFORMANCE","CAREER","OFFBOARDING","OTHER_REVIEW"]).default("CHECK_IN"),
  projectId: z.string().optional().nullable().transform(v => v || null),
  feedback: z.string().optional().nullable(),
  privateNotes: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  outcome: z.enum(["SCHEDULED","COMPLETED","CANCELLED","RESCHEDULED"]).default("SCHEDULED")
});

/**
 * Permissions :
 * - users.manage (Admin) : peut créer/modifier/voir tout
 * - timesheet.validate (Manager) : peut créer/modifier/voir les reviews des consultants
 * - le consultant lui-même peut voir SES reviews mais pas les privateNotes
 */
async function requireReviewWrite() {
  const session = await requireSession();
  const sp = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!sp.includes("users.manage") && !sp.includes("timesheet.validate")) {
    throw new Error("Forbidden: seul un utilisateur ayant 'users.manage' ou 'timesheet.validate' peut gérer les entretiens internes.");
  }
  return session;
}

export async function createReview(formData: FormData) {
  const session = await requireReviewWrite();
  const data = Schema.parse(Object.fromEntries(formData));
  const r = await prisma.consultantReview.create({ data: { ...data, conductedById: session.user.id } });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "ConsultantReview", entityId: r.id,
    message: `Entretien interne ${r.kind} planifié`, after: r
  });
  revalidatePath(`/users/${data.subjectId}`);
  revalidatePath("/reviews");
}

export async function updateReview(id: string, formData: FormData) {
  const session = await requireReviewWrite();
  const before = await prisma.consultantReview.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.consultantReview.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ConsultantReview", entityId: id,
    message: `Entretien interne mis à jour`, before, after
  });
  revalidatePath(`/users/${data.subjectId}`);
  revalidatePath("/reviews");
}

export async function deleteReview(id: string) {
  const session = await requireReviewWrite();
  const before = await prisma.consultantReview.findUniqueOrThrow({ where: { id } });
  await prisma.consultantReview.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "ConsultantReview", entityId: id,
    message: "Entretien interne supprimé", before
  });
  revalidatePath(`/users/${before.subjectId}`);
  revalidatePath("/reviews");
}
