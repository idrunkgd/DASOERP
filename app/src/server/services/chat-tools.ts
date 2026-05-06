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
    description: "Recherche dans le vivier de candidats externes par compétence, séniorité, ville et/ou disponibilité. Renvoie au max 20 profils.",
    permission: "consulting.read",
    parameters: {
      type: "object",
      properties: {
        skill:        { type: "string", description: "compétence à filtrer (ex: 'react', 'java')" },
        seniority:    { type: "string", description: "séniorité (ex: 'Senior', 'Junior', 'Lead')" },
        city:         { type: "string", description: "ville" },
        availableOnly:{ type: "boolean", description: "uniquement les candidats avec status ACTIVE" }
      },
      required: []
    },
    run: async (args, ctx) => {
      if (!ctx.perms.includes("consulting.read")) return deny("consulting.read");
      const where: any = { convertedToUser: { is: null } };
      if (args.availableOnly !== false) where.status = "ACTIVE";
      if (args.skill) where.skills = { has: args.skill.toLowerCase() };
      if (args.seniority) where.seniority = { contains: args.seniority, mode: "insensitive" };
      if (args.city) where.city = { contains: args.city, mode: "insensitive" };
      const list = await prisma.candidate.findMany({
        where, take: 20, orderBy: [{ status: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, seniority: true, yearsExperience: true, city: true, skills: true, dailyCost: true, availableFrom: true, status: true }
      });
      return {
        count: list.length,
        candidates: list.map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          seniority: c.seniority, yearsExperience: c.yearsExperience,
          city: c.city, skills: c.skills, dailyCost: c.dailyCost ? Number(c.dailyCost) : null,
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
