import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Plus, ExternalLink, Eye, Power } from "lucide-react";
import { MigrateAllToV2Button } from "./migrate-all-button";

export const dynamic = "force-dynamic";

export default async function ClientPortalsPage() {
  await requirePermission("consulting.write");
  const portals = await (prisma as any).clientPortal.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { proposals: { where: { isVisible: true } } } }
    }
  });
  const legacyActiveCount = portals.filter((p: any) => p.workflowVersion === "LEGACY" && p.isActive).length;

  // Grouper par société
  const byCompany: Record<string, { company: any; portals: any[] }> = {};
  for (const p of portals) {
    const k = p.company?.id || "_";
    if (!byCompany[k]) byCompany[k] = { company: p.company, portals: [] };
    byCompany[k].portals.push(p);
  }

  return (
    <div>
      <PageHeader
        title="Portails clients"
        subtitle={`${portals.length} lien${portals.length > 1 ? "s" : ""} — chaque client/équipe reçoit un lien unique, immuable, sans login`}
        breadcrumb={[{ label: "Portails clients" }]}
        actions={
          <div className="flex items-center gap-2">
            {legacyActiveCount > 0 && <MigrateAllToV2Button count={legacyActiveCount} />}
            <Link href="/client-portals/new" className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nouveau portail
            </Link>
          </div>
        }
      />

      {portals.length === 0 && (
        <div className="card p-8 text-center text-midnight-500">
          <p>Aucun portail client encore créé.</p>
          <Link href="/client-portals/new" className="btn-primary mt-4 inline-flex">Créer le premier portail</Link>
        </div>
      )}

      <div className="space-y-6">
        {Object.values(byCompany).map(({ company, portals }) => (
          <div key={company?.id || "none"}>
            <h2 className="text-sm font-semibold text-midnight-700 mb-2">{company?.name || "Sans société"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {portals.map((p: any) => (
                <Link key={p.id} href={`/client-portals/${p.id}`} className="card p-4 hover:ring-2 hover:ring-indigo-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {p.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.logoUrl} alt="" className="w-10 h-10 rounded object-contain bg-white border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-700 grid place-items-center font-semibold">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[11px] text-midnight-500">{p._count.proposals} profil{p._count.proposals > 1 ? "s" : ""} visible{p._count.proposals > 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    {p.isActive ? (
                      <span className="badge-success text-[10px]">Actif</span>
                    ) : (
                      <span className="badge-muted text-[10px] flex items-center gap-1"><Power className="w-3 h-3" />Désactivé</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-midnight-500">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{p.viewCount} vue{p.viewCount > 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />/portal/{p.token.slice(0, 8)}…</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
