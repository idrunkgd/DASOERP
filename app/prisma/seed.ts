import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Dasolabs ERP...");

  // ---------- Users ----------
  const hash = (pwd: string) => bcrypt.hash(pwd, 10);
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dasolabs.com";
  const adminPwd   = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail, passwordHash: await hash(adminPwd),
      firstName: "Gérald", lastName: "De Vestele",
      role: Role.ADMIN, hourlyCost: 95, dailyCost: 750, weeklyCapacityH: 38,
      skills: ["leadership","sales","strategy"], joinedAt: new Date("2024-01-01")
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@dasolabs.com" },
    update: {},
    create: {
      email: "manager@dasolabs.com", passwordHash: await hash("Manager123!"),
      firstName: "Sophie", lastName: "Laurent",
      role: Role.MANAGER, hourlyCost: 80, dailyCost: 600, weeklyCapacityH: 38,
      photoUrl: "https://i.pravatar.cc/400?img=49",
      phone: "+32 479 12 34 56", city: "Bruxelles", seniority: "Tech Lead / PMO", yearsExperience: 12,
      spokenLanguages: ["FR","EN","NL"],
      skills: ["pmo","architecture","azure"], joinedAt: new Date("2024-03-01")
    }
  });

  const dev1 = await prisma.user.upsert({
    where: { email: "alex@dasolabs.com" },
    update: {},
    create: {
      email: "alex@dasolabs.com", passwordHash: await hash("Consult123!"),
      firstName: "Alex", lastName: "Mertens",
      role: Role.CONSULTANT, hourlyCost: 65, dailyCost: 500, weeklyCapacityH: 38,
      photoUrl: "https://i.pravatar.cc/400?img=12",
      phone: "+32 477 11 22 33", city: "Liège", seniority: "Senior", yearsExperience: 6,
      spokenLanguages: ["FR","EN"],
      skills: ["nodejs","typescript","postgresql","react"], joinedAt: new Date("2024-04-15")
    }
  });

  const dev2 = await prisma.user.upsert({
    where: { email: "yasmine@dasolabs.com" },
    update: {},
    create: {
      email: "yasmine@dasolabs.com", passwordHash: await hash("Consult123!"),
      firstName: "Yasmine", lastName: "Diallo",
      role: Role.CONSULTANT, hourlyCost: 70, dailyCost: 540, weeklyCapacityH: 38,
      photoUrl: "https://i.pravatar.cc/400?img=44",
      phone: "+32 478 99 88 77", city: "Bruxelles", seniority: "Senior Data Engineer", yearsExperience: 7,
      spokenLanguages: ["FR","EN","Wolof"],
      skills: ["python","data","industriel","scada"], joinedAt: new Date("2024-06-01")
    }
  });

  const finance = await prisma.user.upsert({
    where: { email: "finance@dasolabs.com" },
    update: {},
    create: {
      email: "finance@dasolabs.com", passwordHash: await hash("Finance123!"),
      firstName: "Pauline", lastName: "Martin",
      role: Role.FINANCE, hourlyCost: 55, dailyCost: 440, weeklyCapacityH: 19,
      joinedAt: new Date("2025-01-15")
    }
  });

  // ---------- ServiceProfiles ----------
  const profileSenior = await prisma.serviceProfile.upsert({
    where: { id: "_seed_senior" },
    update: {},
    create: { id: "_seed_senior", name: "Senior Developer", description: "5+ ans, autonome", hourlyCost: 65, dailyCost: 500, hourlySell: 110, dailySell: 850 }
  });
  const profileJunior = await prisma.serviceProfile.upsert({
    where: { id: "_seed_junior" }, update: {},
    create: { id: "_seed_junior", name: "Junior Developer", description: "<3 ans d'expérience", hourlyCost: 45, dailyCost: 350, hourlySell: 80, dailySell: 620 }
  });
  const profileLead = await prisma.serviceProfile.upsert({
    where: { id: "_seed_lead" }, update: {},
    create: { id: "_seed_lead", name: "Tech Lead / Architect", description: "Lead technique, architecture", hourlyCost: 85, dailyCost: 650, hourlySell: 125, dailySell: 950 }
  });
  const profileAnalyst = await prisma.serviceProfile.upsert({
    where: { id: "_seed_analyst" }, update: {},
    create: { id: "_seed_analyst", name: "Business Analyst", description: "Cadrage fonctionnel et écriture spec", hourlyCost: 55, dailyCost: 420, hourlySell: 95, dailySell: 720 }
  });

  // ---------- CostCenters ----------
  await prisma.costCenter.upsert({ where: { code: "SALES" }, update: {}, create: { code: "SALES", name: "Activité commerciale", kind: "SALES", countsAsBillable: false } });
  await prisma.costCenter.upsert({ where: { code: "LEAVE" }, update: {}, create: { code: "LEAVE", name: "Congés / absence", kind: "LEAVE", countsAsBillable: false } });
  await prisma.costCenter.upsert({ where: { code: "MTG" },   update: {}, create: { code: "MTG", name: "Réunions internes", kind: "MEETING", countsAsBillable: false } });
  await prisma.costCenter.upsert({ where: { code: "ADMIN" }, update: {}, create: { code: "ADMIN", name: "Tâches administratives", kind: "ADMIN", countsAsBillable: false } });
  await prisma.costCenter.upsert({ where: { code: "TRAIN" }, update: {}, create: { code: "TRAIN", name: "Formation interne", kind: "TRAINING", countsAsBillable: false } });
  await prisma.costCenter.upsert({ where: { code: "RND" },   update: {}, create: { code: "RND", name: "Recherche & développement", kind: "RND", countsAsBillable: true } });

  // ---------- Companies ----------
  const acme = await prisma.company.upsert({
    where: { vatNumber: "BE0500.123.456" },
    update: {},
    create: {
      name: "ACME Industries", vatNumber: "BE0500.123.456",
      website: "https://acme-industries.be", sector: "Manufacturing", size: "200-500",
      status: "CLIENT", source: "LinkedIn",
      street: "Avenue de l'Industrie 12", postalCode: "4000", city: "Liège", country: "Belgique",
      ownerId: admin.id
    }
  });

  const beta = await prisma.company.upsert({
    where: { vatNumber: "BE0789.654.321" },
    update: {},
    create: {
      name: "Beta Logistics", vatNumber: "BE0789.654.321",
      website: "https://beta-logistics.be", sector: "Logistics", size: "50-200",
      status: "CLIENT", source: "Recommandation",
      street: "Rue du Port 88", postalCode: "1000", city: "Bruxelles", country: "Belgique",
      ownerId: manager.id
    }
  });

  const prospect = await prisma.company.upsert({
    where: { vatNumber: "BE0444.555.666" },
    update: {},
    create: {
      name: "Gamma Energie", vatNumber: "BE0444.555.666",
      sector: "Énergie", size: "1000+", status: "PROSPECT",
      street: "Boulevard du Souverain 100", postalCode: "1170", city: "Bruxelles", country: "Belgique",
      ownerId: admin.id
    }
  });

  await prisma.company.upsert({
    where: { vatNumber: "BE0111.222.333" },
    update: {},
    create: {
      name: "CloudSupplier SA", vatNumber: "BE0111.222.333",
      sector: "Cloud", size: "10-50", status: "SUPPLIER", country: "Belgique"
    }
  });

  // ---------- Contacts ----------
  const ctxAcme = await prisma.contact.create({
    data: {
      firstName: "Marc", lastName: "Devigne", email: "marc.devigne@acme-industries.be",
      phone: "+32 4 220 11 22", jobTitle: "CTO", companyId: acme.id, ownerId: admin.id,
      tags: ["décideur","tech"]
    }
  });
  await prisma.contact.create({
    data: {
      firstName: "Émilie", lastName: "Lambert", email: "e.lambert@acme-industries.be",
      jobTitle: "Procurement Manager", companyId: acme.id, ownerId: manager.id, tags: ["achats"]
    }
  });
  const ctxBeta = await prisma.contact.create({
    data: {
      firstName: "Karim", lastName: "El Mansouri", email: "karim@beta-logistics.be",
      phone: "+32 2 555 33 44", jobTitle: "CIO", companyId: beta.id, ownerId: manager.id,
      tags: ["décideur"]
    }
  });
  await prisma.contact.create({
    data: { firstName: "Lise", lastName: "Verhoeven", email: "lise.verhoeven@gamma.be", jobTitle: "Innovation Manager", companyId: prospect.id, ownerId: admin.id, tags: ["prospect","innovation"] }
  });

  // ---------- Offers ----------
  const offerYear = new Date().getFullYear();
  const o1 = await prisma.offer.create({
    data: {
      reference: `OFF-${offerYear}-0001`, title: "Refonte plateforme MES — phase 1",
      companyId: acme.id, ownerId: admin.id, status: "WON", probability: 100,
      description: "Audit, design et MEP d'un MES sur mesure pour 2 lignes de production.",
      sentAt: new Date(offerYear, 0, 15),
      contacts: { create: [{ contactId: ctxAcme.id }] },
      lines: { create: [
        { description: "Analyse fonctionnelle", type: "SERVICE", profileId: profileAnalyst.id, quantity: 8, unit: "day", unitSellPrice: 720, unitCost: 420, position: 1 },
        { description: "Développement backend & API", type: "SERVICE", profileId: profileSenior.id, quantity: 25, unit: "day", unitSellPrice: 850, unitCost: 500, position: 2 },
        { description: "Développement UI opérateurs", type: "SERVICE", profileId: profileJunior.id, quantity: 18, unit: "day", unitSellPrice: 620, unitCost: 350, position: 3 },
        { description: "Licences plateforme (12 mois)", type: "OTHER", quantity: 12, unit: "month", unitSellPrice: 350, unitCost: 0, marginPctInput: 30, position: 4 }
      ] },
      milestones: { create: [
        { label: "Acompte 30% à la commande", percentage: 30, amount: 16500, expectedAt: new Date(offerYear, 0, 25), trigger: "Signature du bon de commande", status: "PAID", transmittedAt: new Date(offerYear, 0, 26), paidAt: new Date(offerYear, 1, 10) },
        { label: "Livraison phase 1 (40%)", percentage: 40, amount: 22000, expectedAt: new Date(offerYear, 2, 30), trigger: "PV de recette pilote", status: "TRANSMITTED", transmittedAt: new Date(offerYear, 2, 31) },
        { label: "Solde 30%", percentage: 30, amount: 16500, expectedAt: new Date(offerYear, 5, 30), trigger: "Recette finale", status: "PLANNED" }
      ] }
    }
  });

  const o2 = await prisma.offer.create({
    data: {
      reference: `OFF-${offerYear}-0002`, title: "Optimisation tournées WMS",
      companyId: beta.id, ownerId: manager.id, status: "NEGOTIATION", probability: 60,
      description: "Algorithmes d'optimisation et tableau de bord temps réel pour la logistique B2B.",
      sentAt: new Date(offerYear, 1, 18), expectedDecisionAt: new Date(offerYear, 4, 1),
      contacts: { create: [{ contactId: ctxBeta.id }] },
      lines: { create: [
        { description: "Cadrage & POC", type: "SERVICE", profileId: profileLead.id, quantity: 10, unit: "day", unitSellPrice: 950, unitCost: 650, position: 1 },
        { description: "Module optimisation", type: "SERVICE", profileId: profileSenior.id, quantity: 30, unit: "day", unitSellPrice: 850, unitCost: 500, position: 2 },
        { description: "Maintenance Y1 (forfait)", type: "OTHER", quantity: 1, unit: "year", unitSellPrice: 8500, unitCost: 0, marginPctInput: 50, position: 3 }
      ] },
      milestones: { create: [
        { label: "Cadrage", percentage: 25, amount: 11375, expectedAt: new Date(offerYear, 4, 30), status: "PLANNED" },
        { label: "Livraison", percentage: 65, amount: 29575, expectedAt: new Date(offerYear, 7, 30), status: "PLANNED" },
        { label: "Solde", percentage: 10, amount: 4550, expectedAt: new Date(offerYear, 9, 15), status: "PLANNED" }
      ] }
    }
  });

  await prisma.offer.create({
    data: {
      reference: `OFF-${offerYear}-0003`, title: "Audit infra & cybersécurité",
      companyId: prospect.id, ownerId: admin.id, status: "SENT", probability: 35,
      sentAt: new Date(offerYear, 3, 1), expectedDecisionAt: new Date(offerYear, 4, 15),
      lines: { create: [
        { description: "Audit complet sites de production", type: "SERVICE", profileId: profileLead.id, quantity: 12, unit: "day", unitSellPrice: 950, unitCost: 650, position: 1 }
      ] }
    }
  });

  // Recalcule + transition WON → projet
  await import("../src/server/services/offer-service").then(async (m) => {
    await m.recomputeOfferTotals(o1.id);
    await m.recomputeOfferTotals(o2.id);
    // Re-WIN avec création projet (idempotent : si projet existe déjà on ne refait rien)
    const fresh = await prisma.offer.findUnique({ where: { id: o1.id }, include: { project: true } });
    if (!fresh?.project) {
      await m.changeOfferStatus({ actorId: admin.id, offerId: o1.id, newStatus: "WON" });
    }
  });

  // ---------- Récupérer le projet créé ----------
  const projectAcme = await prisma.project.findFirst({ where: { offerId: o1.id } });
  if (projectAcme) {
    await prisma.project.update({
      where: { id: projectAcme.id },
      data: {
        status: "ACTIVE", managerId: manager.id,
        plannedStart: new Date(offerYear, 1, 1), plannedEnd: new Date(offerYear, 5, 30),
        actualStart: new Date(offerYear, 1, 5),
        budgetTimeH: 350, budgetCost: 26000, description: "Phase 1 du MES ACME."
      }
    });
    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAcme.id, userId: dev1.id, roleLabel: "Lead developer" },
        { projectId: projectAcme.id, userId: dev2.id, roleLabel: "Data engineer" }
      ],
      skipDuplicates: true
    });
    // Timesheets
    const week = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(week); d.setDate(week.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      await prisma.timesheetEntry.create({
        data: {
          userId: dev1.id, projectId: projectAcme.id, date: d, hours: 7,
          activityType: "DEVELOPMENT", description: "Backend MES",
          status: "APPROVED", validatorId: manager.id, validatedAt: new Date(),
          computedCost: 7 * 65
        }
      });
      if (i < 5) {
        await prisma.timesheetEntry.create({
          data: {
            userId: dev2.id, projectId: projectAcme.id, date: d, hours: 6,
            activityType: "ANALYSIS", description: "Modèle data lignes",
            status: "APPROVED", validatorId: manager.id, validatedAt: new Date(),
            computedCost: 6 * 70
          }
        });
      }
    }
    // Achats
    await prisma.purchase.create({
      data: {
        projectId: projectAcme.id, supplierId: (await prisma.company.findFirst({ where: { name: "CloudSupplier SA" } }))?.id ?? null,
        description: "Cluster cloud — preprod 6 mois", category: "LICENSE",
        amount: 4200, purchaseDate: new Date(offerYear, 1, 10), status: "PAID", createdById: admin.id
      }
    });
    await prisma.purchase.create({
      data: {
        projectId: projectAcme.id,
        description: "Capteurs IoT pilote (lot 20)", category: "HARDWARE",
        amount: 3800, purchaseDate: new Date(offerYear, 2, 5), status: "RECEIVED", createdById: manager.id
      }
    });
    // Planning
    const start = new Date(); start.setHours(0,0,0,0);
    // Alex en mission longue : 6 semaines depuis aujourd'hui
    await prisma.planningEntry.create({
      data: {
        userId: dev1.id, projectId: projectAcme.id,
        startDate: start, endDate: new Date(start.getTime() + 42 * 24 * 3600 * 1000),
        hoursPerDay: 7, activityType: "DEVELOPMENT", comment: "Mission MES backend"
      }
    });
    // Yasmine en mission courte (1 semaine) — elle redeviendra disponible bientôt
    await prisma.planningEntry.create({
      data: {
        userId: dev2.id, projectId: projectAcme.id,
        startDate: start, endDate: new Date(start.getTime() + 7 * 24 * 3600 * 1000),
        hoursPerDay: 4, activityType: "ANALYSIS", comment: "Modélisation lignes"
      }
    });
    // Yasmine a une mission programmée 1 mois plus tard
    await prisma.planningEntry.create({
      data: {
        userId: dev2.id, projectId: projectAcme.id,
        startDate: new Date(start.getTime() + 30 * 24 * 3600 * 1000),
        endDate:   new Date(start.getTime() + 90 * 24 * 3600 * 1000),
        hoursPerDay: 5, activityType: "DEVELOPMENT", comment: "Phase 2 MES"
      }
    });
    await import("../src/server/services/project-service").then(async (m) => { await m.recomputeProject(projectAcme.id); });
  }

  // ---------- Consultance : candidats + mission + présentations ----------
  const cand1 = await prisma.candidate.upsert({
    where: { id: "_seed_cand1" }, update: {},
    create: {
      id: "_seed_cand1", firstName: "Nadia", lastName: "Bertrand",
      email: "nadia.bertrand@example.com", phone: "+32 478 11 22 33",
      linkedinUrl: "https://linkedin.com/in/nadia-bertrand",
      photoUrl: "https://i.pravatar.cc/400?img=47",
      city: "Liège", source: "LinkedIn",
      skills: ["java", "spring boot", "kafka", "kubernetes"], spokenLanguages: ["FR","EN"],
      yearsExperience: 8, seniority: "Senior",
      dailyCost: 480, hourlyCost: 60, minDailyRate: 520, status: "ACTIVE",
      ownerId: admin.id
    }
  });
  const cand2 = await prisma.candidate.upsert({
    where: { id: "_seed_cand2" }, update: {},
    create: {
      id: "_seed_cand2", firstName: "Idriss", lastName: "Bouali",
      email: "idriss@example.com",
      photoUrl: "https://i.pravatar.cc/400?img=15",
      city: "Bruxelles", source: "Recommandation",
      skills: ["java", "spring", "AWS"], spokenLanguages: ["FR","EN","NL"],
      yearsExperience: 5, seniority: "Confirmé",
      dailyCost: 420, status: "ACTIVE", ownerId: manager.id
    }
  });
  const cand3 = await prisma.candidate.upsert({
    where: { id: "_seed_cand3" }, update: {},
    create: {
      id: "_seed_cand3", firstName: "Camille", lastName: "Dubois",
      email: "camille.dubois@example.com",
      photoUrl: "https://i.pravatar.cc/400?img=23",
      city: "Namur",
      skills: ["python","data engineering","spark"], spokenLanguages: ["FR","EN"],
      yearsExperience: 4, seniority: "Confirmé",
      dailyCost: 400, status: "UNAVAILABLE", availableFrom: new Date(2026, 8, 1), ownerId: admin.id
    }
  });

  const mission1 = await prisma.missionRequest.upsert({
    where: { id: "_seed_mission1" }, update: {},
    create: {
      id: "_seed_mission1", reference: "DEM-2026-0001",
      title: "Senior Backend Java — plateforme MES Beta Logistics",
      description: "Recherche un dev senior Java/Spring pour renforcer l'équipe backend MES sur 6 mois, démarrage rapide.",
      status: "PRESENTING",
      companyId: beta.id, contactId: ctxBeta.id, ownerId: admin.id,
      requiredSkills: ["java","spring boot","kafka"], seniority: "Senior 5+ ans",
      workLocation: "Hybride Bruxelles 2j/sem",
      startDate: new Date(2026, 4, 15), endDate: new Date(2026, 10, 30),
      estimatedDays: 130, targetDailyRate: 850, maxDailyRate: 950
    }
  });

  await prisma.missionApplication.upsert({
    where: { missionRequestId_candidateId: { missionRequestId: mission1.id, candidateId: cand1.id } },
    update: {},
    create: {
      missionRequestId: mission1.id, candidateId: cand1.id,
      proposedDailyRate: 880, dailyCost: 480, status: "INTERVIEWED",
      notes: "Profil très solide, déjà bossé sur du MES.",
      interviews: { create: [
        { scheduledAt: new Date(Date.now() - 5 * 86400_000), kind: "VIDEO", interviewers: "Karim, Sophie", outcome: "PASSED", feedback: "Très bonne maîtrise Java, communication claire." },
        { scheduledAt: new Date(Date.now() - 1 * 86400_000), kind: "TECHNICAL", interviewers: "Dasolabs senior", outcome: "PASSED", feedback: "Test live OK, bonne approche pragmatique." }
      ]}
    }
  });
  await prisma.missionApplication.upsert({
    where: { missionRequestId_candidateId: { missionRequestId: mission1.id, candidateId: cand2.id } },
    update: {},
    create: {
      missionRequestId: mission1.id, candidateId: cand2.id,
      proposedDailyRate: 780, dailyCost: 420, status: "PRESENTED",
      notes: "Backup si Nadia indisponible."
    }
  });
  // Consultant interne (Yasmine) également présentée sur la même demande — démo de la dualité
  await prisma.missionApplication.upsert({
    where: { missionRequestId_consultantId: { missionRequestId: mission1.id, consultantId: dev2.id } },
    update: {},
    create: {
      missionRequestId: mission1.id, consultantId: dev2.id,
      proposedDailyRate: 920, dailyCost: 540, status: "SHORTLISTED",
      notes: "Consultante interne disponible à partir de juin, expertise data engineering."
    }
  });

  // ---------- Entretiens internes (suivi consultants) ----------
  await prisma.consultantReview.create({
    data: {
      subjectId: dev1.id, conductedById: manager.id, scheduledAt: new Date(Date.now() - 30 * 86400_000),
      kind: "CHECK_IN", outcome: "COMPLETED",
      feedback: "Bonne montée en compétence sur le projet ACME, autonome.",
      goals: "Continuer la formation Kafka. Prendre un sujet d'archi sur le prochain sprint.",
      privateNotes: "Profil à fidéliser, augmenter en avril."
    }
  });
  await prisma.consultantReview.create({
    data: {
      subjectId: dev1.id, conductedById: manager.id, scheduledAt: new Date(Date.now() + 30 * 86400_000),
      kind: "ANNUAL_REVIEW", outcome: "SCHEDULED"
    }
  });
  await prisma.consultantReview.create({
    data: {
      subjectId: dev2.id, conductedById: admin.id, scheduledAt: new Date(Date.now() - 7 * 86400_000),
      kind: "ONBOARDING", outcome: "COMPLETED",
      feedback: "Onboarding bien passé, intégrée dans l'équipe ACME."
    }
  });

  // ---------- Missions T&M (entité distincte des Projets forfait) ----------
  // On contractualise une mission entre Nadia (qui devient consultante) et Beta Logistics
  // pour démontrer le flux Demande → Application SELECTED → Mission.
  // (Pour la démo on ne crée pas le User Nadia ; on assigne la mission à dev1)
  await prisma.mission.upsert({
    where: { reference: "MIS-2026-0001" },
    update: {},
    create: {
      reference: "MIS-2026-0001",
      title: "Senior Backend Java — plateforme MES Beta Logistics",
      missionRequestId: mission1.id,
      consultantId: dev1.id,
      companyId: beta.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 130 * 86400_000),
      estimatedDays: 130,
      dailyRate: 880, dailyCost: 480,
      workLocation: "Hybride Bruxelles 2j/sem",
      status: "ACTIVE",
      billingFrequency: "MONTHLY",
      notes: "Mission démo — Alex Mertens placé chez Beta Logistics."
    }
  });
  // Et une mission programmée (PLANNED) pour Yasmine, dans 30 jours
  await prisma.mission.upsert({
    where: { reference: "MIS-2026-0002" },
    update: {},
    create: {
      reference: "MIS-2026-0002",
      title: "Data Engineer — pipelines SCADA",
      missionRequestId: mission1.id,    // démo : on réutilise la même demande
      consultantId: dev2.id,
      companyId: acme.id,
      startDate: new Date(Date.now() + 30 * 86400_000),
      endDate:   new Date(Date.now() + 90 * 86400_000),
      estimatedDays: 60,
      dailyRate: 920, dailyCost: 540,
      workLocation: "Onsite Liège",
      status: "PLANNED",
      billingFrequency: "MONTHLY"
    }
  });

  // ---------- Groupes d'accès système (basés sur les rôles, modifiables) ----------
  const SYSTEM_GROUPS: { name: string; description: string; permissions: string[] }[] = [
    {
      name: "Visiteur", description: "Aucun accès aux modules — consultation de son propre profil uniquement",
      permissions: []
    },
    {
      name: "Administrateur", description: "Accès complet à toutes les fonctionnalités",
      permissions: ["users.manage","settings.manage","companies.read","companies.write","contacts.read","contacts.write","offers.read","offers.write","projects.read","projects.write","timesheet.self.write","timesheet.validate","purchases.read","purchases.write","planning.read","planning.write","finance.read","finance.write","consulting.read","consulting.write"]
    },
    {
      name: "Manager", description: "Pilotage delivery, projets, équipe, validation timesheets",
      permissions: ["companies.read","companies.write","contacts.read","contacts.write","offers.read","offers.write","projects.read","projects.write","timesheet.self.write","timesheet.validate","purchases.read","purchases.write","planning.read","planning.write","finance.read","consulting.read","consulting.write"]
    },
    {
      name: "Commercial", description: "Pipeline commercial, offres, contacts",
      permissions: ["companies.read","companies.write","contacts.read","contacts.write","offers.read","offers.write","projects.read","timesheet.self.write","planning.read","finance.read","consulting.read","consulting.write"]
    },
    {
      name: "Consultant", description: "Saisie timesheet, consultation projets de l'équipe",
      permissions: ["companies.read","contacts.read","projects.read","timesheet.self.write","planning.read","purchases.read"]
    },
    {
      name: "Finance / Backoffice", description: "Suivi facturations, achats, exports",
      permissions: ["companies.read","contacts.read","offers.read","projects.read","purchases.read","purchases.write","finance.read","finance.write","planning.read","timesheet.self.write"]
    },
    {
      name: "Lecture seule", description: "Consultation sans modification",
      permissions: ["companies.read","contacts.read","offers.read","projects.read","purchases.read","planning.read","finance.read","consulting.read"]
    }
  ];
  for (const g of SYSTEM_GROUPS) {
    await prisma.accessGroup.upsert({
      where: { name: g.name },
      update: { permissions: g.permissions, description: g.description, isSystem: true },
      create: { name: g.name, description: g.description, permissions: g.permissions, isSystem: true }
    });
  }
  // Assignations par défaut des seeds (sans cela, ils retomberaient en Visiteur)
  const groupByName = Object.fromEntries(
    (await prisma.accessGroup.findMany()).map(g => [g.name, g.id])
  );
  await prisma.user.update({ where: { id: admin.id   }, data: { accessGroupId: groupByName["Administrateur"] } });
  await prisma.user.update({ where: { id: manager.id }, data: { accessGroupId: groupByName["Manager"] } });
  await prisma.user.update({ where: { id: dev1.id    }, data: { accessGroupId: groupByName["Consultant"] } });
  await prisma.user.update({ where: { id: dev2.id    }, data: { accessGroupId: groupByName["Consultant"] } });
  await prisma.user.update({ where: { id: finance.id }, data: { accessGroupId: groupByName["Finance / Backoffice"] } });

  // ---------- Catalogue Compétences ----------
  const SKILLS: { name: string; category: string }[] = [
    // Backend
    { name: "java", category: "Backend" },
    { name: "spring boot", category: "Backend" },
    { name: "kotlin", category: "Backend" },
    { name: "nodejs", category: "Backend" },
    { name: "typescript", category: "Backend" },
    { name: "python", category: "Backend" },
    { name: "go", category: "Backend" },
    { name: "c#", category: "Backend" },
    // Frontend
    { name: "react", category: "Frontend" },
    { name: "next.js", category: "Frontend" },
    { name: "vue", category: "Frontend" },
    { name: "angular", category: "Frontend" },
    { name: "svelte", category: "Frontend" },
    { name: "tailwind", category: "Frontend" },
    // Data
    { name: "postgresql", category: "Data" },
    { name: "mysql", category: "Data" },
    { name: "mongodb", category: "Data" },
    { name: "kafka", category: "Data" },
    { name: "spark", category: "Data" },
    { name: "airflow", category: "Data" },
    // Cloud / DevOps
    { name: "aws", category: "Cloud / DevOps" },
    { name: "azure", category: "Cloud / DevOps" },
    { name: "gcp", category: "Cloud / DevOps" },
    { name: "kubernetes", category: "Cloud / DevOps" },
    { name: "docker", category: "Cloud / DevOps" },
    { name: "terraform", category: "Cloud / DevOps" },
    { name: "ci/cd", category: "Cloud / DevOps" },
    // Industriel
    { name: "scada", category: "Industriel" },
    { name: "mes", category: "Industriel" },
    { name: "opc-ua", category: "Industriel" },
    { name: "automate", category: "Industriel" },
    // Soft skills
    { name: "leadership", category: "Soft skills" },
    { name: "communication", category: "Soft skills" },
    { name: "gestion projet", category: "Soft skills" },
    { name: "scrum", category: "Soft skills" },
    { name: "analyse fonctionnelle", category: "Soft skills" }
  ];
  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { name: s.name },
      update: { category: s.category },
      create: { name: s.name, category: s.category, active: true }
    });
  }

  console.log("✅ Seed terminé.");
  console.log(`   👤 Admin    : ${adminEmail} / ${adminPwd}`);
  console.log("   👤 Manager  : manager@dasolabs.com / Manager123!");
  console.log("   👤 Conseil. : alex@dasolabs.com / Consult123!");
  console.log("   👤 Conseil. : yasmine@dasolabs.com / Consult123!");
  console.log("   👤 Finance  : finance@dasolabs.com / Finance123!");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
