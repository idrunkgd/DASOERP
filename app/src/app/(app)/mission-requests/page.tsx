import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Briefcase, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouvelle", QUALIFYING: "Qualification", PRESENTING: "Présentation",
  CONTRACTED: "Contractée", LOST: "Perdue", CANCELLED: "Annulée"
};
const STATUS_TONES: Record<string, string> = {
  NEW: "badge-info", QUALIFYING: "badge-warning", PRESENTING: "badge-info",
  CONTRACTED: "badge-success", LOST: "badge-danger", CANCELLED: "badge-neutral"
};

export default async function MissionsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  await requirePermission("consulting.read");
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.q) where.OR = [
    { title: { contains: searchParams.q, mode: "insensitive" } },
    { reference: { contains: searchParams.q, mode: "insensitive" } }
  ];
  const list = await prisma.missionRequest.findMany({
    where, include: { company: true, intermediaryCompany: true, owner: true, _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" }
  });
  return (
    <div>
      <PageHeader
        title="Demandes de mission"
        subtitle={`${list.length} demande(s) — pipeline consultance`}
        actions={<Link href="/mission-requests/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle demande</Link>}
      />
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Réf, titre..." className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[200px]">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>
      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={Briefcase} title="Aucune demande" action={<Link href="/mission-requests/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouvelle</Link>} />
        ) : (
          <table className="table-base">
            <thead><tr>
              <th>Réf</th><th>Titre</th><th>Client</th><th>Séniorité</th>
              <th>Début</th><th className="text-right">Cible €/j</th><th>Statut</th><th className="text-right">Cands.</th><th>Resp.</th>
            </tr></thead>
            <tbody>
              {list.map(m => (
                <tr key={m.id}>
                  <td className="font-mono text-xs">{m.reference}</td>
                  <td><Link href={`/mission-requests/${m.id}`} className="font-medium hover:underline">{m.title}</Link></td>
                  <td>
                    <Link href={`/companies/${m.companyId}`} className="hover:underline text-midnight-700">{m.company.name}</Link>
                    {m.intermediaryCompany && <div className="text-xs text-midnight-500">via {m.intermediaryCompany.name}</div>}
                  </td>
                  <td className="text-midnight-700">{m.seniority ?? "—"}</td>
                  <td className="text-xs">{m.startDate ? formatDate(m.startDate) : "—"}</td>
                  <td className="text-right tabular-nums">{m.targetDailyRate ? formatCurrency(m.targetDailyRate) : "—"}</td>
                  <td><span className={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</span></td>
                  <td className="text-right tabular-nums">{m._count.applications}</td>
                  <td className="text-midnight-700 text-xs">{m.owner ? `${m.owner.firstName[0]}. ${m.owner.lastName}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
