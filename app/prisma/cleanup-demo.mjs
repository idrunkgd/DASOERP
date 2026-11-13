// Script one-shot pour PURGER toutes les données Jean Démo de prod.
// Usage (dans le terminal Coolify du conteneur app) :
//   node prisma/cleanup-demo.mjs
// Supprime :
//  - les users avec isDemo=true (cascade sur timesheets, expenses, leaves,
//    notifications, documents, etc.)
//  - les candidats avec le même marker si présent
//  - le véhicule 1-DEMO-42 (plaque spéciale seed)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { isDemo: true },
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  console.log(`[cleanup-demo] ${users.length} user(s) démo à supprimer :`,
    users.map((u) => u.email).join(", ") || "(aucun)");
  for (const u of users) {
    await prisma.user.delete({ where: { id: u.id } }).catch((e) => {
      console.error(`  ✗ échec delete ${u.email}:`, e.message);
    });
    console.log(`  ✓ ${u.email}`);
  }

  // Véhicule fictif
  const v = await prisma.vehicle.findUnique({ where: { plate: "1-DEMO-42" } }).catch(() => null);
  if (v) {
    await prisma.vehicle.delete({ where: { id: v.id } }).catch((e) => {
      console.error("  ✗ échec delete vehicle 1-DEMO-42:", e.message);
    });
    console.log("  ✓ véhicule 1-DEMO-42 supprimé");
  }

  console.log("[cleanup-demo] terminé");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
