import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { ChevronLeft, ChevronRight, Clock, GraduationCap, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { Markdown } from "./markdown";
import { ArticleEditor } from "./editor";

export const dynamic = "force-dynamic";

const DIFFICULTY_LABELS: Record<string, { label: string; cls: string }> = {
  BEGINNER:     { label: "Débutant",       cls: "bg-emerald-100 text-emerald-700" },
  INTERMEDIATE: { label: "Intermédiaire",  cls: "bg-amber-100 text-amber-700" },
  ADVANCED:     { label: "Avancé",         cls: "bg-red-100 text-red-700" }
};

export default async function ArticlePage({ params }: { params: { category: string; article: string } }) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const permSet = new Set(perms);
  const canEdit = permSet.has("users.manage"); // Un admin peut éditer les articles

  const category = await prisma.wikiCategory.findUnique({
    where: { key: params.category },
    include: {
      articles: {
        where: { publishedAt: { not: null } },
        orderBy: { orderIndex: "asc" }
      }
    }
  });
  if (!category) notFound();
  if (!permSet.has(category.requiredPermission)) notFound();

  const currentIndex = category.articles.findIndex((a) => a.slug === params.article);
  const article = category.articles[currentIndex];
  if (!article) notFound();
  if (article.requiredPermission && !permSet.has(article.requiredPermission)) notFound();

  const prev = currentIndex > 0 ? category.articles[currentIndex - 1] : null;
  const next = currentIndex < category.articles.length - 1 ? category.articles[currentIndex + 1] : null;

  const updatedBy = article.updatedById
    ? await prisma.user.findUnique({
        where: { id: article.updatedById },
        select: { firstName: true, lastName: true }
      })
    : null;

  const diff = DIFFICULTY_LABELS[article.difficulty] ?? DIFFICULTY_LABELS.BEGINNER;

  // Freshness — un article non vérifié depuis > 90 jours affiche un badge
  // orange "à revoir". Sert de rappel visuel pour maintenir le wiki en
  // synchro avec l'ERP après chaque évolution.
  const now = Date.now();
  const referenceDate = (article.lastReviewedAt ?? article.updatedAt).getTime();
  const daysSince = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
  const stale = daysSince > 90;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-1 text-xs text-midnight-500">
        <Link href="/formation" className="hover:text-midnight-800">Thématiques</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href={`/formation/${category.key}`} className="hover:text-midnight-800">{category.title}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-midnight-800">{article.title}</span>
      </div>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-midnight-900">{article.title}</h1>
        <p className="text-base text-midnight-600">{article.description}</p>
        <div className="flex items-center gap-3 text-xs text-midnight-500 flex-wrap">
          <span className={"rounded px-2 py-0.5 " + diff.cls}>
            <GraduationCap className="w-3 h-3 inline-block mr-0.5" />
            {diff.label}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {article.estimatedMinutes} min de lecture
          </span>
          {updatedBy && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> Dernière édition : {updatedBy.firstName} {updatedBy.lastName}
              &nbsp;· {article.updatedAt.toLocaleDateString("fr-BE")}
            </span>
          )}
          {article.lastReviewedAt ? (
            <span
              className={
                "flex items-center gap-1 rounded px-2 py-0.5 " +
                (stale ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")
              }
              title={stale
                ? `Non vérifié depuis ${daysSince} jours — peut être obsolète`
                : `Vérifié il y a ${daysSince} jour(s)`}
            >
              {stale ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
              {stale
                ? `À revoir (${daysSince}j sans vérif)`
                : `Vérifié il y a ${daysSince}j`}
            </span>
          ) : (
            <span
              className="flex items-center gap-1 rounded px-2 py-0.5 bg-amber-100 text-amber-800"
              title="Jamais vérifié depuis la création — cliquer sur 'Marquer vérifié' quand tu confirmes que le contenu correspond à la version actuelle de l'ERP"
            >
              <AlertCircle className="w-3 h-3" /> Jamais vérifié
            </span>
          )}
        </div>
      </header>

      {canEdit ? (
        <ArticleEditor
          id={article.id}
          initial={article.content}
          categorySlug={category.key}
          articleSlug={article.slug}
        />
      ) : (
        <article className="card p-8">
          <Markdown source={article.content} />
        </article>
      )}

      {/* Nav prev / next */}
      <nav className="flex items-stretch gap-2 pt-4 border-t border-border">
        {prev ? (
          <Link href={`/formation/${category.key}/${prev.slug}`} className="card p-3 flex-1 hover:border-indigoaccent transition">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wide flex items-center gap-1"><ChevronLeft className="w-3 h-3" /> Précédent</div>
            <div className="text-sm font-medium text-midnight-900 mt-1 line-clamp-1">{prev.title}</div>
          </Link>
        ) : <div className="flex-1" />}
        {next ? (
          <Link href={`/formation/${category.key}/${next.slug}`} className="card p-3 flex-1 hover:border-indigoaccent transition text-right">
            <div className="text-[10px] text-midnight-400 uppercase tracking-wide flex items-center gap-1 justify-end">Suivant <ChevronRight className="w-3 h-3" /></div>
            <div className="text-sm font-medium text-midnight-900 mt-1 line-clamp-1">{next.title}</div>
          </Link>
        ) : <div className="flex-1" />}
      </nav>
    </div>
  );
}
