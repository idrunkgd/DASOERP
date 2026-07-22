import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, ROLE_LABELS, getUserAccessGroupName, DEFAULT_GROUP_NAME, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./profile-form";
import { CandidateCvForm } from "./cv-form";
import { ExperiencesPanel } from "./experiences-panel";
import { UserExperiencesPanel } from "./user-experiences-panel";
import { SickLeaveBlock } from "./sick-leave-form";
import { MeTabsNav } from "./tabs-nav";
import { LeaveRequestBlock } from "./leave-request-block";
import { computeLeaveBalance } from "@/lib/leave-balance";
import { FileDown, Eye, ReceiptText, GraduationCap } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyProfile({
  searchParams
}: {
  searchParams: { tab?: string };
}) {
  const session = await requireSession();
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isAdmin = sessionPerms.includes("users.manage");
  const tab = ["general", "cv", "rh"].includes(searchParams.tab ?? "")
    ? (searchParams.tab as "general" | "cv" | "rh")
    : "general";

  const [me, groupName, skillCatalog, candidateProfile, sickLeaves, myExpenses] = await Promise.all([
    // Inclut les expériences pro pour l'espace "Mon CV" côté consultant interne
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    }),
    getUserAccessGroupName(session.user.id),
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.candidate.findUnique({
      where: { portalUserId: session.user.id },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    }),
    prisma.sickLeave.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: "desc" },
      take: 30
    }),
    prisma.expenseReport.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
      take: 20
    })
  ]);

  // Congés — solde annuel + demandes récentes + missions actives (pour la
  // case "demandé chez le client et accordé").
  const [leaveBalance, leaveRequests, activeMissions] = await Promise.all([
    computeLeaveBalance(session.user.id),
    prisma.leaveRequest.findMany({
      where: { userId: session.user.id },
      include: { mission: { select: { reference: true, title: true } } },
      orderBy: { startDate: "desc" },
      take: 20
    }),
    prisma.mission.findMany({
      where: {
        status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] },
        consultantId: session.user.id
      },
      select: { id: true, reference: true, title: true, company: { select: { name: true } } }
    })
  ]);
  const leaveRequestsUi = leaveRequests.map((r) => ({
    id: r.id,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    days: Number(r.days),
    type: r.type,
    reason: r.reason,
    status: r.status,
    missionRef: r.mission ? `${r.mission.reference} — ${r.mission.title}` : null,
    clientApproved: r.clientApproved,
    rejectionReason: r.rejectionReason
  }));
  const activeMissionsUi = activeMissions.map((m) => ({
    id: m.id,
    label: `${m.reference} — ${m.title} (${m.company?.name ?? "—"})`
  }));
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const sickLeavesUi = sickLeaves.map((l) => {
    const startIso = l.startDate.toISOString().slice(0, 10);
    const endIso = l.endDate.toISOString().slice(0, 10);
    return {
      id: l.id,
      startDate: startIso,
      endDate: endIso,
      reason: l.reason,
      certificateUrl: l.certificateUrl,
      isActive: startIso <= todayIso && todayIso <= endIso
    };
  });

  const isCandidatePortal = !!candidateProfile;

  return (
    <div>
      <PageHeader
        title={isCandidatePortal ? "Mon CV" : "Mon profil"}
        subtitle={isCandidatePortal
          ? "Complétez votre CV — vos informations sont directement visibles par notre équipe."
          : "Vos informations personnelles et identifiants"}
        actions={
          <>
            {/* Aperçu + Export CV : disponibles pour portail candidat ET
                consultant interne. L'aperçu (inline=1) ouvre le PDF sans
                le télécharger, pour vérifier le rendu avant envoi. */}
            {(() => {
              const cvQuery = isCandidatePortal
                ? `candidateId=${candidateProfile!.id}`
                : `userId=${session.user.id}`;
              return (
                <>
                  <a
                    href={`/api/exports/cv-pdf?${cvQuery}&inline=1`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn-ghost text-sm inline-flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> Aperçu
                  </a>
                  <a
                    href={`/api/exports/cv-pdf?${cvQuery}`}
                    className="btn-secondary text-sm inline-flex items-center gap-1"
                  >
                    <FileDown className="w-4 h-4" /> Exporter mon CV
                  </a>
                </>
              );
            })()}
            <a href="/me/tests" className="btn-secondary text-sm">
              🎓 Mes tests techniques
            </a>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <aside className="space-y-4">
          <div className="card p-5 flex flex-col items-center text-center">
            <PersonAvatar firstName={me.firstName} lastName={me.lastName} photoUrl={me.photoUrl} size={140} className="rounded-2xl shadow-card" />
            <h2 className="font-semibold text-midnight-900 mt-3">{me.firstName} {me.lastName}</h2>
            <p className="text-xs text-midnight-500">{me.email}</p>
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Identité Dasolabs</h3>
            {!isCandidatePortal && (
              <div className="flex justify-between"><span className="text-midnight-500">Rôle (fonction)</span><span>{ROLE_LABELS[me.role]}</span></div>
            )}
            <div className="flex justify-between"><span className="text-midnight-500">Groupe d'accès</span><span className={"font-medium " + (groupName === DEFAULT_GROUP_NAME ? "text-amber-700" : "text-indigoaccent")}>{groupName}</span></div>
            {!isCandidatePortal && (
              <div className="flex justify-between"><span className="text-midnight-500">Date d'entrée</span><span>{me.joinedAt ? formatDate(me.joinedAt) : "—"}</span></div>
            )}
            {/* Infos financières visibles uniquement par les admins */}
            {isAdmin && me.dailyCost && <div className="flex justify-between"><span className="text-midnight-500">Taux jour</span><span className="tabular-nums">{formatCurrency(me.dailyCost)}</span></div>}
            {isAdmin && me.weeklyCapacityH && <div className="flex justify-between"><span className="text-midnight-500">Capacité</span><span>{Number(me.weeklyCapacityH).toFixed(0)}h/sem</span></div>}
          </div>

          {!isCandidatePortal && groupName === DEFAULT_GROUP_NAME && (
            <div className="card p-4 text-xs border-amber-200 bg-amber-50/50 text-amber-900">
              <p className="font-medium mb-1">Vous êtes en groupe Visiteur</p>
              <p>Vous n'avez pas encore d'accès aux modules. Contactez un administrateur pour obtenir un groupe d'accès adapté à votre fonction.</p>
            </div>
          )}

          {isCandidatePortal && (
            <div className="card p-4 text-xs border-indigoaccent/30 bg-indigoaccent/5 text-midnight-900">
              <p className="font-medium mb-1">Bienvenue 👋</p>
              <p>Cette page est votre espace personnel. Tout ce que vous renseignez ici nous aide à vous proposer les meilleures missions. Pensez à mettre votre profil à jour régulièrement.</p>
            </div>
          )}
        </aside>

        <div className="lg:col-span-2">
          {isCandidatePortal ? (
            /* Portail candidat externe : pas d'onglets, tout en une vue */
            <div className="space-y-6">
              <CandidateCvForm candidateId={candidateProfile.id} initial={candidateProfile as any} skillCatalog={skillCatalog} />
              <ExperiencesPanel
                candidateId={candidateProfile.id}
                experiences={(candidateProfile.experiences ?? []).map(e => ({
                  id: e.id,
                  companyName: e.companyName,
                  jobTitle: e.jobTitle,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate ? e.endDate.toISOString() : null,
                  description: e.description
                }))}
              />
            </div>
          ) : (
            /* Consultant interne : navigation par onglets pour ne pas noyer
               la page. Sections regroupées par nature (perso, CV, RH). */
            <>
              <MeTabsNav current={tab} />

              {tab === "general" && (
                <div className="space-y-6">
                  <ProfileForm initial={me as any} skillCatalog={skillCatalog} />
                </div>
              )}

              {tab === "cv" && (
                <div className="space-y-6">
                  <UserExperiencesPanel
                    userId={me.id}
                    experiences={me.experiences.map((e) => ({
                      id: e.id,
                      companyName: e.companyName,
                      jobTitle: e.jobTitle,
                      startDate: e.startDate.toISOString(),
                      endDate: e.endDate ? e.endDate.toISOString() : null,
                      description: e.description
                    }))}
                  />
                </div>
              )}

              {tab === "rh" && (
                <RhTab
                  sickLeavesUi={sickLeavesUi}
                  myExpenses={myExpenses.map((r) => ({
                    id: r.id,
                    date: r.date.toISOString(),
                    description: r.description,
                    category: r.category,
                    amountTtc: Number(r.amountTtc),
                    status: r.status
                  }))}
                  leaveBalance={leaveBalance}
                  leaveRequests={leaveRequestsUi}
                  activeMissions={activeMissionsUi}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Onglet RH — centralise notes de frais, arrêts maladie, et à
// terme les formations et tout le reste (mutuelle, contrats, etc.)

const EXPENSE_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: "Brouillon",  cls: "bg-midnight-100 text-midnight-700" },
  SUBMITTED: { label: "Soumise",    cls: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "Approuvée",  cls: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Refusée",    cls: "bg-red-100 text-red-700" },
  PAID:      { label: "Remboursée", cls: "bg-indigoaccent/20 text-indigoaccent" }
};
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: "Transport", MEAL: "Repas", ACCOMMODATION: "Hébergement",
  SUPPLIES: "Fournitures", SOFTWARE: "Logiciel", TRAINING: "Formation",
  OTHER: "Autre"
};

function RhTab({
  sickLeavesUi,
  myExpenses,
  leaveBalance,
  leaveRequests,
  activeMissions
}: {
  sickLeavesUi: {
    id: string; startDate: string; endDate: string;
    reason: string | null; certificateUrl: string | null; isActive: boolean;
  }[];
  myExpenses: {
    id: string; date: string; description: string;
    category: string; amountTtc: number; status: string;
  }[];
  leaveBalance: {
    year: number; entitled: number; approved: number;
    pending: number; remaining: number; remainingIfAllApproved: number;
  };
  leaveRequests: {
    id: string; startDate: string; endDate: string; days: number;
    type: string; reason: string | null; status: string;
    missionRef: string | null; clientApproved: boolean;
    rejectionReason: string | null;
  }[];
  activeMissions: { id: string; label: string }[];
}) {
  const totalDraft = myExpenses.filter((e) => e.status === "DRAFT").length;
  const totalPending = myExpenses.filter((e) => ["SUBMITTED", "APPROVED"].includes(e.status)).length;

  return (
    <div className="space-y-6">
      {/* Congés — solde + demande + historique */}
      <LeaveRequestBlock
        balance={leaveBalance}
        existing={leaveRequests}
        activeMissions={activeMissions}
      />
      {/* Notes de frais — synthèse + liste courte + CTA vers /expenses */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <ReceiptText className="w-4 h-4 text-midnight-500" /> Mes notes de frais
            </h3>
            <p className="text-xs text-midnight-500">
              {totalDraft > 0 && <>{totalDraft} brouillon(s) · </>}
              {totalPending > 0 && <>{totalPending} en attente de remboursement · </>}
              {myExpenses.length === 0 && "Aucune note pour l'instant"}
            </p>
          </div>
          <Link href="/expenses" className="btn-primary text-sm">
            + Nouvelle note
          </Link>
        </div>
        {myExpenses.length === 0 ? (
          <p className="text-xs text-midnight-400 text-center py-4">
            Va sur <Link href="/expenses" className="text-indigoaccent hover:underline">/expenses</Link> pour en créer une.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {myExpenses.slice(0, 6).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 border border-midnight-200 rounded"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-midnight-100 text-midnight-700 rounded px-1.5 py-0.5">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                    </span>
                    <span className="truncate">{e.description}</span>
                  </div>
                  <div className="text-[10px] text-midnight-400 tabular-nums">
                    {new Date(e.date).toLocaleDateString("fr-BE")}
                  </div>
                </div>
                <span className="tabular-nums font-medium text-sm">
                  {e.amountTtc.toFixed(2)} €
                </span>
                <span className={
                  "text-[10px] rounded px-1.5 py-0.5 shrink-0 " +
                  (EXPENSE_STATUS_LABELS[e.status]?.cls ?? "")
                }>
                  {EXPENSE_STATUS_LABELS[e.status]?.label ?? e.status}
                </span>
              </li>
            ))}
            {myExpenses.length > 6 && (
              <li className="text-center pt-1">
                <Link href="/expenses" className="text-xs text-indigoaccent hover:underline">
                  Voir mes {myExpenses.length} notes →
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Arrêts maladie */}
      <SickLeaveBlock existingLeaves={sickLeavesUi} />

      {/* Placeholder Formations — à venir */}
      <section className="card p-4 border-dashed border-midnight-200 bg-midnight-50/30">
        <div className="flex items-center gap-2 text-sm text-midnight-500">
          <GraduationCap className="w-4 h-4" />
          <span className="font-semibold">Formations</span>
          <span className="text-[11px] bg-midnight-200 text-midnight-600 rounded px-1.5 py-0.5">
            Bientôt
          </span>
        </div>
        <p className="text-xs text-midnight-500 mt-1">
          Suivi de tes formations suivies, budgets alloués, certifications à
          renouveler — arrive dans une prochaine version.
        </p>
      </section>
    </div>
  );
}
