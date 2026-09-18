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
  imageUrl?: string | null;
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

  // prisma/seed-data/<slug>.json — dossier partagé avec le seed automatique
  // exécuté au démarrage du conteneur (voir Dockerfile).
  const filePath = path.join(process.cwd(), "prisma", "seed-data", `${slug}.json`);
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
        imageUrl: s.imageUrl ?? null,
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
    select: {
      id: true, courseId: true, kind: true, quiz: true, position: true,
      course: { select: { id: true, isCertifying: true, passThreshold: true } }
    }
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

  // ─── Certification : cours certifiant + quiz FINAL du cours ───
  let certificateIssued: null | { documentId: string; scorePercent: number; passed: boolean; threshold: number } = null;
  if (slide.course.isCertifying) {
    // On considère "quiz certifiant" = quiz avec la position la plus élevée du cours.
    const lastQuizPos = await prisma.courseSlide.aggregate({
      where: { courseId: slide.courseId, kind: "QUIZ" },
      _max: { position: true }
    });
    const isFinalQuiz = lastQuizPos._max.position === slide.position;
    if (isFinalQuiz) {
      const percent = Math.round((score / questions.length) * 100);
      const threshold = slide.course.passThreshold ?? 70;
      if (percent >= threshold) {
        try {
          const { issueCertificateForUser } = await import("@/server/services/certificate-service");
          const r = await issueCertificateForUser({
            userId: session.user.id,
            courseId: slide.courseId,
            scorePercent: percent
          });
          certificateIssued = { documentId: r.documentId, scorePercent: percent, passed: true, threshold };
          // Marque le cours "Terminé" définitivement (le fait d'avoir un cert
          // est le vrai signal d'achèvement d'un cours certifiant).
          await prisma.userCourseProgress.upsert({
            where: { userId_courseId: { userId: session.user.id, courseId: slide.courseId } },
            create: {
              userId: session.user.id,
              courseId: slide.courseId,
              lastSlide: slide.position,
              completedAt: new Date()
            },
            update: { completedAt: new Date(), lastSlide: slide.position }
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[training] emission certificat échouée:", err);
        }
      } else {
        certificateIssued = { documentId: "", scorePercent: percent, passed: false, threshold };
      }
    }
  }

  revalidatePath(`/training`);
  revalidatePath(`/me/documents`);
  return { score, total: questions.length, answers, certificate: certificateIssued };
}

/**
 * Mémorise la dernière slide vue et marque completedAt quand on atteint la
 * dernière slide.
 *
 * IMPORTANT — cours certifiant :
 *   Un cours `isCertifying` n'est marqué "Terminé" QUE si l'utilisateur a
 *   effectivement obtenu son certificat (Document tagué `certificat` +
 *   `course:<id>`). Le simple fait de défiler jusqu'à la slide finale (quiz)
 *   ne suffit pas — sinon l'user voit "Terminé" alors qu'il n'a jamais cliqué
 *   sur « Valider mes réponses », et n'a donc pas de PDF.
 */
export async function updateCourseProgress(courseId: string, slidePosition: number) {
  const session = await requireSession();
  const [maxPos, course] = await Promise.all([
    prisma.courseSlide.aggregate({
      where: { courseId },
      _max: { position: true }
    }),
    prisma.course.findUnique({ where: { id: courseId }, select: { isCertifying: true } })
  ]);
  const isLast = maxPos._max.position === slidePosition;

  let completed = isLast;
  if (isLast && course?.isCertifying) {
    // Sur un cours certifiant, "Terminé" = cert émis (pas juste défilement)
    const cert = await prisma.document.findFirst({
      where: {
        consultantId: session.user.id,
        tags: { hasEvery: ["certificat", `course:${courseId}`] }
      },
      select: { id: true }
    });
    completed = !!cert;
  }

  await prisma.userCourseProgress.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    create: {
      userId: session.user.id,
      courseId,
      lastSlide: slidePosition,
      completedAt: completed ? new Date() : null
    },
    update: {
      lastSlide: slidePosition,
      completedAt: completed ? new Date() : undefined
    }
  });
  return { ok: true, completed };
}

/**
 * Bascule la visibilité d'un cours (active on/off). Réservé aux admins qui ont
 * la permission `training.manage`. Rend le cours invisible dans le catalogue
 * consultant SANS supprimer les données (progression, quiz) — utile pour
 * cacher un cours obsolète ou en cours de refonte.
 */
export async function toggleCourseVisibility(courseId: string) {
  const session = await requirePermission("training.manage");
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, active: true } });
  if (!course) throw new Error("Cours introuvable");
  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { active: !course.active }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Course",
    entityId: course.id,
    message: `Cours "${course.title}" ${updated.active ? "publié" : "masqué"}`
  });
  revalidatePath("/training");
  return { ok: true, active: updated.active };
}

/**
 * Supprime définitivement un cours du catalogue.
 * Cascade : supprime les slides, la progression, les tentatives.
 * NE supprime PAS les certificats émis (Documents) — ils restent l'archive
 * historique des consultants qui ont réussi.
 * Réservé aux admins avec training.manage.
 */
/**
 * Définit (ou supprime) le cours prérequis d'un autre cours.
 * Passe null pour supprimer la dépendance.
 * Réservé aux admins.
 */
export async function setCoursePrerequisite(courseId: string, prerequisiteCourseId: string | null) {
  const session = await requirePermission("training.manage");
  if (prerequisiteCourseId === courseId) throw new Error("Un cours ne peut pas être son propre prérequis.");

  const [course, prereq] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    prerequisiteCourseId
      ? prisma.course.findUnique({ where: { id: prerequisiteCourseId }, select: { id: true, title: true, prerequisiteCourseId: true } })
      : Promise.resolve(null)
  ]);
  if (!course) throw new Error("Cours introuvable");
  if (prerequisiteCourseId && !prereq) throw new Error("Cours prérequis introuvable");

  // Anti-cycle : parcourir la chaîne des prérequis du prereq pour vérifier
  // qu'on ne rencontre pas courseId (sinon on créerait une boucle).
  if (prereq) {
    let cursor: { id: string; prerequisiteCourseId: string | null } | null = { id: prereq.id, prerequisiteCourseId: prereq.prerequisiteCourseId };
    const seen = new Set<string>();
    while (cursor) {
      if (cursor.id === courseId) throw new Error("Cycle détecté : cette dépendance créerait une boucle.");
      if (seen.has(cursor.id)) break;
      seen.add(cursor.id);
      if (!cursor.prerequisiteCourseId) break;
      cursor = await prisma.course.findUnique({
        where: { id: cursor.prerequisiteCourseId },
        select: { id: true, prerequisiteCourseId: true }
      });
    }
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { prerequisiteCourseId }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Course",
    entityId: course.id,
    message: prerequisiteCourseId
      ? `Prérequis défini pour "${course.title}" → "${prereq!.title}"`
      : `Prérequis retiré pour "${course.title}"`
  });
  revalidatePath("/training");
  return { ok: true };
}

/**
 * Change la couche IT/OT/UNS d'un cours (drag-drop).
 * layerKey null → cours placé automatiquement selon le mapping par défaut.
 */
export async function setCourseLayer(courseId: string, layerKey: string | null) {
  await requirePermission("training.manage");
  const validLayers = ["cloud", "mes", "uns", "scada", "control", "field"];
  if (layerKey && !validLayers.includes(layerKey)) {
    throw new Error(`Couche invalide : ${layerKey}`);
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { layerKey }
  });
  revalidatePath("/training");
  return { ok: true };
}

export async function deleteCourse(courseId: string) {
  const session = await requirePermission("training.manage");
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true, _count: { select: { slides: true } } }
  });
  if (!course) throw new Error("Cours introuvable");

  // Prisma cascade delete : Course → CourseSlide (onDelete Cascade)
  //                       → UserCourseProgress (onDelete Cascade)
  //                       → UserQuizAttempt (via CourseSlide onDelete Cascade)
  // Les Documents (certificats) NE sont PAS cascadés → archives préservées.
  await prisma.course.delete({ where: { id: courseId } });

  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Course",
    entityId: course.id,
    message: `Cours "${course.title}" (${course.slug}) supprimé — ${course._count.slides} slides + progression + tentatives effacées. Certificats préservés.`
  });
  revalidatePath("/training");
  return { ok: true, deletedCourse: course.title, slidesDeleted: course._count.slides };
}
