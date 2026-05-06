import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Briefcase } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  SALES: "Commercial", LEAVE: "Congés", MEETING: "Réunion interne",
  ADMIN: "Administratif", TRAINING: "Formation", RND: "R&D", OTHER: "Autre"
};

export default async function CostCentersPage() {
  await requirePermission("settings.manage");
  const list = await prisma.costCenter.findMany({ orderBy: [{ active: "desc" }, { code: "asc" }] });
  return (
    <div>
      <PageHeader
        title="Centres de coût internes"
        subtitle="Pour le temps non-projet : commercial, congés, réunion interne, formation..."
        actions={<Link href="/cost-centers/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>}
      />
      {list.length === 0 ? (
        <EmptyState icon={Briefcase} title="Aucun centre de coût" action={<Link href="/cost-centers/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Productif</th><th>Actif</th></tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className={!c.active ? "opacity-50" : ""}>
                  <td className="font-mono text-xs">{c.code}</td>
                  <td><Link href={`/cost-centers/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                  <td><span className="badge-info">{KIND_LABELS[c.kind]}</span></td>
                  <td>{c.countsAsBillable ? <span className="badge-success">Oui</span> : <span className="badge-neutral">Non</span>}</td>
                  <td>{c.active ? <span className="badge-success">Actif</span> : <span className="badge-neutral">Inactif</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
