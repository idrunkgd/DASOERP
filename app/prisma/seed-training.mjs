// Auto-seed des cours de formation technique.
// Exécuté au démarrage du conteneur (voir CMD Dockerfile).
// Idempotent : upsert du cours + reset & recréation des slides à chaque fois.
//
// Ajouter un cours = déposer un JSON dans prisma/seed-data/<slug>.json au
// même format que aveva-course.json et l'ajouter à la liste COURSES.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const COURSES = [
  "aveva-system-platform-2023",
  "plc-programming",
  "tia-portal",
  "wincc-scada",
  "siemens-hardware",
  "industrial-protocols",
  "networking",
  "hivemq",
  "highbyte",
  "openshift",
  "sql-server",
  "ssrs",
  "aveva-report",
  "isa-standards",
  "gamp5",
  "csv-validation",
  "ba4-securite-electrique",
  "ba5-securite-electrique",
  "materiel-plc-siemens",
  "programmation-tia-portal",
  "wincc-scada",
  "aveva-report",
  "sql-server"
];

const prisma = new PrismaClient();

async function upsertCourse(slug) {
  const jsonPath = path.join(process.cwd(), "prisma", "seed-data", `${slug}.json`);
  let raw;
  try {
    raw = readFileSync(jsonPath, "utf8");
  } catch (e) {
    console.warn(`[seed-training] JSON introuvable pour ${slug} (${jsonPath}) : ${e?.code ?? ""} — skip`);
    return;
  }
  const data = JSON.parse(raw);
  // Prerequisite : le JSON peut suggérer une valeur initiale via
  // `prerequisiteSlug`, MAIS ce champ n'est utilisé qu'à la CRÉATION du cours.
  // À l'UPDATE (re-seed), on NE touche PAS à prerequisiteCourseId — c'est
  // Louise/Gérald qui gèrent les dépendances depuis l'UI HUB. Ça évite qu'un
  // reboot Docker écrase leurs choix.
  let initialPrerequisiteCourseId = null;
  if (data.prerequisiteSlug) {
    const prereq = await prisma.course.findUnique({
      where: { slug: data.prerequisiteSlug },
      select: { id: true }
    });
    if (prereq) initialPrerequisiteCourseId = prereq.id;
    else console.warn(`[seed-training] prerequisiteSlug ${data.prerequisiteSlug} introuvable pour ${data.slug} — sera nul à la création`);
  }
  const course = await prisma.$transaction(async (tx) => {
    const c = await tx.course.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null,
        isCertifying: data.isCertifying ?? false,
        passThreshold: data.passThreshold ?? 70,
        certificateWording: data.certificateWording ?? null,
        prerequisiteCourseId: initialPrerequisiteCourseId
      },
      update: {
        // ⚠ prerequisiteCourseId volontairement OMIS → géré depuis l'UI
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null,
        isCertifying: data.isCertifying ?? false,
        passThreshold: data.passThreshold ?? 70,
        certificateWording: data.certificateWording ?? null
      }
    });
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
        quiz: s.quiz
      }))
    });
    return c;
  });
  console.log(`[seed-training] ${course.title} — ${data.slides.length} slides upsert`);
}

async function main() {
  console.log("[seed-training] démarrage");
  for (const slug of COURSES) {
    try {
      await upsertCourse(slug);
    } catch (e) {
      // Ne pas bloquer le démarrage — juste logger
      console.error(`[seed-training] échec pour ${slug} :`, e?.message ?? e);
    }
  }
  console.log("[seed-training] terminé");
  await prisma.$disconnect();
}

main();
