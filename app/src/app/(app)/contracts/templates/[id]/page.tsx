import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { TemplateEditor } from "./template-editor";
import { VARIABLE_CATALOG } from "@/lib/contracts";
import { ArrowLeft, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: { id: string } }) {
  await requirePermissionOrRedirect("contracts.manage");

  const template = await prisma.contractTemplate.findUnique({
    where: { id: params.id },
    include: { chapters: { orderBy: { sortOrder: "asc" } } }
  });
  if (!template) notFound();

  return (
    <div>
      <PageHeader
        title={template.name}
        subtitle="Édition template"
        breadcrumb={[
          { label: "Contrats", href: "/contracts" },
          { label: template.name }
        ]}
        actions={
          <Link href="/contracts" className="btn-ghost btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Éditeur principal */}
        <div className="lg:col-span-3">
          <TemplateEditor
            template={{
              id: template.id,
              name: template.name,
              description: template.description,
              active: template.active
            }}
            chapters={template.chapters.map((c) => ({
              id: c.id,
              title: c.title,
              bodyMd: c.bodyMd,
              sortOrder: c.sortOrder
            }))}
          />
        </div>

        {/* Aide variables */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-midnight-900 mb-2 flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-indigoaccent" /> Variables disponibles
            </h3>
            <p className="text-[11px] text-midnight-500 mb-3">
              Insère <code className="bg-midnight-100 px-1 rounded">{"{{key}}"}</code> dans le
              texte d'un chapitre. Résolu à la génération sur base des données du
              consultant / candidat.
            </p>
            <ul className="space-y-1 text-xs">
              {VARIABLE_CATALOG.map((v) => (
                <li key={v.key} className="flex justify-between gap-2">
                  <code className="bg-indigoaccent/10 text-indigoaccent px-1.5 py-0.5 rounded font-mono">
                    {`{{${v.key}}}`}
                  </code>
                  <span className="text-midnight-500 text-right text-[10px]">{v.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
