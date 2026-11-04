import { prisma } from "@/lib/db";
import { Permission } from "@/lib/rbac";

export type ChatTool = {
  name: string;
  description: string;
  permission: Permission | "any";
  parameters: any;                      // JSON Schema
  run: (args: any, ctx: { userId: string; perms: Permission[] }) => Promise<any>;
};

function deny(perm: Permission): { error: string } {
  return { error: `Permission refusée : il faut « ${perm} » pour cet outil. Demandez à votre admin.` };
}

export const TOOLS: ChatTool[] = [
  // ---------- Entreprises ----------
  {
    name: "search_companies",
    description: "Recherche dans la base d'entreprises (clients, prospects, partenaires, fournisseurs). Filtres par nom, statut, secteur, ville. Renvoie au max 30 entreprises.",
    permission: "companies.read",
    parameters: {
      type: "object",
      properties: {
        name:    { type: "string", description: "Nom (ou partie du nom) de l'entreprise" },
        status:  { type: "string", enum: ["PROSPECT","CLIENT","PARTNER","SUPPLIER"], description: "Filtre par statut" },
        sector:  { type: "string", description: "Filtre par secteur" },
        city:    { type: "string", description: "Filtre par ville" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("companies.read")) return deny("companies.read");
      const where: any = {};
      if (args.name)   where.name   = { contains: args.name, mode: "insensitive" };
      if (args.status) where.status = args.status;
      if (args.sector) where.sector = { contains: args.sector, mode: "insensitive" };
      if (args.city)   where.city   = { contains: args.city, mode: "insensitive" };
      const list = await prisma.company.findMany({
        where, take: 30, orderBy: { name: "asc" },
        select: { id: true, name: true, vatNumber: true, status: true, sector: true, city: true, country: true, _count: { select: { contacts: true } } }
      });
      return {
        count: list.length,
        companies: list.map(c => ({
          name: c.name, vatNumber: c.vatNumber, status: c.status,
          sector: c.sector, city: c.city, country: c.country,
          contactsCount: c._count.contacts,
          link: `/companies/${c.id}`
        }))
      };
    }
  },

  // ---------- Contacts ----------
  {
    name: "search_contacts",
    description: "Recherche un contact par nom, prénom, email, fonction, ou par entreprise. Renvoie au max 30 contacts avec leur entreprise.",
    permission: "contacts.read",
    parameters: {
      type: "object",
      properties: {
        name:        { type: "string", description: "Nom ou prénom du contact" },
        email:       { type: "string", description: "Email (partiel)" },
        jobTitle:    { type: "string", description: "Fonction (ex: 'CTO', 'directeur')" },
        companyName: { type: "string", description: "Nom de l'entreprise du contact" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("contacts.read")) return deny("contacts.read");
      const where: any = {};
      const ors: any[] = [];
      if (args.name) ors.push(
        { firstName: { contains: args.name, mode: "insensitive" } },
        { lastName:  { contains: args.name, mode: "insensitive" } }
      );
      if (args.email)    ors.push({ email:    { contains: args.email,    mode: "insensitive" } });
      if (args.jobTitle) ors.push({ jobTitle: { contains: args.jobTitle, mode: "insensitive" } });
      if (ors.length) where.OR = ors;
      if (args.companyName) where.company = { name: { contains: args.companyName, mode: "insensitive" } };
      const list = await prisma.contact.findMany({
        where, take: 30, orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: { company: { select: { id: true, name: true } } }
      });
      return {
        count: list.length,
        contacts: list.map(c => ({
          name: `${c.firstName} ${c.lastName}`,
          email: c.email, phone: c.phone, jobTitle: c.jobTitle, status: c.status,
          company: c.company ? { name: c.company.name, link: `/companies/${c.company.id}` } : null,
          link: `/contacts/${c.id}`
        }))
      };
    }
  },

  // ---------- Comptes globaux ----------
  {
    name: "get_counts",
    description: "Renvoie des compteurs globaux pour avoir un aperçu chiffré rapide : nombre d'entreprises, contacts, candidats, consultants, missions, demandes ouvertes, offres en cours.",
    permission: "any",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_args, ctx) => {
      const tasks: any = {};
      if (ctx.perms.includes("companies.read"))  tasks.companies = prisma.company.count();
      if (ctx.perms.includes("contacts.read"))   tasks.contacts  = prisma.contact.count();
      if (ctx.perms.includes("consulting.read")) {
        tasks.candidates  = prisma.candidate.count({ where: { convertedToUser: { is: null } } });
        tasks.consultants = prisma.user.count({ where: { active: true, candidateProfile: { is: null } } });
        tasks.activeMissions  = prisma.mission.count({ where: { status: { in: ["ACTIVE","EXTENDED","PLANNED"] } } });
        tasks.openMissionRequests = prisma.missionRequest.count({ where: { status: { in: ["NEW","QUALIFYING","PRESENTING"] } } });
      }
      if (ctx.perms.includes("offers.read")) {
        tasks.openOffers = prisma.offer.count({ where: { status: { in: ["DRAFT","SENT","NEGOTIATION"] } } });
      }
      if (ctx.perms.includes("projects.read")) {
        tasks.activeProjects = prisma.project.count({ where: { status: { in: ["TO_START","ACTIVE"] } } });
      }
      const entries = await Promise.all(Object.entries(tasks).map(async ([k, v]) => [k, await (v as Promise<number>)]));
      return Object.fromEntries(entries);
    }
  },

  // ---------- Recherche candidats ----------
  {
    name: "search_candidates",
    description: "Recherche dans le vivier de candidats externes. Filtres : compétence (case-insensitive, match partiel), séniorité, ville, disponibilité, fourchette de TJM (min/max en €/jour).",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: {
        skill:        { type: "string", description: "compétence (ex: 'siemens', 'TIA Portal', 'java') — match case-insensitive partiel" },
        seniority:    { type: "string", description: "séniorité (JUNIOR, MEDIOR, SENIOR, EXPERT)" },
        city:         { type: "string", description: "ville" },
        availableOnly:{ type: "boolean", description: "uniquement les candidats ACTIVE (défaut true)" },
        tjmMin:       { type: "number", description: "TJM minimum en €/jour" },
        tjmMax:       { type: "number", description: "TJM maximum en €/jour" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const where: any = { convertedToUser: { is: null } };
      if (args.availableOnly !== false) where.status = "ACTIVE";
      if (args.seniority) where.seniority = { contains: args.seniority, mode: "insensitive" };
      if (args.city) where.city = { contains: args.city, mode: "insensitive" };
      // Filtre TJM : on utilise minDailyRate (ce que le candidat demande min) + dailyRate (facturable)
      if (args.tjmMin != null || args.tjmMax != null) {
        const range: any = {};
        if (args.tjmMin != null) range.gte = args.tjmMin;
        if (args.tjmMax != null) range.lte = args.tjmMax;
        where.OR = [{ dailyRate: range }, { minDailyRate: range }];
      }
      // On fetch un peu plus large car le filtre skill est case-insensitive en JS
      const raw = await prisma.candidate.findMany({
        where, take: args.skill ? 200 : 20,
        orderBy: [{ status: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, seniority: true, yearsExperience: true, city: true, skills: true, dailyCost: true, dailyRate: true, minDailyRate: true, availableFrom: true, status: true }
      });
      const needle = args.skill?.toLowerCase().trim();
      const list = needle
        ? raw.filter(c => (c.skills ?? []).some(s => s.toLowerCase().includes(needle)))
             .slice(0, 20)
        : raw;
      return {
        count: list.length,
        candidates: list.map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          seniority: c.seniority, yearsExperience: c.yearsExperience,
          city: c.city, skills: c.skills,
          tjmMin: c.minDailyRate ? Number(c.minDailyRate) : null,
          tjmFacturable: c.dailyRate ? Number(c.dailyRate) : null,
          dailyCost: c.dailyCost ? Number(c.dailyCost) : null,
          availableFrom: c.availableFrom?.toISOString().slice(0, 10) ?? null,
          status: c.status,
          link: `/candidates/${c.id}`
        }))
      };
    }
  },

  // ---------- Liste consultants Dasolabs ----------
  {
    name: "list_consultants",
    description: "Liste les consultants internes Dasolabs (employés) avec leur statut mission. Filtres optionnels par compétence, séniorité, ville, ou statut de disponibilité (on_mission / available / scheduled). Renvoie au max 50 profils.",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: {
        skill:        { type: "string", description: "compétence à filtrer (ex: 'java', 'react')" },
        seniority:    { type: "string", description: "filtre séniorité" },
        city:         { type: "string", description: "filtre ville" },
        missionState: { type: "string", enum: ["on_mission","available","scheduled","any"], description: "filtre par statut de mission. 'any' (défaut) = tous." }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const where: any = {
        active: true,
        candidateProfile: { is: null },
        role: { in: ["CONSULTANT", "MANAGER", "COMMERCIAL", "FINANCE", "ADMIN"] }
      };
      if (args.skill) where.skills = { has: String(args.skill).toLowerCase() };
      if (args.seniority) where.seniority = { contains: args.seniority, mode: "insensitive" };
      if (args.city) where.city = { contains: args.city, mode: "insensitive" };
      const list = await prisma.user.findMany({
        where, take: 50, orderBy: [{ lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, role: true, seniority: true, yearsExperience: true, city: true, skills: true, spokenLanguages: true, joinedAt: true }
      });
      const { getConsultantMissionStatusBatch } = await import("./mission-status");
      const statuses = await getConsultantMissionStatusBatch(list.map(u => u.id));
      let out = list.map(u => {
        const ms = statuses.get(u.id);
        return {
          id: u.id, name: `${u.firstName} ${u.lastName}`,
          role: u.role, seniority: u.seniority, yearsExperience: u.yearsExperience,
          city: u.city, skills: u.skills, spokenLanguages: u.spokenLanguages,
          joinedAt: u.joinedAt?.toISOString().slice(0,10) ?? null,
          missionState: ms?.state ?? "available",
          currentMission: ms?.state === "on_mission" ? {
            reference: ms.current[0].reference, client: ms.current[0].companyName,
            until: ms.latestEnd.toISOString().slice(0,10)
          } : null,
          nextMissionStart: ms?.state === "scheduled" ? ms.nextStart.toISOString().slice(0,10) : null,
          link: `/consultants/${u.id}`
        };
      });
      if (args.missionState && args.missionState !== "any") {
        out = out.filter(c => c.missionState === args.missionState);
      }
      return { count: out.length, consultants: out };
    }
  },

  // ---------- Statut consultant (par nom) ----------
  {
    name: "get_consultant_status",
    description: "Retourne le statut détaillé d'un consultant précis identifié par son nom ou prénom. Pour LISTER tous les consultants, utilisez plutôt list_consultants.",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Nom ou prénom du consultant" } },
      required: ["name"]
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const q = String(args.name ?? "").trim();
      if (!q) return { error: "Nom du consultant requis." };
      const users = await prisma.user.findMany({
        where: {
          active: true, candidateProfile: { is: null },
          OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }]
        },
        take: 5
      });
      if (users.length === 0) return { error: `Aucun consultant trouvé pour « ${q} »` };
      const { getConsultantMissionStatus } = await import("./mission-status");
      const out = await Promise.all(users.map(async u => {
        const ms = await getConsultantMissionStatus(u.id);
        return {
          id: u.id, name: `${u.firstName} ${u.lastName}`, seniority: u.seniority,
          state: ms.state,
          current: ms.state === "on_mission" ? ms.current.map(c => ({ reference: c.reference, company: c.companyName, until: c.endDate.toISOString().slice(0,10) })) : null,
          nextStart: ms.state === "scheduled" ? ms.nextStart.toISOString().slice(0,10) : null,
          link: `/consultants/${u.id}`
        };
      }));
      return { matches: out };
    }
  },

  // ---------- Missions T&M actives ----------
  {
    name: "list_active_missions",
    description: "Liste toutes les missions T&M en cours, optionnellement filtrées par client final, société de portage (intermédiaire) ou consultant.",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: {
        companyName:      { type: "string", description: "Nom du client final (où le consultant exécute la mission)" },
        intermediaryName: { type: "string", description: "Nom de la société de portage / intermédiaire (ex: Randstad)" },
        consultantName:   { type: "string" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const where: any = { status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] } };
      if (args.companyName) where.company = { name: { contains: args.companyName, mode: "insensitive" } };
      if (args.intermediaryName) where.intermediaryCompany = { name: { contains: args.intermediaryName, mode: "insensitive" } };
      if (args.consultantName) where.consultant = {
        OR: [{ firstName: { contains: args.consultantName, mode: "insensitive" } }, { lastName: { contains: args.consultantName, mode: "insensitive" } }]
      };
      const list = await prisma.mission.findMany({
        where, take: 30, orderBy: { endDate: "asc" },
        include: { company: { select: { name: true } }, intermediaryCompany: { select: { name: true } }, consultant: { select: { firstName: true, lastName: true } } }
      });
      return {
        count: list.length,
        missions: list.map(m => ({
          reference: m.reference, title: m.title,
          consultant: m.consultant ? `${m.consultant.firstName} ${m.consultant.lastName}` : null,
          client: m.company.name,
          intermediary: m.intermediaryCompany?.name ?? null,
          status: m.status,
          startDate: m.startDate.toISOString().slice(0,10),
          endDate: (m.actualEndDate ?? m.endDate).toISOString().slice(0,10),
          dailyRate: Number(m.dailyRate),
          link: `/missions/${m.id}`
        }))
      };
    }
  },

  // ---------- Demandes de mission ouvertes ----------
  {
    name: "list_open_mission_requests",
    description: "Liste les demandes de mission client ouvertes (NEW/QUALIFYING/PRESENTING).",
    permission: "consulting.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const list = await prisma.missionRequest.findMany({
        where: { status: { in: ["NEW", "QUALIFYING", "PRESENTING"] } },
        take: 30, orderBy: { createdAt: "desc" },
        include: { company: { select: { name: true } }, _count: { select: { applications: true } } }
      });
      return {
        count: list.length,
        requests: list.map(m => ({
          reference: m.reference, title: m.title,
          client: m.company.name, status: m.status,
          seniority: m.seniority, requiredSkills: m.requiredSkills,
          targetDailyRate: m.targetDailyRate ? Number(m.targetDailyRate) : null,
          startDate: m.startDate?.toISOString().slice(0,10) ?? null,
          applicationsCount: m._count.applications,
          link: `/mission-requests/${m.id}`
        }))
      };
    }
  },

  // ---------- Pipeline offres ----------
  {
    name: "list_open_offers",
    description: "Liste les offres commerciales en cours (DRAFT, SENT, NEGOTIATION) avec le pipeline pondéré.",
    permission: "offers.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("offers.read")) return deny("offers.read");
      const list = await prisma.offer.findMany({
        where: { status: { in: ["DRAFT", "SENT", "NEGOTIATION"] } },
        take: 30, orderBy: { createdAt: "desc" },
        include: { company: { select: { name: true } } }
      });
      const totalSell = list.reduce((s, o) => s + Number(o.totalSell), 0);
      const weighted  = list.reduce((s, o) => s + Number(o.totalSell) * (o.probability / 100), 0);
      return {
        count: list.length,
        totalPipeline: Math.round(totalSell),
        weightedPipeline: Math.round(weighted),
        offers: list.map(o => ({
          reference: o.reference, title: o.title, client: o.company.name,
          status: o.status, probability: o.probability,
          totalSell: Number(o.totalSell), marginPct: Number(o.marginPct),
          link: `/offers/${o.id}`
        }))
      };
    }
  },

  // ---------- Tranches de facturation en retard / à venir ----------
  {
    name: "list_billing_status",
    description: "Liste les tranches de facturation en retard et à venir dans les 30 prochains jours.",
    permission: "finance.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("finance.read")) return deny("finance.read");
      const today = new Date();
      const in30 = new Date(today.getTime() + 30 * 86400_000);
      const [overdue, upcoming] = await Promise.all([
        prisma.billingMilestone.findMany({
          where: { status: { in: ["PLANNED", "READY"] }, expectedAt: { lt: today } },
          include: { offer: { include: { company: true } }, project: { include: { company: true } }, mission: { include: { company: true } } },
          orderBy: { expectedAt: "asc" }, take: 20
        }),
        prisma.billingMilestone.findMany({
          where: { status: { in: ["PLANNED", "READY"] }, expectedAt: { gte: today, lte: in30 } },
          include: { offer: { include: { company: true } }, project: { include: { company: true } }, mission: { include: { company: true } } },
          orderBy: { expectedAt: "asc" }, take: 20
        })
      ]);
      const fmt = (m: any) => ({
        label: m.label, amount: Number(m.amount), status: m.status,
        expectedAt: m.expectedAt?.toISOString().slice(0,10) ?? null,
        client: (m.offer?.company ?? m.project?.company ?? m.mission?.company)?.name ?? null
      });
      return {
        overdue: overdue.map(fmt),
        overdueTotal: overdue.reduce((s, m) => s + Number(m.amount), 0),
        upcoming30d: upcoming.map(fmt),
        upcoming30dTotal: upcoming.reduce((s, m) => s + Number(m.amount), 0)
      };
    }
  },

  // ---------- Charge équipe ----------
  {
    name: "get_bank_balance",
    description: "Donne le solde actuel du/des compte(s) bancaire(s) Dasolabs. Le solde est estimé en sommant toutes les transactions importées depuis GoCardless. Réservé finance/admin.",
    permission: "finance.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      if (!ctx.perms.includes("finance.read")) return deny("finance.read");
      const accounts = await (prisma as any).bankAccount.findMany({
        select: {
          id: true, iban: true, currency: true, name: true, ownerName: true,
          _count: { select: { transactions: true } }
        }
      });
      const balances = await Promise.all(accounts.map(async (a: any) => {
        const agg = await (prisma as any).bankTransaction.aggregate({
          where: { accountId: a.id },
          _sum: { amount: true },
          _max: { bookingDate: true }
        }).catch(() => ({ _sum: { amount: null }, _max: { bookingDate: null } }));
        return {
          account: a.name ?? a.ownerName ?? (a.iban ? `IBAN ••${a.iban.slice(-4)}` : "Compte"),
          iban: a.iban,
          currency: a.currency,
          estimatedBalance: Number(agg._sum?.amount ?? 0),
          lastTransactionDate: agg._max?.bookingDate?.toISOString?.()?.slice(0, 10) ?? null,
          transactionsCount: a._count.transactions,
          link: "/cashflow"
        };
      }));
      const total = balances.reduce((s, b) => s + b.estimatedBalance, 0);
      return {
        accountsCount: accounts.length,
        totalEstimatedBalance: Math.round(total * 100) / 100,
        note: "Solde estimé en sommant les transactions importées (pas une requête live auprès de la banque).",
        accounts: balances
      };
    }
  },

  {
    name: "my_hub_summary",
    description: "Synthèse personnelle de l'utilisateur connecté : solde congés, timesheet du mois en cours, missions actives, notes de frais en attente. Toujours disponible, répond sur l'user courant.",
    permission: "any",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      const u = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true, firstName: true, lastName: true,
          rttDays: true, weeklyCapacityH: true,
          leaveBalances: {
            where: { year: new Date().getFullYear() },
            select: { entitled: true, type: true, year: true }
          }
        }
      });
      if (!u) return { error: "Utilisateur introuvable" };
      const balancesByType = (u.leaveBalances ?? []).reduce((acc: any, b: any) => {
        acc[b.type] = Number(b.entitled);
        return acc;
      }, {});

      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const [missions, expenses, timesheetHours, pendingLeaves] = await Promise.all([
        (prisma as any).mission.count({
          where: { consultantId: u.id, status: "ACTIVE" }
        }).catch(() => 0),
        prisma.expense.count({
          where: { userId: u.id, status: { in: ["SUBMITTED", "APPROVED"] } }
        }).catch(() => 0),
        prisma.timesheetEntry.aggregate({
          where: { userId: u.id, date: { gte: startMonth, lte: endMonth } },
          _sum: { hours: true }
        }).then(r => Number(r._sum?.hours ?? 0)).catch(() => 0),
        prisma.leave.count({
          where: { userId: u.id, status: "SUBMITTED" }
        }).catch(() => 0)
      ]);

      return {
        user: `${u.firstName} ${u.lastName}`,
        leave: {
          year: new Date().getFullYear(),
          entitledByType: balancesByType, // ex: { LEGAL: 20, EXTRA: 2 }
          rttDays: u.rttDays != null ? Number(u.rttDays) : null,
          pendingRequests: pendingLeaves
        },
        timesheet: {
          hoursThisMonth: timesheetHours,
          link: "/timesheet"
        },
        missions: { active: missions, link: "/missions" },
        expenses: { openCount: expenses, link: "/expenses" }
      };
    }
  },

  {
    name: "list_my_expenses",
    description: "Liste les notes de frais DE L'UTILISATEUR CONNECTÉ (soumises, approuvées, payées). Max 30.",
    permission: "any",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT","SUBMITTED","APPROVED","REJECTED","PAID"], description: "Filtre statut" }
      },
      required: []
    },
    run: async (args, ctx) => {
      const where: any = { userId: ctx.userId };
      if (args.status) where.status = args.status;
      const list = await prisma.expense.findMany({
        where, orderBy: { createdAt: "desc" }, take: 30,
        select: { id: true, reference: true, title: true, amount: true, status: true, createdAt: true }
      });
      return {
        count: list.length,
        expenses: list.map((e: any) => ({
          reference: e.reference, title: e.title,
          amount: Number(e.amount), status: e.status,
          createdAt: e.createdAt.toISOString().slice(0, 10),
          link: `/expenses/${e.id}`
        }))
      };
    }
  },

  {
    name: "list_expenses_to_approve",
    description: "Liste les notes de frais soumises en attente d'approbation (ADMIN/MANAGER). Max 30.",
    permission: "expenses.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      if (!ctx.perms.includes("expenses.read")) return deny("expenses.read");
      const list = await prisma.expense.findMany({
        where: { status: "SUBMITTED" }, orderBy: { createdAt: "asc" }, take: 30,
        select: {
          id: true, reference: true, title: true, amount: true, createdAt: true,
          user: { select: { firstName: true, lastName: true } }
        }
      });
      return {
        count: list.length,
        expenses: list.map((e: any) => ({
          reference: e.reference, title: e.title,
          amount: Number(e.amount),
          by: `${e.user?.firstName ?? ""} ${e.user?.lastName ?? ""}`.trim(),
          createdAt: e.createdAt.toISOString().slice(0, 10),
          link: `/expenses/${e.id}`
        }))
      };
    }
  },

  {
    name: "list_my_leaves",
    description: "Liste les congés de l'utilisateur connecté avec leur statut.",
    permission: "any",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["DRAFT","SUBMITTED","APPROVED","REJECTED"], description: "Filtre statut" }
      },
      required: []
    },
    run: async (args, ctx) => {
      const where: any = { userId: ctx.userId };
      if (args.status) where.status = args.status;
      const list = await prisma.leave.findMany({
        where, orderBy: { startDate: "desc" }, take: 50,
        select: { id: true, startDate: true, endDate: true, days: true, type: true, status: true, reason: true }
      });
      return {
        count: list.length,
        leaves: list.map((l: any) => ({
          type: l.type, status: l.status,
          startDate: l.startDate.toISOString().slice(0,10),
          endDate:   l.endDate.toISOString().slice(0,10),
          days: Number(l.days), reason: l.reason,
          link: `/leaves/${l.id}`
        }))
      };
    }
  },

  {
    name: "list_leaves_to_approve",
    description: "Congés soumis en attente d'approbation (manager). Max 30.",
    permission: "leaves.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      if (!ctx.perms.includes("leaves.read")) return deny("leaves.read");
      const list = await prisma.leave.findMany({
        where: { status: "SUBMITTED" }, orderBy: { startDate: "asc" }, take: 30,
        select: {
          id: true, startDate: true, endDate: true, days: true, type: true,
          user: { select: { firstName: true, lastName: true } }
        }
      });
      return {
        count: list.length,
        leaves: list.map((l: any) => ({
          by: `${l.user?.firstName ?? ""} ${l.user?.lastName ?? ""}`.trim(),
          type: l.type,
          startDate: l.startDate.toISOString().slice(0,10),
          endDate:   l.endDate.toISOString().slice(0,10),
          days: Number(l.days),
          link: `/leaves/${l.id}`
        }))
      };
    }
  },

  {
    name: "list_recent_sick_leaves",
    description: "Arrêts maladie récents (6 derniers mois). Admin/manager uniquement.",
    permission: "users.manage",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      if (!ctx.perms.includes("users.manage")) return deny("users.manage");
      const since = new Date(); since.setMonth(since.getMonth() - 6);
      const list = await (prisma as any).sickLeave.findMany({
        where: { startDate: { gte: since } }, orderBy: { startDate: "desc" }, take: 30,
        include: { user: { select: { firstName: true, lastName: true } } }
      });
      return {
        count: list.length,
        sickLeaves: list.map((s: any) => {
          const ms = (s.endDate?.getTime() ?? s.startDate.getTime()) - s.startDate.getTime();
          const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
          return {
            by: `${s.user?.firstName ?? ""} ${s.user?.lastName ?? ""}`.trim(),
            startDate: s.startDate.toISOString().slice(0,10),
            endDate:   s.endDate?.toISOString?.()?.slice(0,10) ?? null,
            days,
            link: `/sick-leaves/${s.id}`
          };
        })
      };
    }
  },

  {
    name: "get_salary_summary",
    description: "Résumé salarial d'un employé (brut, net en main, package). SENSIBLE — réservé admin/finance. Si pas de nom précisé, renvoie tous les employés actifs avec leur brut.",
    permission: "finance.write",
    parameters: {
      type: "object",
      properties: {
        employeeName: { type: "string", description: "Nom (ou partie du nom) de l'employé" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("finance.write")) return deny("finance.write");
      const where: any = { endDate: null };
      if (args.employeeName) where.OR = [
        { firstName: { contains: args.employeeName, mode: "insensitive" } },
        { lastName:  { contains: args.employeeName, mode: "insensitive" } }
      ];
      const list = await (prisma as any).payrollEmployee.findMany({
        where, take: 20,
        orderBy: [{ lastName: "asc" }]
      });
      return {
        count: list.length,
        employees: list.map((p: any) => ({
          name: `${p.firstName} ${p.lastName}`,
          role: p.role,
          brut: Number(p.monthlyGrossReference ?? 0),
          net:  Number(p.monthlyNetPay ?? 0),
          precompte: Number(p.monthlyWithholdingTax ?? 0),
          onss: Number(p.monthlyOnss ?? 0),
          car:  Number(p.carMonthlyTco ?? 0),
          fraisNet: Number(p.netExpensesMonthly ?? 0),
          phone: Number(p.phoneInternetMonthly ?? 0),
          hospi: Number(p.hospitalInsuranceMonthly ?? 0),
          link: `/employees`
        }))
      };
    }
  },

  {
    name: "my_timesheet_status",
    description: "État du timesheet de l'utilisateur connecté : heures saisies vs attendu pour le mois courant.",
    permission: "any",
    parameters: {
      type: "object",
      properties: {
        month: { type: "string", description: "Mois au format YYYY-MM (défaut : mois en cours)" }
      },
      required: []
    },
    run: async (args, ctx) => {
      const now = args.month ? new Date(args.month + "-01") : new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const [agg, u] = await Promise.all([
        prisma.timesheetEntry.aggregate({
          where: { userId: ctx.userId, date: { gte: start, lte: end } },
          _sum: { hours: true }
        }),
        prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { weeklyCapacityH: true }
        })
      ]);
      const weeksInMonth = 4.33;
      const expected = Number(u?.weeklyCapacityH ?? 38) * weeksInMonth;
      const logged = Number(agg._sum?.hours ?? 0);
      return {
        month: now.toISOString().slice(0, 7),
        hoursLogged: logged,
        hoursExpected: Math.round(expected),
        completion: Math.round((logged / expected) * 100),
        link: "/timesheet"
      };
    }
  },

  {
    name: "list_client_portals_status",
    description: "Liste tous les portails clients avec le nombre de propositions en attente de décision client.",
    permission: "consulting.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const portals = await (prisma as any).clientPortal.findMany({
        where: { isActive: true }, take: 30,
        orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
        include: {
          company: { select: { name: true } },
          _count: { select: { proposals: { where: { isVisible: true } } } },
          proposals: {
            where: {
              isVisible: true,
              status: { in: ["PROPOSED", "INTERVIEW_1_REQUESTED", "INTERVIEW_2_REQUESTED", "SHORTLISTED"] }
            },
            select: { id: true }
          }
        }
      });
      return {
        count: portals.length,
        portals: portals.map((p: any) => ({
          name: p.name,
          company: p.company?.name ?? "—",
          visibleCount: p._count.proposals,
          waitingForClient: p.proposals.length,
          workflow: p.workflowVersion,
          link: `/client-portals/${p.id}`
        }))
      };
    }
  },

  {
    name: "list_candidate_proposals",
    description: "Propositions candidat en cours sur les portails clients, filtrables par statut ou société.",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "PROPOSED / INTERVIEW_1_REQUESTED / INTERVIEW_1_DONE / INTERVIEW_2_REQUESTED / INTERVIEW_2_DONE / SHORTLISTED / ACCEPTED / REJECTED"
        },
        companyName: { type: "string", description: "Nom (partiel) de la société cliente" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const where: any = { isVisible: true };
      if (args.status) where.status = args.status;
      if (args.companyName) where.portal = { company: { name: { contains: args.companyName, mode: "insensitive" } } };
      const list = await (prisma as any).candidateProposal.findMany({
        where, orderBy: { updatedAt: "desc" }, take: 30,
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          portal:    { select: { name: true, company: { select: { name: true } } } }
        }
      });
      return {
        count: list.length,
        proposals: list.map((p: any) => ({
          candidate: `${p.candidate.firstName} ${p.candidate.lastName}`,
          company: p.portal.company?.name,
          portal: p.portal.name,
          status: p.status,
          tjm: Number(p.proposedDailyRate),
          actedBy: p.actedByContactName ?? null,
          link: `/client-portals/${p.portalId}`
        }))
      };
    }
  },

  {
    name: "list_my_documents",
    description: "Documents de l'utilisateur connecté (contrats, fiches paie, etc.).",
    permission: "any",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (_a, ctx) => {
      const list = await (prisma as any).document.findMany({
        where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 30,
        select: { id: true, title: true, kind: true, createdAt: true }
      }).catch(() => []);
      return {
        count: list.length,
        documents: list.map((d: any) => ({
          title: d.title, kind: d.kind,
          createdAt: d.createdAt?.toISOString()?.slice(0, 10),
          link: `/me/documents/${d.id}`
        }))
      };
    }
  },

  {
    name: "team_workload",
    description: "Donne la charge planifiée vs capacité de chaque consultant interne pour cette semaine.",
    permission: "planning.read",
    parameters: { type: "object", properties: {}, required: [] },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("planning.read")) return deny("planning.read");
      const users = await prisma.user.findMany({
        where: { active: true, candidateProfile: { is: null }, role: { in: ["CONSULTANT", "MANAGER"] } }
      });
      const { userPlannedHoursForWeek } = await import("./load-service");
      const out = await Promise.all(users.map(async u => ({
        name: `${u.firstName} ${u.lastName}`,
        capacity: Number(u.weeklyCapacityH),
        planned: Math.round((await userPlannedHoursForWeek(u.id, new Date())) * 10) / 10,
        link: `/consultants/${u.id}`
      })));
      out.sort((a, b) => (b.planned / b.capacity) - (a.planned / a.capacity));
      return { weekStarting: new Date().toISOString().slice(0,10), team: out };
    }
  }
];
