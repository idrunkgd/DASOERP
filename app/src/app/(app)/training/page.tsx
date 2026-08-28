import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { GraduationCap, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { ImportAvevaButton } from "./import-aveva-button";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const session = await requirePermissionOrRedirect("training.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("training.manage");

  const [courses, myProgress] = await Promise.all([
    prisma.course.findMany({
      where: { active: true },
      orderBy: { title: "asc" },
      include: {
        _count: { select: { slides: true } }
      }
    }),
    prisma.userCourseProgress.findMany({
      where: { userId: session.user.id }
    })
  ]);
  const progressByCourse = new Map(myProgress.map((p) => [p.courseId, p]));

  return (
    <div>
      <PageHeader
        title="Formations techniques"
        subtitle="Cours slide-by-slide avec quiz interactifs — ta progression est sauvegardée"
        actions={canManage ? <ImportAvevaButton /> : undefined}
      />

      {courses.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500 italic">
          Aucun cours publié.{" "}
          {canManage && <>Clique sur « Importer la formation AVEVA » pour créer le premier.</>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const prog = progressByCourse.get(c.id);
            const pct = prog ? Math.round((prog.lastSlide / c._count.slides) * 100) : 0;
            const completed = !!prog?.completedAt;
            return (
              <Link
                key={c.id}
                href={`/training/${c.slug}`}
                className="card p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigoaccent/10 text-indigoaccent flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-midnight-900 group-hover:text-indigoaccent transition-colors">
                      {c.title}
                    </h3>
                    {c.subtitle && <p className="text-xs text-midnight-500 mt-0.5 line-clamp-2">{c.subtitle}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                  {c.level    && <span className="badge-neutral">{c.level}</span>}
                  {c.duration && <span className="badge-neutral inline-flex items-center gap-1"><Clock className="w-3 h-3" />{c.duration}</span>}
                  <span className="badge-neutral">{c._count.slides} slides</span>
                </div>
                <div className="mt-4">
                  {completed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
                    </span>
                  ) : prog ? (
                    <>
                      <div className="flex items-center justify-between text-[10px] text-midnight-500 mb-1">
                        <span>En cours — slide {prog.lastSlide}/{c._count.slides}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-midnight-100 overflow-hidden">
                        <div className="h-full bg-indigoaccent" style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-indigoaccent font-medium">
                      <PlayCircle className="w-3.5 h-3.5" /> Commencer
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
