/**
 * Script de secours : reset le password admin et l'assigne au groupe
 * Administrateur. Idempotent (peut tourner plusieurs fois sans casser).
 *
 * Usage :
 *   export DATABASE_URL='postgresql://...neon-direct...'
 *   export SEED_ADMIN_EMAIL='admin@dasolabs.com'
 *   export SEED_ADMIN_PASSWORD='Admin123!'
 *   npx tsx prisma/reset-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient();
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@dasolabs.com";
  const pwd = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  console.log(`→ Reset admin: ${email}`);

  const hash = await bcrypt.hash(pwd, 10);

  // S'assure que le groupe Administrateur existe
  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: "Administrateur" },
    update: {},
    create: {
      name: "Administrateur",
      description: "Accès complet",
      isSystem: true,
      permissions: [
        "users.manage", "settings.manage",
        "companies.read", "companies.write",
        "contacts.read", "contacts.write",
        "offers.read", "offers.write",
        "projects.read", "projects.write",
        "timesheet.self.write", "timesheet.validate",
        "purchases.read", "purchases.write",
        "planning.read", "planning.write",
        "finance.read", "finance.write",
        "consulting.read", "consulting.write"
      ]
    }
  });

  // Upsert l'utilisateur admin avec le bon hash + groupe
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      accessGroupId: adminGroup.id,
      active: true
    },
    create: {
      email,
      passwordHash: hash,
      firstName: "Admin",
      lastName: "Dasolabs",
      role: "ADMIN",
      active: true,
      accessGroupId: adminGroup.id
    }
  });

  console.log(`✓ Admin reset OK : ${user.email}`);
  console.log(`  → groupe : ${adminGroup.name}`);
  console.log(`  → password : ${pwd}`);
  console.log(`  → role : ${user.role}`);
  console.log(`Connecte-toi sur l'app avec ces identifiants.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
