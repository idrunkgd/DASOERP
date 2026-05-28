// Liste des pages du wiki interne, groupées par catégorie + section "Épinglées".
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Pin, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams
}: {
  searchParams: { q?: string };
}) {
  await requireSession();

  const q = (searchParams.q || "").trim();
  const where: any = {};
  if (q.length >= 2) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } }
    ];
  }

  const pages = await prisma.wikiPage.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { category: "asc" }, { updatedAt: "desc" }],
    include: {
      updatedBy: { select: { firstName: true, lastName: true } }
    }
  });

  // Sépare les épinglées du reste
  const pinned = pages.filter((p) => p.pinned);
  const rest = pages.filter((p) => !p.pinned);

  // Groupe par catégorie (les non-épinglées)
  const byCategory: { category: string; pages: typeof rest }[] = [];
  for (const p of rest) {
    const key = p.category ?? "Sans catégorie";
    const last = byCategory.find((g) => g.category === key);
    if (last) last.pages.push(p);
    else byCategory.push({ category: key, pages: [p] });
  }

  return (
    <div>
      <PageHeader
        title="Wiki interne"
        subtitle="Procédures, méthodes, templates RH et IT — markdown éditable."
        actions={
          <Link href="/knowledge/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Nouvelle page
          </Link>
        }
      />

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher dans le wiki..."
          className="input max-w-md"
        />
        <button className="btn-secondary">Filtrer</button>
        {q && (
          <Link href="/knowledge" className="btn-secondary">
            Effacer
          </Link>
        )}
      </form>

      {pages.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title={q ? "Aucun résultat" : "Aucune page wiki pour l'instant"}
            description={
              q
                ? `Aucune page ne contient « ${q} ».`
                : "Crée la première page pour documenter tes procédures internes."
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-midnight-400 font-semibold mb-2 flex items-center gap-1">
                <Pin className="w-3 h-3" /> Épinglées
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinned.map((p) => (
                  <PageCard key={p.id} page={p} />
                ))}
              </div>
            </section>
          )}

          {byCategory.map((g) => (
            <section key={g.category}>
              <h2 className="text-[10px] uppercase tracking-wider text-midnight-400 font-semibold mb-2">
                {g.category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.pages.map((p) => (
                  <PageCard key={p.id} page={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PageCard({
  page
}: {
  page: {
    id: string;
    slug: string;
    title: string;
    body: string;
    category: string | null;
    updatedAt: Date;
    pinned: boolean;
    updatedBy: { firstName: string; lastName: string } | null;
  };
}) {
  // Premier paragraphe non-vide du markdown pour l'aperçu
  const preview = page.body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .slice(0, 2)
    .join(" ")
    .slice(0, 140);

  return (
    <Link
      href={`/knowledge/${page.slug}`}
      className="card p-4 hover:shadow-md transition-shadow group block"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-sm font-semibold text-midnight-900 truncate">
          {page.title}
        </div>
        {page.pinned && (
          <Pin className="w-3 h-3 text-amber-500 shrink-0" />
        )}
      </div>
      {preview && (
        <div className="text-xs text-midnight-500 line-clamp-2">{preview}</div>
      )}
      <div className="mt-2 text-[10px] text-midnight-400">
        Mise à jour {formatDate(page.updatedAt)}
        {page.updatedBy && ` · ${page.updatedBy.firstName} ${page.updatedBy.lastName[0]}.`}
      </div>
    </Link>
  );
}
