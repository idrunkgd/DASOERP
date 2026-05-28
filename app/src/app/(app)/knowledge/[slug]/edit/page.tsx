// Édition d'une page wiki existante.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { WikiPageForm } from "../../wiki-page-form";

export const dynamic = "force-dynamic";

export default async function EditWikiPage({
  params
}: {
  params: { slug: string };
}) {
  await requireSession();
  const page = await prisma.wikiPage.findUnique({
    where: { slug: params.slug }
  });
  if (!page) notFound();

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Wiki", href: "/knowledge" },
          { label: page.title, href: `/knowledge/${page.slug}` },
          { label: "Éditer" }
        ]}
        title={`Éditer : ${page.title}`}
      />
      <WikiPageForm
        mode="edit"
        page={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          body: page.body,
          category: page.category,
          pinned: page.pinned
        }}
      />
    </div>
  );
}
