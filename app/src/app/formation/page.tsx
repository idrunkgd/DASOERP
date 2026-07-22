import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import * as icons from "lucide-react";
import { BookOpen, Clock, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Accueil du wiki formation. On liste toutes les catégories pour lesquelles
 * le user a la permission ERP correspondante. Chaque card mène à la liste
 * d'articles de la catégorie.
 */
export default async function FormationHome() {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const permSet = new Set(perms);

  const categories = await prisma.wikiCategory.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      articles: {
        where: { publishedAt: { not: null } },
        select: { id: true, requiredPermission: true, estimatedMinutes: true }
      }
    }
  });

  // Filtre par permission (catégorie ET articles). Si un article a un override
  // de permission plus stricte, on ne le compte que si l'user l'a aussi.
  const visible = categories
    .filter((c) => permSet.has(c.requiredPermission))
    .map((c) => {
      const articles = c.articles.filter(
        (a) => !a.requiredPermission || permSet.has(a.requiredPermission)
      );
      return {
        ...c,
        articleCount: articles.length,
        totalMinutes: articles.reduce((s, a) => s + a.estimatedMinutes, 0)
      };
    })
    .filter((c) => c.articleCount > 0);

  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigoaccent/10 text-indigoaccent text-xs font-medium mb-4">
          <GraduationCap className="w-3.5 h-3.5" />
          Centre de formation Dasohub
        </div>
        <h1 className="text-3xl font-bold text-midnight-900 mb-3">
          Apprends à utiliser l'ERP, module par module.
        </h1>
        <p className="text-midnight-600">
          Chaque thématique correspond à un module de l'ERP.
          Tu ne vois ici que les formations liées aux modules
          auxquels tu as accès.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 text-midnight-500">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucune formation disponible avec tes permissions actuelles.</p>
          <p className="text-xs mt-1">Contacte un admin si tu penses que c'est une erreur.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => {
            const Icon = (c.icon && (icons as any)[c.icon]) as any || BookOpen;
            return (
              <Link
                key={c.id}
                href={`/formation/${c.key}`}
                className="group card p-5 hover:border-indigoaccent hover:shadow-md transition"
              >
                <div className={"inline-flex p-2 rounded-lg mb-3 bg-indigoaccent/10 " + (c.colorClass ?? "text-indigoaccent")}>
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-midnight-900 group-hover:text-indigoaccent transition">
                  {c.title}
                </h2>
                <p className="text-xs text-midnight-500 mt-1 line-clamp-2">
                  {c.description}
                </p>
                <div className="mt-4 flex items-center gap-3 text-[11px] text-midnight-500">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {c.articleCount} {c.articleCount > 1 ? "articles" : "article"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{c.totalMinutes} min
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
