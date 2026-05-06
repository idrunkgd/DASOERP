import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding", CHECK_IN: "Point régulier", ANNUAL_REVIEW: "Entretien annuel",
  END_OF_MISSION: "Fin de mission", PERFORMANCE: "Performance", CAREER: "Carrière",
  OFFBOARDING: "Offboarding", OTHER_REVIEW: "Autre"
};
const OUTCOME_TONE: Record<string, string> = {
  SCHEDULED: "badge-info", COMPLETED: "badge-success", CANCELLED: "badge-neutral", RESCHEDULED: "badge-warning"
};

export default async function ReviewsPage({ searchParams }: { searchParams: { subject?: string; kind?: string; outcome?: string } }) {
  const session = await requireSession();
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  // Lecture : Admin / Manager voient tout. Les autres ne voient que leurs propres reviews.
  const canSeeAll = sessionPerms.includes("users.manage") || sessionPerms.includes("timesheet.validate");
  const where: any = {};
  if (!canSeeAll) where.subjectId = session.user.id;
  if (searchParams.subject) where.subjectId = searchParams.subject;
  if (searchParams.kind) where.kind = searchParams.kind;
  if (searchParams.outcome) where.outcome = searchParams.outcome;

  const [list, users] = await Promise.all([
    prisma.consultantReview.findMany({
      where,
      include: { subject: true, conductedBy: true, project: true },
      orderBy: { scheduledAt: "desc" }
    }),
    canSeeAll ? prisma.user.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }) : Promise.resolve([])
  ]);

  return (
    <div>
      <PageHeader
        title="Entretiens internes — consultants"
        subtitle={`${list.length} entretien(s) — suivi RH/Manager des employés Dasolabs`}
      />
      <form className="mb-4 flex gap-2 flex-wrap">
        {canSeeAll && (
          <select name="subject" defaultValue={searchParams.subject ?? ""} className="input max-w-[240px]">
            <option value="">Tous les consultants</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        )}
        <select name="kind" defaultValue={searchParams.kind ?? ""} className="input max-w-[200px]">
          <option value="">Tous types</option>
          {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="outcome" defaultValue={searchParams.outcome ?? ""} className="input max-w-[180px]">
          <option value="">Toutes issues</option>
          <option value="SCHEDULED">Planifié</option>
          <option value="COMPLETED">Tenu</option>
          <option value="CANCELLED">Annulé</option>
          <option value="RESCHEDULED">Reprogrammé</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500">Aucun entretien interne.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr>
              <th>Date</th><th>Consultant</th><th>Type</th><th>Conduit par</th><th>Projet</th><th>Issue</th><th>Feedback</th>
            </tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="text-xs text-midnight-700">{formatDate(r.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td><Link href={`/users/${r.subjectId}`} className="font-medium hover:underline">{r.subject.firstName} {r.subject.lastName}</Link></td>
                  <td><span className="badge-info">{KIND_LABELS[r.kind]}</span></td>
                  <td className="text-midnight-700">{r.conductedBy ? `${r.conductedBy.firstName} ${r.conductedBy.lastName}` : "—"}</td>
                  <td className="text-xs">{r.project ? <Link href={`/projects/${r.project.id}`} className="hover:underline">{r.project.reference}</Link> : "—"}</td>
                  <td><span className={OUTCOME_TONE[r.outcome] ?? "badge-neutral"}>{r.outcome}</span></td>
                  <td className="text-xs text-midnight-700 max-w-md truncate">{r.feedback ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
