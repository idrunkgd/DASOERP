import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { NewPolicyForm } from "../new-policy-form";

export const dynamic = "force-dynamic";

/**
 * Console d'administration des chartes. Accessible via le bouton "Gérer les
 * chartes" en haut à droite de /policies. Contient la création, la
 * bibliothèque complète, et le résumé des signatures par document.
 */
export default async function PoliciesManagePage() {
  await requirePermissionOrRedirect("policies.manage");

  const documents = await prisma.signableDocument.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    include: {
      versions: { orderBy: { versionNum: "desc" }, take: 1 },
      _count: { select: { signatures: true } },
      signatures: { select: { status: true } }
    }
  });

  return (
    <div>
      <PageHeader
        title="Gérer les chartes & politiques"
        subtitle="Uploade tes chartes, assigne à signature, suis l'état de chaque signataire."
        actions={
          <Link href="/policies" className="btn-ghost text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour à mes chartes
          </Link>
        }
      />

      <div className="card mb-6">
        <div className="card-header font-semibold">Nouvelle charte / politique</div>
        <div className="p-4">
          <NewPolicyForm />
        </div>
      </div>

      <section className="card">
        <div className="card-header font-semibold">Bibliothèque ({documents.length})</div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-midnight-500 italic">
            Aucune politique publiée. Utilise le formulaire ci-dessus pour créer la première.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((d) => {
              const sigs = d.signatures;
              const signedCount   = sigs.filter((s) => s.status === "SIGNED").length;
              const pendingCount  = sigs.filter((s) => s.status === "PENDING").length;
              const declinedCount = sigs.filter((s) => s.status === "DECLINED").length;
              return (
                <li key={d.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/policies/${d.id}`} className="font-medium text-midnight-900 hover:text-indigoaccent">
                      {d.title}
                    </Link>
                    {d.category && <span className="badge-neutral text-[10px] ml-2">{d.category}</span>}
                    {d.mandatory && <span className="badge-warning text-[10px] ml-1">Obligatoire</span>}
                    <div className="text-[11px] text-midnight-500 mt-0.5 truncate">{d.description ?? "—"}</div>
                    <div className="text-[10px] text-midnight-400 mt-0.5">
                      v{d.versions[0]?.versionNum ?? "—"} · {d._count.signatures} signature(s) demandée(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-emerald-700" title="Signés">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {signedCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-700" title="En attente">
                      <Clock className="w-3.5 h-3.5" /> {pendingCount}
                    </span>
                    {declinedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-700" title="Refusés">
                        <XCircle className="w-3.5 h-3.5" /> {declinedCount}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
