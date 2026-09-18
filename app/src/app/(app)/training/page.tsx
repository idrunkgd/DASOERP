import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArchitectureView } from "./architecture-view";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const session = await requirePermissionOrRedirect(["training.read", "self.read"]);
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("training.manage");

  // Admin (training.manage) : voit TOUS les cours, actifs et masqués.
  // Consultant : uniquement les actifs.
  const [courses, myProgress, myCerts] = await Promise.all([
    prisma.course.findMany({
      where: canManage ? {} : { active: true },
      orderBy: [{ title: "asc" }],
      include: {
        _count: { select: { slides: true } },
        prerequisiteCourse: { select: { id: true, title: true } }
      }
    }),
    prisma.userCourseProgress.findMany({ where: { userId: session.user.id } }),
    prisma.document.findMany({
      where: { consultantId: session.user.id, tags: { has: "certificat" } },
      select: { tags: true }
    })
  ]);

  const progressByCourse = new Map(myProgress.map((p) => [p.courseId, p]));
  const certifiedCourseIds = new Set(
    myCerts.flatMap((d) => d.tags.filter((t) => t.startsWith("course:")).map((t) => t.slice("course:".length)))
  );

  const cards = courses.map((c) => {
    const prog = progressByCourse.get(c.id);
    // Admin bypasse le lock des prérequis.
    const locked = !canManage && !!c.prerequisiteCourse && !certifiedCourseIds.has(c.prerequisiteCourse.id);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      active: c.active,
      slideCount: c._count.slides,
      prerequisiteCourse: c.prerequisiteCourse,
      progressPct: prog ? Math.round((prog.lastSlide / Math.max(c._count.slides, 1)) * 100) : 0,
      completed: !!prog?.completedAt,
      locked
    };
  });

  const allCoursesLight = courses.map((c) => ({ id: c.id, title: c.title }));

  return (
    <div>
      <PageHeader
        title="Formations techniques"
        subtitle="Un catalogue organisé en couches IT / OT / UNS — chaque formation se positionne dans le stack industriel"
      />

      {cards.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500 italic">
          Aucun cours publié pour l'instant.
        </div>
      ) : (
        <ArchitectureView courses={cards} canManage={canManage} allCourses={allCoursesLight} />
      )}
    </div>
  );
}
