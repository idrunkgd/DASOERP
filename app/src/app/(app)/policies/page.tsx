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
  const session = await requirePermissionOrRedirect("policies.read");
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

      {/* Bloc "À signer" — grille de cartes centrées, mises en avant */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <AlertCircle className="w-4 h-4" />
            À signer ({pending.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((sig) => (
              <Link
                key={sig.id}
                href={`/policies/${sig.document.id}?signatureId=${sig.id}`}
                className="group relative flex flex-col items-center text-center rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-5 shadow-sm hover:shadow-md hover:border-amber-400 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-midnight-900 text-sm leading-tight">
                  {sig.document.title}
                </h3>
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {sig.document.category && (
                    <span className="badge-neutral text-[10px]">{sig.document.category}</span>
                  )}
                  {sig.document.mandatory && (
                    <span className="badge-warning text-[10px]">Obligatoire</span>
                  )}
                  <span className="badge-neutral text-[10px] bg-white">v{sig.version.versionNum}</span>
                </div>
                {sig.document.description && (
                  <p className="text-xs text-midnight-600 mt-3 line-clamp-3">
                    {sig.document.description}
                  </p>
                )}
                <span className="btn-primary btn-sm text-xs mt-4 pointer-events-none">
                  Lire & signer
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bloc "Déjà signés" — même grille, ton émeraude, plus discret */}
      {signed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4" />
            Signés ({signed.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signed.map((sig) => (
              <Link
                key={sig.id}
                href={`/policies/${sig.document.id}`}
                className="group flex flex-col items-center text-center rounded-xl border border-emerald-100 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-midnight-900 text-sm leading-tight">
                  {sig.document.title}
                </h3>
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {sig.document.category && (
                    <span className="badge-neutral text-[10px]">{sig.document.category}</span>
                  )}
                  <span className="badge-neutral text-[10px]">v{sig.version.versionNum}</span>
                </div>
                {sig.document.description && (
                  <p className="text-xs text-midnight-500 mt-3 line-clamp-2">
                    {sig.document.description}
                  </p>
                )}
                <span className="text-[11px] text-emerald-700 font-medium mt-3 inline-flex items-center gap-1">
                  Signé le {sig.signedAt?.toLocaleDateString("fr-BE")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
