// Reset one-shot des cours BA4 + BA5 pour TOUS les utilisateurs.
//
// Ce que ça fait :
//   1. Supprime UserCourseProgress pour BA4 + BA5 (avancement remis à zéro)
//   2. Supprime UserQuizAttempt pour toutes les slides de BA4 + BA5
//   3. Supprime les Documents "certificats" liés à ces cours
//      (identifiés par tag `certificat` + `course:<courseId>`)
//   4. Supprime les fichiers PDF correspondants sur disque
//
// À exécuter dans le conteneur Coolify :
//   docker exec <container> node prisma/reset-ba4-ba5.mjs
//
// Idempotent : si aucune progression / cert n'existe, ne fait rien et sort proprement.
//
// ⚠️ Effet destructif — non réversible. Utilise uniquement pour re-lancer la
// campagne BA4/BA5 après refonte du contenu (nouveau DSL, slides remaniées).

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";
const TARGET_SLUGS = ["ba4-securite-electrique", "ba5-securite-electrique"];

async function main() {
  console.log("[reset-ba] démarrage");

  const courses = await prisma.course.findMany({
    where: { slug: { in: TARGET_SLUGS } },
    select: { id: true, slug: true, title: true }
  });
  if (courses.length === 0) {
    console.log("[reset-ba] aucun cours BA4/BA5 trouvé — rien à faire");
    return;
  }
  console.log(`[reset-ba] cibles :`);
  courses.forEach((c) => console.log(`  - ${c.slug} (${c.id}) — ${c.title}`));

  const courseIds = courses.map((c) => c.id);

  // 1) Progression utilisateurs
  const delProg = await prisma.userCourseProgress.deleteMany({
    where: { courseId: { in: courseIds } }
  });
  console.log(`[reset-ba] progressions supprimées : ${delProg.count}`);

  // 2) Tentatives de quiz — via jointure sur les slides des cours cibles
  const targetSlides = await prisma.courseSlide.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true }
  });
  const slideIds = targetSlides.map((s) => s.id);
  const delAtt = await prisma.userQuizAttempt.deleteMany({
    where: { slideId: { in: slideIds } }
  });
  console.log(`[reset-ba] tentatives de quiz supprimées : ${delAtt.count}`);

  // 3) Documents "certificats" liés à ces cours + suppression fichiers disque
  const certTags = courseIds.map((id) => `course:${id}`);
  const certs = await prisma.document.findMany({
    where: {
      AND: [
        { tags: { has: "certificat" } },
        { tags: { hasSome: certTags } }
      ]
    },
    select: { id: true, storagePath: true, title: true, consultantId: true }
  });
  console.log(`[reset-ba] ${certs.length} certificat(s) à supprimer`);

  let filesRemoved = 0;
  let filesMissing = 0;
  for (const c of certs) {
    if (c.storagePath) {
      const absolute = path.join(STORAGE_ROOT, c.storagePath);
      try {
        await fs.unlink(absolute);
        filesRemoved++;
        // Retire aussi le sous-dossier <documentId>/ si vide
        try {
          await fs.rmdir(path.dirname(absolute));
        } catch { /* pas grave */ }
      } catch (e) {
        if (e && e.code === "ENOENT") filesMissing++;
        else console.warn(`[reset-ba] fichier ${absolute} : ${e?.message ?? e}`);
      }
    }
  }
  const delDocs = await prisma.document.deleteMany({
    where: { id: { in: certs.map((c) => c.id) } }
  });
  console.log(`[reset-ba] fichiers PDF supprimés : ${filesRemoved} (introuvables : ${filesMissing})`);
  console.log(`[reset-ba] documents supprimés en DB : ${delDocs.count}`);

  console.log("[reset-ba] ✅ terminé");
}

main()
  .catch((e) => {
    console.error("[reset-ba] échec :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
