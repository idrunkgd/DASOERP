import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, PlayCircle, RotateCw, CheckCircle2, FileQuestion, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const session = await requirePermissionOrRedirect("training.read");

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: {
      slides: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, kind: true, section: true, title: true }
      }
    }
  });
  if (!course) notFound();

  const progress = await prisma.userCourseProgress.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } }
  });

  // Regrouper par section pour l'affichage
  const sections = new Map<string, typeof course.slides>();
  course.slides.forEach((s) => {
    const key = s.section ?? "Autres";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(s);
  });

  const startPos = progress?.lastSlide ?? 1;
  const isFresh = !progress;
  const isDone = !!progress?.completedAt;

  return (
    <div>
      <PageHeader
        title={course.title}
        subtitle={course.subtitle ?? undefined}
        actions={
          <div className="flex gap-2">
            <Link href={`/training/${course.slug}/${startPos}`} className="btn-primary text-sm inline-flex items-center gap-1">
              {isDone ? <><RotateCw className="w-4 h-4" /> Recommencer</> : isFresh ? <><PlayCircle className="w-4 h-4" /> Commencer</> : <><PlayCircle className="w-4 h-4" /> Reprendre slide {startPos}</>}
            </Link>
            <Link href="/training" className="btn-ghost text-sm inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Retour
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {course.level && <span className="badge-neutral">{course.level}</span>}
        {course.duration && <span className="badge-neutral">{course.duration}</span>}
        <span className="badge-neutral">{course.slides.length} slides</span>
        <span className="badge-neutral">{course.slides.filter(s => s.kind === "QUIZ").length} quiz</span>
        {isDone && <span className="badge-success inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Terminé</span>}
      </div>

      <div className="space-y-6">
        {[...sections.entries()].map(([sect, slides]) => (
          <section key={sect} className="card">
            <div className="card-header font-semibold uppercase tracking-wide text-[11px] text-indigoaccent">
              {sect}
            </div>
            <ul className="divide-y divide-border">
              {slides.map((s) => {
                const seen = progress && s.position <= progress.lastSlide;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/training/${course.slug}/${s.position}`}
                      className="flex items-center gap-3 p-3 text-sm hover:bg-midnight-50/40 transition-colors"
                    >
                      <div className="w-8 text-right text-[10px] text-midnight-400 tabular-nums flex-shrink-0">
                        {s.position}
                      </div>
                      <div className="flex-shrink-0">
                        {s.kind === "QUIZ" ? (
                          <FileQuestion className="w-4 h-4 text-amber-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-indigoaccent" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={seen ? "text-midnight-500 line-through" : "text-midnight-900"}>{s.title}</span>
                        {s.kind === "QUIZ" && (
                          <span className="ml-2 text-[10px] text-amber-700 font-medium uppercase tracking-wide">Quiz</span>
                        )}
                      </div>
                      {seen && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
