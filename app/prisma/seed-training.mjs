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
  "industrial-protocols"
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
  const course = await prisma.$transaction(async (tx) => {
    const c = await tx.course.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null
      },
      update: {
        title: data.title,
        subtitle: data.subtitle ?? null,
        level: data.level ?? null,
        duration: data.duration ?? null
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
