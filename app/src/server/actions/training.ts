"use server";
/**
 * Formations techniques : cours slide-by-slide avec quiz interactifs.
 *
 * - importCourse(slug) : lit /src/lib/seed/<slug>.json et upsert le cours
 *   avec toutes ses slides. Idempotent : ré-exécuter réécrit les slides.
 * - saveQuizAttempt : enregistre la tentative + calcule le score.
 * - updateProgress : mémorise la dernière slide vue par l'utilisateur.
 */
import { prisma } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

interface SeedSlide {
  position: number;
  kind: "CONTENT" | "QUIZ";
  section: string | null;
  title: string;
  bodyMd: string;
  notes: string | null;
  quiz: { questions: Array<{ prompt: string; options: string[]; correctIndex: number }> } | null;
}
interface SeedCourse {
  slug: string;
  title: string;
  subtitle?: string;
  level?: string;
  duration?: string;
  slides: SeedSlide[];
}

/**
 * Importe/rafraîchit un cours depuis un JSON bundle du repo.
 * Slug attendu : `aveva-system-platform-2023` par défaut.
 */
export async function importCourseFromSeed(slug: string) {
  const session = await requirePermission("training.manage");

  // /src/lib/seed/<slug>.json — lu depuis le filesystem au runtime
  const filePath = path.join(process.cwd(), "src", "lib", "seed", `${slug}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    throw new Error(`Fichier de seed introuvable pour le cours "${slug}".`);
  }
  const data: SeedCourse = JSON.parse(raw);

  // Upsert du cours + remplacement complet des slides (transaction)
  const course = await prisma.$transaction(async (tx) => {
    const c = await tx.course.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null,
        createdBy: session.user.id
      },
      update: {
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null
      }
    });
    // Reset slides puis recréation
    await tx.courseSlide.deleteMany({ where: { courseId: c.id } });
    await tx.courseSlide.createMany({
      data: data.slides.map((s) => ({
        courseId: c.id,
        position: s.position,
        kind: s.kind,
        section: s.section,
        title: s.title,
        bodyMd: s.bodyMd,
        notes: s.notes,
        quiz: s.quiz as any
      }))
    });
    return c;
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Course",
    entityId: course.id,
    message: `Cours "${course.title}" importé (${data.slides.length} slides)`
  });

  revalidatePath("/training");
  revalidatePath(`/training/${slug}`);
  return { ok: true, courseId: course.id, slides: data.slides.length };
}

/**
 * Enregistre une tentative de quiz. answers[i].chosenIndex = index de l'option
 * cochée pour la question i. Compare à la bonne réponse stockée dans slide.quiz.
 */
export async function saveQuizAttempt(
  slideId: string,
  chosenIndexes: number[]
) {
  const session = await requireSession();

  const slide = await prisma.courseSlide.findUnique({
    where: { id: slideId },
    select: { id: true, courseId: true, kind: true, quiz: true }
  });
  if (!slide) throw new Error("Slide introuvable.");
  if (slide.kind !== "QUIZ") throw new Error("Cette slide n'est pas un quiz.");
  const questions = (slide.quiz as any)?.questions as Array<{ correctIndex: number }> | undefined;
  if (!questions?.length) throw new Error("Ce quiz n'a pas de questions.");

  const answers = questions.map((q, i) => {
    const chosen = chosenIndexes[i];
    const isCorrect = chosen === q.correctIndex;
    return { questionIndex: i, chosenIndex: chosen, isCorrect };
  });
  const score = answers.filter((a) => a.isCorrect).length;

  await prisma.userQuizAttempt.create({
    data: {
      userId: session.user.id,
      courseId: slide.courseId,
      slideId,
      answers,
      score,
      total: questions.length
    }
  });

  revalidatePath(`/training`);
  return { score, total: questions.length, answers };
}

/**
 * Mémorise la dernière slide vue et marque completedAt quand on atteint la
 * dernière slide.
 */
export async function updateCourseProgress(courseId: string, slidePosition: number) {
  const session = await requireSession();
  const maxPos = await prisma.courseSlide.aggregate({
    where: { courseId },
    _max: { position: true }
  });
  const isLast = maxPos._max.position === slidePosition;
  await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    create: {
      userId: session.user.id,
      courseId,
      lastSlide: slidePosition,
      completedAt: isLast ? new Date() : null
    },
    update: {
      lastSlide: slidePosition,
      completedAt: isLast ? new Date() : undefined
    }
  });
  return { ok: true, completed: isLast };
}
