import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CheckCircle2, AlertCircle, Settings2, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Vue "MES chartes" — même pour un admin. L'user ne voit QUE les
 * documents qui lui sont assignés, avec leur statut (à signer / signé).
 * L'admin a un bouton "Gérer les chartes" en haut à droite qui l'emmène
 * sur /policies/manage pour créer/assigner/consulter les signataires.
 */
export default async function PoliciesPage() {
  const session = await requirePermissionOrRedirect(["policies.read", "self.read"]);
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("policies.manage");

  const mySignatures = await prisma.documentSignature.findMany({
    where: { userId: session.user.id },
    include: {
      document: { select: { id: true, title: true, category: true, mandatory: true, description: true } },
      version: { select: { id: true, versionNum: true }
      }
    },
    // PENDING avant SIGNED (ordre alphabétique de l'enum : DECLINED < PENDING < SIGNED)
    orderBy: [{ status: "asc" }, { assignedAt: "desc" }]
  });

  const pending = mySignatures.filter((s) => s.status === "PENDING");
  const signed  = mySignatures.filter((s) => s.status === "SIGNED");

  return (
    <div>
      <PageHeader
        title="Mes chartes & politiques"
        subtitle="Documents à lire et signer. Signature électronique simple (nom + horodatage)."
        actions={
          canManage ? (
            <Link href="/policies/manage" className="btn-secondary text-sm inline-flex items-center gap-1">
              <Settings2 className="w-4 h-4" /> Gérer les chartes
            </Link>
          ) : null
        }
      />

      {mySignatures.length === 0 && (
        <div className="card p-10 text-center text-sm text-midnight-500 italic">
          Aucune charte ne t'est assignée pour l'instant.
        </div>
      )}

      {/* Bloc "À signer" — lignes, ton amber, mis en avant */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2 uppercase tracking-wide">
            <AlertCircle className="w-4 h-4" />
            À signer ({pending.length})
          </h2>
          <ul className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden divide-y divide-amber-200">
            {pending.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center gap-3 hover:bg-amber-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/policies/${sig.document.id}?signatureId=${sig.id}`}
                      className="font-semibold text-sm text-midnight-900 hover:text-indigoaccent"
                    >
                      {sig.document.title}
                    </Link>
                    {sig.document.category && (
                      <span className="badge-neutral text-[10px]">{sig.document.category}</span>
                    )}
                    {sig.document.mandatory && (
                      <span className="badge-warning text-[10px]">Obligatoire</span>
                    )}
                    <span className="text-[10px] text-midnight-400">v{sig.version.versionNum}</span>
                  </div>
                  {sig.document.description && (
                    <p className="text-xs text-midnight-600 mt-0.5 line-clamp-1">
                      {sig.document.description}
                    </p>
                  )}
                </div>
                <Link
                  href={`/policies/${sig.document.id}?signatureId=${sig.id}`}
                  className="btn-primary btn-sm text-xs flex-shrink-0"
                >
                  Lire & signer
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bloc "Déjà signés" — lignes, ton émeraude, plus discret */}
      {signed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4" />
            Signés ({signed.length})
          </h2>
          <ul className="rounded-xl border border-emerald-100 bg-white overflow-hidden divide-y divide-emerald-100">
            {signed.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center gap-3 hover:bg-emerald-50/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/policies/${sig.document.id}`}
                      className="font-semibold text-sm text-midnight-900 hover:text-indigoaccent"
                    >
                      {sig.document.title}
                    </Link>
                    {sig.document.category && (
                      <span className="badge-neutral text-[10px]">{sig.document.category}</span>
                    )}
                    <span className="text-[10px] text-midnight-400">v{sig.version.versionNum}</span>
                  </div>
                  {sig.document.description && (
                    <p className="text-xs text-midnight-500 mt-0.5 line-clamp-1">
                      {sig.document.description}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-emerald-700 font-medium flex-shrink-0">
                  Signé le {sig.signedAt?.toLocaleDateString("fr-BE")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
