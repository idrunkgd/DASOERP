import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions, requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, ArrowLeft, CheckCircle2, Clock, XCircle, Upload } from "lucide-react";
import { AssignPanel } from "./assign-panel";
import { SignForm } from "./sign-form";
import { UploadNewVersion } from "./upload-new-version";
import { EditMetaForm } from "./edit-meta-form";

export const dynamic = "force-dynamic";

export default async function PolicyDetailPage({
  params, searchParams
}: {
  params: { id: string };
  searchParams: { signatureId?: string };
}) {
  const session = await requirePermissionOrRedirect("policies.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("policies.manage");

  const doc = await prisma.signableDocument.findUnique({
    where: { id: params.id },
    include: {
      versions: { orderBy: { versionNum: "desc" } },
      signatures: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          version: { select: { versionNum: true } }
        },
        orderBy: [{ status: "asc" }, { assignedAt: "desc" }]
      }
    }
  });
  if (!doc) notFound();

  const currentVersion = doc.versions[0];
  const mySignature = doc.signatures.find((s) => s.userId === session.user.id && s.versionId === currentVersion?.id);

  // Users assignables : actifs non-portail non-déjà-assignés à la version courante
  const alreadyAssigned = new Set(
    doc.signatures.filter((s) => s.versionId === currentVersion?.id).map((s) => s.userId)
  );
  const assignableUsers = canManage
    ? await prisma.user.findMany({
        where: { active: true, candidateProfile: { is: null } },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ firstName: "asc" }]
      })
    : [];

  const bySignerCount = doc.signatures.filter((s) => s.status === "SIGNED").length;
  const byPendingCount = doc.signatures.filter((s) => s.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title={doc.title}
        subtitle={
          <span>
            {doc.category && <span className="badge-neutral text-[10px] mr-1">{doc.category}</span>}
            {doc.mandatory && <span className="badge-warning text-[10px] mr-1">Obligatoire</span>}
            <span className="text-midnight-500">v{currentVersion?.versionNum ?? "—"}</span>
          </span>
        }
        breadcrumb={[{ label: "Chartes & politiques", href: "/policies" }, { label: doc.title }]}
        actions={
          <Link href="/policies" className="btn-ghost btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Link>
        }
      />

      {doc.description && (
        <p className="text-sm text-midnight-700 mb-4">{doc.description}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne gauche : preview PDF + signature */}
        <div className="lg:col-span-2 space-y-4">
          {currentVersion && (
            <section className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">
                  <FileText className="w-3.5 h-3.5 inline mr-1 text-indigoaccent" />
                  {currentVersion.originalName}
                </div>
                <a
                  href={`/api/policies/${currentVersion.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigoaccent hover:underline"
                >
                  Ouvrir en plein écran →
                </a>
              </div>
              <iframe
                src={`/api/policies/${currentVersion.id}/download`}
                className="w-full h-[70vh] border border-border rounded"
                title={doc.title}
              />
            </section>
          )}

          {mySignature && (
            <section className="card p-5">
              {mySignature.status === "SIGNED" ? (
                <div className="flex items-center gap-3 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Document signé</div>
                    <div className="text-xs text-midnight-600">
                      Par « {mySignature.signatureText} » le {mySignature.signedAt?.toLocaleString("fr-BE")}
                    </div>
                  </div>
                </div>
              ) : mySignature.status === "PENDING" ? (
                <SignForm signatureId={mySignature.id} suggestedName={`${session.user.name ?? ""}`} />
              ) : (
                <div className="flex items-center gap-3 text-red-700">
                  <XCircle className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Signature refusée</div>
                    {mySignature.declinedReason && (
                      <div className="text-xs text-midnight-600">{mySignature.declinedReason}</div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Colonne droite : versions + signataires (admin) */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-2">Versions</h3>
            <ul className="space-y-1 text-xs">
              {doc.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>
                    <strong>v{v.versionNum}</strong>
                    <span className="text-midnight-500 ml-1">
                      {v.releasedAt.toLocaleDateString("fr-BE")}
                    </span>
                  </span>
                  <a
                    href={`/api/policies/${v.id}/download`}
                    target="_blank"
                    className="text-indigoaccent hover:underline"
                  >
                    PDF
                  </a>
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="mt-3 pt-3 border-t border-border">
                <UploadNewVersion documentId={doc.id} />
              </div>
            )}
          </div>

          {canManage && (
            <div className="card p-4">
              <EditMetaForm
                documentId={doc.id}
                initial={{
                  title: doc.title,
                  description: doc.description,
                  category: doc.category,
                  mandatory: doc.mandatory,
                  active: doc.active
                }}
              />
            </div>
          )}

          {canManage && (
            <AssignPanel
              documentId={doc.id}
              currentVersionId={currentVersion?.id ?? ""}
              users={assignableUsers.filter((u) => !alreadyAssigned.has(u.id))}
              signedCount={bySignerCount}
              pendingCount={byPendingCount}
            />
          )}

          {canManage && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-2">
                Signataires ({doc.signatures.length})
              </h3>
              <ul className="divide-y divide-border text-xs">
                {doc.signatures.length === 0 ? (
                  <li className="py-2 text-midnight-500 italic">Aucun signataire assigné.</li>
                ) : (
                  doc.signatures.map((sig) => (
                    <li key={sig.id} className="py-1.5 flex items-center justify-between gap-2">
                      <Link href={`/users/${sig.user.id}`} className="hover:text-indigoaccent">
                        {sig.user.firstName} {sig.user.lastName}
                      </Link>
                      {sig.status === "SIGNED" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px]">v{sig.version.versionNum}</span>
                        </span>
                      ) : sig.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Clock className="w-3 h-3" /> Attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <XCircle className="w-3 h-3" /> Refusé
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
