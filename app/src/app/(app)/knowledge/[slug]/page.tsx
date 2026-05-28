// Vue d'une page wiki + bouton édition.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Pencil, Pin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { MarkdownView } from "../markdown-view";

export const dynamic = "force-dynamic";

export default async function WikiPageView({
  params
}: {
  params: { slug: string };
}) {
  await requireSession();
  const page = await prisma.wikiPage.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } }
    }
  });
  if (!page) notFound();

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Wiki", href: "/knowledge" },
          ...(page.category ? [{ label: page.category }] : []),
          { label: page.title }
        ]}
        title={
          <span className="inline-flex items-center gap-2">
            {page.pinned && <Pin className="w-4 h-4 text-amber-500" />}
            {page.title}
          </span> as any
        }
        subtitle={`Mise à jour ${formatDate(page.updatedAt)}${
          page.updatedBy ? ` par ${page.updatedBy.firstName} ${page.updatedBy.lastName}` : ""
        }`}
        actions={
          <Link
            href={`/knowledge/${page.slug}/edit`}
            className="btn-secondary text-xs"
          >
            <Pencil className="w-3 h-3" />
            Éditer
          </Link>
        }
      />
      <div className="card p-6">
        <MarkdownView source={page.body || "*(page vide)*"} />
      </div>
    </div>
  );
}
