// Édition d'un template : nom/rôle/description/offsets entretiens + liste
// des items groupés par catégorie. CRUD items + suppression du template.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { TemplateForm } from "./template-form";
import { TemplateItemsEditor } from "./items-editor";

export const dynamic = "force-dynamic";

export default async function TemplateDetail({
  params
}: {
  params: { id: string };
}) {
  await requireSession();
  const template = await prisma.onboardingTemplate.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: [{ category: "asc" }, { position: "asc" }] },
      _count: { select: { onboardings: true } }
    }
  });
  if (!template) notFound();

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Paramètres", href: "/settings" },
          { label: "Templates", href: "/settings/onboarding-templates" },
          { label: template.name }
        ]}
        title={template.name}
        subtitle={`${template.items.length} items · ${template._count.onboardings} onboarding(s) lancé(s) avec ce template`}
        actions={
          <Link
            href="/settings/onboarding-templates"
            className="btn-secondary text-xs"
          >
            <ChevronLeft className="w-3 h-3" /> Retour
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header font-semibold">Configuration</div>
            <div className="p-4">
              <TemplateForm
                template={{
                  id: template.id,
                  name: template.name,
                  role: template.role,
                  description: template.description,
                  active: template.active,
                  reviewOffsets: template.reviewOffsets
                }}
              />
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header font-semibold">Items de la checklist</div>
            <div className="p-4">
              <TemplateItemsEditor
                templateId={template.id}
                items={template.items.map((i) => ({
                  id: i.id,
                  category: i.category,
                  title: i.title,
                  description: i.description,
                  defaultOwnerRole: i.defaultOwnerRole,
                  daysOffset: i.daysOffset,
                  position: i.position
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
