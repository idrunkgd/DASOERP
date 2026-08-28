import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { QuizRunner, type QuizQuestion } from "./quiz-runner";
import { ProgressTracker } from "./progress-tracker";

export const dynamic = "force-dynamic";

export default async function SlideViewer({
  params
}: { params: { slug: string; position: string } }) {
  await requirePermissionOrRedirect("training.read");
  const pos = parseInt(params.position, 10);
  if (isNaN(pos) || pos < 1) notFound();

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: {
      id: true, slug: true, title: true,
      slides: {
        select: { id: true, position: true, kind: true, section: true, title: true, bodyMd: true, imageUrl: true, quiz: true }
      }
    }
  });
  if (!course) notFound();

  const sorted = [...course.slides].sort((a, b) => a.position - b.position);
  const slide = sorted.find((s) => s.position === pos);
  if (!slide) notFound();

  const idx = sorted.findIndex((s) => s.position === pos);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  const quizQuestions = (slide.quiz as any)?.questions as QuizQuestion[] | undefined;

  return (
    <div>
      {/* Marque cette slide comme vue au premier rendu */}
      <ProgressTracker courseId={course.id} slidePosition={pos} />

      <PageHeader
        title={slide.title}
        subtitle={
          <span>
            {slide.section && <span className="text-[10px] uppercase tracking-wide text-indigoaccent font-semibold mr-2">{slide.section}</span>}
            <span className="text-midnight-500">Slide {pos}/{sorted.length}</span>
            {slide.kind === "QUIZ" && <span className="badge-warning text-[10px] ml-2">Quiz</span>}
          </span>
        }
        actions={
          <Link href={`/training/${course.slug}`} className="btn-ghost text-sm inline-flex items-center gap-1">
            <List className="w-4 h-4" /> Sommaire
          </Link>
        }
      />

      {/* Corps de la slide :
          - QUIZ → runner interactif (avec image du PPT au-dessus pour contexte si dispo)
          - CONTENT → image PPT si disponible, sinon texte brut extrait */}
      {slide.kind === "QUIZ" && quizQuestions?.length ? (
        <>
          {slide.imageUrl && (
            <div className="card p-2 mb-4 flex justify-center bg-midnight-50/30">
              <img src={slide.imageUrl} alt={slide.title} className="max-w-full rounded" />
            </div>
          )}
          <QuizRunner slideId={slide.id} questions={quizQuestions} />
        </>
      ) : slide.imageUrl ? (
        <div className="card p-2 flex justify-center bg-midnight-50/30">
          <img src={slide.imageUrl} alt={slide.title} className="max-w-full rounded shadow-sm" />
        </div>
      ) : (
        <article className="card p-6 md:p-8 prose prose-sm max-w-none text-midnight-900 whitespace-pre-wrap">
          {slide.bodyMd || <em className="text-midnight-400">Contenu non renseigné.</em>}
        </article>
      )}

      {/* Navigation prev / next */}
      <div className="flex items-center justify-between mt-6 gap-3">
        {prev ? (
          <Link href={`/training/${course.slug}/${prev.position}`} className="btn-secondary text-sm inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> {prev.position}. {prev.title.slice(0, 40)}{prev.title.length > 40 ? "…" : ""}
          </Link>
        ) : <div />}
        {next ? (
          <Link href={`/training/${course.slug}/${next.position}`} className="btn-primary text-sm inline-flex items-center gap-1">
            {next.position}. {next.title.slice(0, 40)}{next.title.length > 40 ? "…" : ""} <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link href={`/training/${course.slug}`} className="btn-primary text-sm inline-flex items-center gap-1">
            Terminer le cours ✓
          </Link>
        )}
      </div>
    </div>
  );
}
