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
              <th>Nom</th>
              <th>Description</th>
              <th className="text-right">Coût / jour</th>
              <th className="text-right">Vente / jour</th>
              <th className="text-right">Marge / jour</th>
              <th className="text-right">Marge %</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {profiles.map(p => {
                const dailyCost = Number(p.dailyCost);
                const dailySell = Number(p.dailySell);
                const marginD = dailySell - dailyCost;
                const marginPct = dailySell > 0 ? (marginD / dailySell) * 100 : 0;
                return (
                  <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                    <td className="font-medium"><Link href={`/service-profiles/${p.id}`} className="hover:underline">{p.name}</Link></td>
                    <td className="text-midnight-700 text-xs">{p.description ?? "—"}</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(p.dailyCost)}
                      <div className="text-[10px] text-midnight-400">{formatCurrency(p.hourlyCost)} / h</div>
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(p.dailySell)}
                      <div className="text-[10px] text-midnight-400">{formatCurrency(p.hourlySell)} / h</div>
                    </td>
                    <td className="text-right tabular-nums font-medium">{formatCurrency(marginD)}</td>
                    <td className="text-right tabular-nums">{marginPct.toFixed(1)}%</td>
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
