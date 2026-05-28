// Liste des templates d'onboarding + bouton de création.
// Édition fine (items + offsets entretiens) dans la page détail [id].
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCap, ArrowRight, Pencil } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import { NewTemplateForm } from "./new-template-form";

export const dynamic = "force-dynamic";

export default async function OnboardingTemplatesPage() {
  await requireSession();
  const templates = await prisma.onboardingTemplate.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { items: true, onboardings: true } } }
  });

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Paramètres", href: "/settings" },
          { label: "Templates d'onboarding" }
        ]}
        title="Templates d'onboarding"
        subtitle="Modèles de checklists appliqués automatiquement à chaque nouvel arrivant."
      />

      <div className="card mb-6">
        <div className="card-header font-semibold">Nouveau template</div>
        <div className="p-4">
          <NewTemplateForm />
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title="Aucun template"
            description="Crée ton premier template ci-dessus."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/settings/onboarding-templates/${t.id}`}
              className="card p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-midnight-900 truncate">
                    {t.name}
                  </div>
                  <div className="text-[11px] text-midnight-500 mt-0.5">
                    {t.role ? ROLE_LABELS[t.role] : "Générique (tout rôle)"}
                    {!t.active && <span className="ml-1 text-amber-700">· Inactif</span>}
                  </div>
                </div>
                <Pencil className="w-3 h-3 text-midnight-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {t.description && (
                <p className="text-xs text-midnight-600 mt-2 line-clamp-2">
                  {t.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-[11px] text-midnight-500">
                <span>{t._count.items} items</span>
                <span>{t._count.onboardings} onboarding(s) lancé(s)</span>
              </div>
              <div className="mt-2 text-[11px] text-midnight-400">
                Entretiens : J+{t.reviewOffsets.join(", J+")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
