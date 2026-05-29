import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: { entity?: string; action?: string; actor?: string; q?: string; page?: string } }) {
  await requirePermission("audit.read");
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const where: any = {};
  if (searchParams.entity) where.entityType = searchParams.entity;
  if (searchParams.action) where.action = searchParams.action;
  if (searchParams.actor) where.actorId = searchParams.actor;
  if (searchParams.q) where.message = { contains: searchParams.q, mode: "insensitive" };

  const [events, total, users] = await Promise.all([
    prisma.activityLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({ orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Audit trail" subtitle={`${total} événement(s) — qui a fait quoi, quand, avec diff avant/après`} />
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Rechercher dans message..." className="input max-w-xs" />
        <select name="entity" defaultValue={searchParams.entity ?? ""} className="input max-w-[200px]">
          <option value="">Toutes les entités</option>
          {["Company","Contact","ContactInteraction","Offer","OfferLine","BillingMilestone","Project","ProjectMember","TimesheetEntry","Purchase","PlanningEntry","User","ServiceProfile","CostCenter"].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select name="action" defaultValue={searchParams.action ?? ""} className="input max-w-[200px]">
          <option value="">Toutes les actions</option>
          {["CREATE","UPDATE","DELETE","STATUS_CHANGE","OFFER_WON","OFFER_LOST","PROJECT_CREATED_FROM_OFFER","TIMESHEET_SUBMITTED","TIMESHEET_APPROVED","TIMESHEET_REJECTED","MILESTONE_STATUS_CHANGE","CSV_IMPORT"].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select name="actor" defaultValue={searchParams.actor ?? ""} className="input max-w-[200px]">
          <option value="">Tous les acteurs</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead><tr>
            <th>Quand</th><th>Acteur</th><th>Action</th><th>Entité</th><th>Message</th><th>Diff</th>
          </tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id} className="align-top">
                <td className="text-xs text-midnight-500 whitespace-nowrap">{formatDate(e.createdAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="text-midnight-700">{e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "—"}</td>
                <td><span className="badge-info">{e.action}</span></td>
                <td className="text-xs text-midnight-700">{e.entityType}{e.entityId && <div className="font-mono text-[10px] text-midnight-400">{e.entityId.slice(0, 10)}…</div>}</td>
                <td className="text-sm">{e.message}</td>
                <td>{e.diff ? <DiffViewer diff={e.diff as any} /> : <span className="text-midnight-400 text-xs">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 10).map(p => (
            <a key={p} href={`?${new URLSearchParams({ ...searchParams, page: String(p) }).toString()}`} className={p === page ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{p}</a>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffViewer({ diff }: { diff: Record<string, { before: any; after: any }> }) {
  const entries = Object.entries(diff || {});
  if (entries.length === 0) return <span className="text-midnight-400 text-xs">—</span>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-indigoaccent hover:underline">{entries.length} champ(s)</summary>
      <table className="mt-2 text-[11px]">
        <thead><tr><th className="text-left pr-2">Champ</th><th className="text-left pr-2">Avant</th><th className="text-left">Après</th></tr></thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="pr-2 font-mono text-midnight-700">{k}</td>
              <td className="pr-2 text-red-700 break-all">{format(v.before)}</td>
              <td className="text-emerald-700 break-all">{format(v.after)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function format(v: any): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
