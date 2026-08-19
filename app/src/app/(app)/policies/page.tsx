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

      {/* Bloc "À signer" — mis en avant */}
      {pending.length > 0 && (
        <section className="card mb-6 border-amber-200 bg-amber-50/40">
          <div className="card-header font-semibold flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4" />
            À signer ({pending.length})
          </div>
          <ul className="divide-y divide-amber-200">
            {pending.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center justify-between gap-3">
                <div className="text-sm min-w-0 flex-1">
                  <Link
                    href={`/policies/${sig.document.id}?signatureId=${sig.id}`}
                    className="font-medium hover:text-indigoaccent"
                  >
                    {sig.document.title}
                  </Link>
                  {sig.document.category && <span className="badge-neutral text-[10px] ml-2">{sig.document.category}</span>}
                  {sig.document.mandatory && <span className="badge-warning text-[10px] ml-1">Obligatoire</span>}
                  <span className="text-[10px] text-midnight-400 ml-2">v{sig.version.versionNum}</span>
                  {sig.document.description && (
                    <div className="text-[11px] text-midnight-500 mt-0.5 truncate">{sig.document.description}</div>
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

      {/* Bloc "Déjà signés" */}
      {signed.length > 0 && (
        <section className="card">
          <div className="card-header font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            Signés ({signed.length})
          </div>
          <ul className="divide-y divide-border text-sm">
            {signed.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/policies/${sig.document.id}`} className="hover:text-indigoaccent font-medium">
                    {sig.document.title}
                  </Link>
                  {sig.document.category && <span className="badge-neutral text-[10px] ml-2">{sig.document.category}</span>}
                  <span className="text-[10px] text-midnight-400 ml-2">v{sig.version.versionNum}</span>
                </div>
                <span className="text-[11px] text-midnight-500 flex-shrink-0 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
