// Seed idempotent — crée un consultant fictif "Jean Démo" avec des données
// réalistes dans chaque module (timesheet, expenses, sick leave, congé,
// formations, cost centers). Sert à démontrer le HUB à des employés sans
// impacter les vraies données.
//
// Marqueur User.isDemo = true → filtrable des rapports finance / exports.
//
// Exécuté au démarrage du conteneur (voir CMD Dockerfile). Idempotent : détecte
// l'existant et refresh les data pour rester "à jour" (dates glissantes autour
// d'aujourd'hui).

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_EMAIL = "jean.demo@dasolabs.be";
const DEMO_PWD_HASH = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01"; // hash bidon — login désactivé

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

async function seedDemoConsultant() {
  console.log("[seed-demo] démarrage");

  // ─── 1. Upsert user Jean Démo ─────────────────────────────────────────
  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash: DEMO_PWD_HASH,
      firstName: "Jean",
      lastName: "Démo",
      role: "CONSULTANT",
      active: true,
      isDemo: true,
      city: "Bruxelles",
      seniority: "Confirmé",
      yearsExperience: 4,
      spokenLanguages: ["Français", "Anglais", "Néerlandais"],
      hourlyCost: 45,
      dailyCost: 360,
      dailyRate: 650,
      weeklyCapacityH: 38,
      phone: "+32 4 00 00 00 00",
      country: "Belgique",
      postalCode: "1000",
      address: "Rue Fictive 42",
      skills: ["Siemens S7-1500", "TIA Portal", "WinCC", "OPC UA", "AVEVA Historian", "SQL Server"],
      joinedAt: daysAgo(400)
    },
    update: {
      isDemo: true,
      firstName: "Jean",
      lastName: "Démo",
      active: true,
      role: "CONSULTANT",
      hourlyCost: 45,
      dailyCost: 360,
      dailyRate: 650,
      skills: ["Siemens S7-1500", "TIA Portal", "WinCC", "OPC UA", "AVEVA Historian", "SQL Server"]
    }
  });
  console.log(`[seed-demo] user OK · id=${demo.id}`);

  // ─── 2. Reset des données démo (on ne veut pas empiler à chaque boot) ─
  await prisma.timesheetEntry.deleteMany({ where: { userId: demo.id } });
  await prisma.expenseReport.deleteMany({ where: { userId: demo.id } });
  await prisma.sickLeave.deleteMany({ where: { userId: demo.id } });
  await prisma.leaveRequest.deleteMany({ where: { userId: demo.id } });
  await prisma.userCourseProgress.deleteMany({ where: { userId: demo.id } });

  // ─── 3. Timesheet — 30 derniers jours ouvrés ──────────────────────────
  // Trouver un centre de coût existant + une mission ou un projet actif
  const [cc, mission, project] = await Promise.all([
    prisma.costCenter.findFirst({ where: { active: true } }),
    prisma.mission.findFirst({ where: { status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] } } }),
    prisma.project.findFirst({ where: { status: { in: ["TO_START", "ACTIVE", "ON_HOLD"] } } })
  ]);

  const tsEntries = [];
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue; // skip weekends
    // Alterne mission (8h) et centre de coût (formation, 2h)
    if (mission && i % 5 !== 0) {
      tsEntries.push({
        userId: demo.id, date: d, hours: 8,
        activityType: "DEVELOPMENT",
        description: "Développement SCADA — démo",
        status: i > 7 ? "APPROVED" : "SUBMITTED",
        missionId: mission.id
      });
    } else if (cc) {
      tsEntries.push({
        userId: demo.id, date: d, hours: 4,
        activityType: "TRAINING",
        description: "Formation interne · démo",
        status: i > 7 ? "APPROVED" : "DRAFT",
        costCenterId: cc.id
      });
    }
  }
  if (tsEntries.length > 0) {
    await prisma.timesheetEntry.createMany({ data: tsEntries });
    console.log(`[seed-demo] timesheet · ${tsEntries.length} entrées`);
  }

  // ─── 4. Expense reports — 4 notes variées ─────────────────────────────
  const expenses = [
    {
      userId: demo.id, date: daysAgo(3), category: "MEAL",
      description: "Restau client Zoetis · démo",
      amountHt: 45.00, vatAmount: 5.85, vatRate: 6, amountTtc: 50.85,
      status: "SUBMITTED", missionId: mission?.id ?? null
    },
    {
      userId: demo.id, date: daysAgo(10), category: "TRANSPORT",
      description: "Train Bruxelles-Anvers · démo",
      amountHt: 18.87, vatAmount: 1.13, vatRate: 6, amountTtc: 20.00,
      status: "APPROVED", missionId: mission?.id ?? null
    },
    {
      userId: demo.id, date: daysAgo(18), category: "ACCOMMODATION",
      description: "Hôtel Ibis Louvain · démo",
      amountHt: 95.00, vatAmount: 5.70, vatRate: 6, amountTtc: 100.70,
      status: "PAID", missionId: mission?.id ?? null
    },
    {
      userId: demo.id, date: daysAgo(1), category: "OTHER",
      description: "Petits fournitures bureau · démo",
      amountHt: 12.40, vatAmount: 2.60, vatRate: 21, amountTtc: 15.00,
      status: "DRAFT"
    }
  ];
  await prisma.expenseReport.createMany({ data: expenses });
  console.log(`[seed-demo] expenses · ${expenses.length} notes`);

  // ─── 5. Sick leave — arrêt passé de 2 jours ───────────────────────────
  await prisma.sickLeave.create({
    data: {
      userId: demo.id,
      startDate: daysAgo(45), endDate: daysAgo(44),
      reason: "Grippe hivernale · démo",
      notes: "Certificat médical déposé."
    }
  });
  console.log("[seed-demo] sick leave · 1 arrêt");

  // ─── 6. Leave requests — 1 congé passé approuvé + 1 à venir ───────────
  await prisma.leaveRequest.create({
    data: {
      userId: demo.id,
      startDate: daysAgo(30), endDate: daysAgo(26),
      days: 5, type: "ANNUAL",
      reason: "Vacances Alpes · démo",
      status: "APPROVED",
      submittedAt: daysAgo(60), approvedAt: daysAgo(55),
      missionId: mission?.id ?? null,
      clientApproved: !!mission
    }
  });
  await prisma.leaveRequest.create({
    data: {
      userId: demo.id,
      startDate: daysFromNow(20), endDate: daysFromNow(27),
      days: 5, type: "ANNUAL",
      reason: "Vacances Noël · démo",
      status: "SUBMITTED",
      submittedAt: new Date(),
      missionId: mission?.id ?? null
    }
  });
  console.log("[seed-demo] leaves · 2 demandes");

  // ─── 7. Solde de congés année courante ────────────────────────────────
  const year = new Date().getUTCFullYear();
  await prisma.leaveBalance.upsert({
    where: { userId_year_type: { userId: demo.id, year, type: "ANNUAL_LEGAL" } },
    create: { userId: demo.id, year, type: "ANNUAL_LEGAL", entitled: 20 },
    update: { entitled: 20 }
  });
  await prisma.leaveBalance.upsert({
    where: { userId_year_type: { userId: demo.id, year, type: "RTT" } },
    create: { userId: demo.id, year, type: "RTT", entitled: 12 },
    update: { entitled: 12 }
  });

  // ─── 8. Progression sur 2 formations ──────────────────────────────────
  const courses = await prisma.course.findMany({
    where: { slug: { in: ["ba4-securite-electrique", "materiel-plc-siemens", "programmation-tia-portal"] } },
    take: 3
  });
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    const slidesTotal = await prisma.courseSlide.count({ where: { courseId: c.id } });
    // Progression variée : le 1er terminé (100 %), 2ème à moitié, 3ème pas commencé
    const targetPos = i === 0 ? slidesTotal : i === 1 ? Math.floor(slidesTotal / 2) : 1;
    await prisma.userCourseProgress.create({
      data: {
        userId: demo.id, courseId: c.id,
        lastSlide: targetPos,
        completedAt: i === 0 ? daysAgo(7) : null
      }
    });
  }
  console.log(`[seed-demo] formations · ${courses.length} inscrites`);

  console.log("[seed-demo] terminé ✓");
  await prisma.$disconnect();
}

seedDemoConsultant().catch((e) => {
  console.error("[seed-demo] échec:", e?.message ?? e);
  prisma.$disconnect().finally(() => process.exit(0)); // exit 0 : ne pas bloquer le boot
});
