import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions, requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { NewPolicyForm } from "./new-policy-form";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const session = await requirePermissionOrRedirect("policies.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("policies.manage");

  const [documents, mySignatures] = await Promise.all([
    prisma.signableDocument.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { title: "asc" }],
      include: {
        versions: { orderBy: { versionNum: "desc" }, take: 1 },
        _count: { select: { signatures: true } }
      }
    }),
    prisma.documentSignature.findMany({
      where: { userId: session.user.id },
      include: {
        document: { select: { id: true, title: true, category: true } },
        version: { select: { id: true, versionNum: true } }
      },
      orderBy: [{ status: "asc" }, { assignedAt: "desc" }]
    })
  ]);

  const pending = mySignatures.filter((s) => s.status === "PENDING");
  const signed = mySignatures.filter((s) => s.status === "SIGNED");

  return (
    <div>
      <PageHeader
        title="Chartes & politiques"
        subtitle={
          canManage
            ? "Uploade tes chartes, assigne à signature, suis l'état de chaque signataire."
            : "Documents à lire et signer. Signature électronique simple (nom + timestamp)."
        }
      />

      {/* Bloc "À signer" pour l'utilisateur courant */}
      {pending.length > 0 && (
        <section className="card mb-6 border-amber-200 bg-amber-50/40">
          <div className="card-header font-semibold flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4" />
            À signer ({pending.length})
          </div>
          <ul className="divide-y divide-amber-200">
            {pending.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <Link href={`/policies/${sig.document.id}?signatureId=${sig.id}`} className="font-medium hover:text-indigoaccent">
                    {sig.document.title}
                  </Link>
                  {sig.document.category && <span className="badge-neutral text-[10px] ml-2">{sig.document.category}</span>}
                  <span className="text-[10px] text-midnight-400 ml-2">v{sig.version.versionNum}</span>
                </div>
                <Link href={`/policies/${sig.document.id}?signatureId=${sig.id}`} className="btn-primary btn-sm text-xs">
                  Lire & signer
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulaire d'ajout (admin) */}
      {canManage && (
        <div className="card mb-6">
          <div className="card-header font-semibold">Nouvelle charte / politique</div>
          <div className="p-4">
            <NewPolicyForm />
          </div>
        </div>
      )}

      {/* Liste des documents */}
      <section className="card">
        <div className="card-header font-semibold">Bibliothèque ({documents.length})</div>
        {documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-midnight-500 italic">
            {canManage
              ? "Aucune politique publiée. Utilise le formulaire ci-dessus pour créer la première."
              : "Aucune politique disponible pour le moment."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((d) => {
              const mySig = mySignatures.find((s) => s.document.id === d.id && s.status === "SIGNED");
              return (
                <li key={d.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/policies/${d.id}`} className="font-medium text-midnight-900 hover:text-indigoaccent">
                      {d.title}
                    </Link>
                    {d.category && <span className="badge-neutral text-[10px] ml-2">{d.category}</span>}
                    {d.mandatory && <span className="badge-warning text-[10px] ml-1">Obligatoire</span>}
                    <div className="text-[11px] text-midnight-500 mt-0.5 truncate">
                      {d.description ?? "—"}
                    </div>
                    <div className="text-[10px] text-midnight-400 mt-0.5">
                      v{d.versions[0]?.versionNum ?? "—"} · {d._count.signatures} signature(s) demandée(s)
                    </div>
                  </div>
                  {mySig ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Signé
                    </span>
                  ) : (
                    <span className="text-xs text-midnight-400 flex-shrink-0">Pas assigné</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Bloc "Mes signatures" pour l'utilisateur (déjà signés) */}
      {signed.length > 0 && (
        <section className="card mt-6">
          <div className="card-header font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            Documents que j'ai signés ({signed.length})
          </div>
          <ul className="divide-y divide-border text-sm">
            {signed.map((sig) => (
              <li key={sig.id} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <Link href={`/policies/${sig.document.id}`} className="hover:text-indigoaccent">
                    {sig.document.title}
                  </Link>
                  <span className="text-[10px] text-midnight-400 ml-2">v{sig.version.versionNum}</span>
                </div>
                <span className="text-[11px] text-midnight-500">
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
