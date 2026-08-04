import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, Plus, FileCog, User as UserIcon, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  DRAFT:      "bg-midnight-100 text-midnight-700",
  ACTIVE:     "bg-emerald-100 text-emerald-700",
  TERMINATED: "bg-amber-100 text-amber-700",
  CANCELLED:  "bg-red-100 text-red-700"
};

export default async function ContractsPage() {
  const session = await requirePermissionOrRedirect("contracts.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("contracts.manage");

  const [templates, contracts] = await Promise.all([
    prisma.contractTemplate.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { chapters: true, contracts: true } } }
    }),
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        candidate: { select: { id: true, firstName: true, lastName: true } }
      }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Contrats"
        subtitle="Templates réutilisables + contrats générés"
        breadcrumb={[{ label: "Contrats" }]}
        actions={
          canManage && (
            <Link href="/contracts/templates/new" className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> Nouveau template
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Templates ─── */}
        <section className="card p-5">
          <h2 className="font-semibold text-midnight-900 mb-3 flex items-center gap-2">
            <FileCog className="w-4 h-4 text-indigoaccent" /> Templates ({templates.length})
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-midnight-500 italic">
              Aucun template. Crée un template avec des chapitres et des variables
              pour générer des contrats.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {templates.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/contracts/templates/${t.id}`}
                      className="font-medium text-midnight-900 hover:text-indigoaccent"
                    >
                      {t.name}
                    </Link>
                    {t.description && (
                      <div className="text-xs text-midnight-500 truncate">{t.description}</div>
                    )}
                    <div className="text-[10px] text-midnight-400 mt-0.5">
                      {t._count.chapters} chapitre{t._count.chapters > 1 ? "s" : ""} · {t._count.contracts} contrat{t._count.contracts > 1 ? "s" : ""} généré{t._count.contracts > 1 ? "s" : ""}
                      {!t.active && " · désactivé"}
                    </div>
                  </div>
                  <Link
                    href={`/contracts/templates/${t.id}`}
                    className="btn-ghost btn-sm text-xs flex-shrink-0"
                  >
                    Éditer
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Contrats générés ─── */}
        <section className="card p-5">
          <h2 className="font-semibold text-midnight-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigoaccent" /> Contrats ({contracts.length})
          </h2>
          {contracts.length === 0 ? (
            <p className="text-sm text-midnight-500 italic">
              Aucun contrat généré. Sur la fiche d'un consultant ou candidat,
              clique "Générer un contrat" pour créer une instance.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {contracts.map((c) => {
                const subject = c.user ?? c.candidate;
                const subjectHref = c.user
                  ? `/users/${c.user.id}`
                  : c.candidate ? `/candidates/${c.candidate.id}` : "#";
                return (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/contracts/${c.id}`} className="font-medium text-midnight-900 hover:text-indigoaccent">
                        {c.reference}
                      </Link>
                      <div className="text-xs text-midnight-500 truncate">{c.title}</div>
                      {subject && (
                        <div className="text-[10px] text-midnight-400 mt-0.5 flex items-center gap-1">
                          {c.user ? <UserIcon className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                          <Link href={subjectHref} className="hover:text-indigoaccent">
                            {subject.firstName} {subject.lastName}
                          </Link>
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_TONE[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
