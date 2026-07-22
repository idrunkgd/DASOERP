/**
 * Script standalone pour seeder uniquement le wiki formation.
 * Idempotent — upserts par (categoryKey, articleSlug).
 * Utile en prod ou pour rejouer sans risquer les autres seeds non-idempotents
 * (Offer, Project) qui violeraient des contraintes uniques.
 *
 * Usage :
 *   npx tsx prisma/seed-wiki-only.ts
 */
import { PrismaClient } from "@prisma/client";
import { seedWiki } from "./seed-wiki";

const prisma = new PrismaClient();

async function main() {
  await seedWiki(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
