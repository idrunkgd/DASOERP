import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import * as icons from "lucide-react";
import { BookOpen, Clock, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

const DIFFICULTY_LABELS: Record<string, { label: string; cls: string }> = {
  BEGINNER:     { label: "Débutant",       cls: "bg-emerald-100 text-emerald-700" },
  INTERMEDIATE: { label: "Intermédiaire",  cls: "bg-amber-100 text-amber-700" },
  ADVANCED:     { label: "Avancé",         cls: "bg-red-100 text-red-700" }
};

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const permSet = new Set(perms);

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

  const articles = category.articles.filter(
    (a) => !a.requiredPermission || permSet.has(a.requiredPermission)
  );

  const Icon = (category.icon && (icons as any)[category.icon]) as any || BookOpen;

  return (
    <div className="space-y-6">
      <Link href="/formation" className="text-xs text-midnight-500 hover:text-midnight-800 flex items-center gap-1">
        <ChevronLeft className="w-3 h-3" /> Toutes les thématiques
      </Link>
      <header className="flex items-start gap-4">
        <div className={"p-3 rounded-lg bg-indigoaccent/10 " + (category.colorClass ?? "text-indigoaccent")}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-midnight-900">{category.title}</h1>
          <p className="text-sm text-midnight-600 mt-1">{category.description}</p>
        </div>
      </header>

      {articles.length === 0 ? (
        <p className="text-sm text-midnight-500 text-center py-8">
          Aucun article publié pour cette thématique.
        </p>
      ) : (
        <div className="space-y-2">
          {articles.map((a, idx) => {
            const diff = DIFFICULTY_LABELS[a.difficulty] ?? DIFFICULTY_LABELS.BEGINNER;
            return (
              <Link
                key={a.id}
                href={`/formation/${category.key}/${a.slug}`}
                className="group card p-4 flex items-center gap-4 hover:border-indigoaccent transition"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-midnight-100 group-hover:bg-indigoaccent/10 flex items-center justify-center text-xs font-semibold text-midnight-700 group-hover:text-indigoaccent">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-midnight-900 group-hover:text-indigoaccent">{a.title}</h3>
                  <p className="text-xs text-midnight-500 mt-0.5 line-clamp-1">{a.description}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-midnight-500 flex-shrink-0">
                  <span className={"rounded px-1.5 py-0.5 " + diff.cls}>
                    <GraduationCap className="w-3 h-3 inline-block mr-0.5" />
                    {diff.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {a.estimatedMinutes} min
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
