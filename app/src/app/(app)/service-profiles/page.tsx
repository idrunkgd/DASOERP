import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { Plus, BadgeCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  await requirePermission("offers.write");
  const profiles = await prisma.serviceProfile.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader
        title="Profils de service"
        subtitle="Catalogue de séniorités/profils utilisés dans le chiffrage des offres"
        actions={<Link href="/service-profiles/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau profil</Link>}
      />
      {profiles.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Aucun profil" description="Créez vos premiers profils (Junior, Senior, Lead…) pour faciliter le chiffrage." action={<Link href="/service-profiles/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr>
              <th>Nom</th><th>Description</th>
              <th className="text-right">Cout / h</th><th className="text-right">Vente / h</th>
              <th className="text-right">Cout / j</th><th className="text-right">Vente / j</th>
              <th className="text-right">Marge / j</th><th></th>
            </tr></thead>
            <tbody>
              {profiles.map(p => {
                const marginD = Number(p.dailySell) - Number(p.dailyCost);
                return (
                  <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                    <td className="font-medium"><Link href={`/service-profiles/${p.id}`} className="hover:underline">{p.name}</Link></td>
                    <td className="text-midnight-700 text-xs">{p.description ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.hourlyCost)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.hourlySell)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.dailyCost)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(p.dailySell)}</td>
                    <td className="text-right tabular-nums font-medium">{formatCurrency(marginD)}</td>
                    <td className="text-right"><Link href={`/service-profiles/${p.id}`} className="text-xs text-indigoaccent hover:underline">Éditer</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
