// Recherche globale (palet Cmd+K). Optimisée pour 3 cas réels :
//   1. Multi-mots — "Dasolabs offre janvier" splittée en 3 mots, chacun
//      doit être présent dans au moins un champ recherché (AND des OR).
//   2. Cross-entité — chercher un nom de client doit aussi retourner ses
//      offres / projets / missions (jointure sur company.name).
//   3. Skills candidat — la recherche en `contains` insensitive sur le
//      tableau String[] est faite via une jointure sur la table Skill
//      pour avoir le case-insensitive partial match.
import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/rbac";
import { NextRequest } from "next/server";

type Result = {
  type:
    | "company"
    | "contact"
    | "offer"
    | "project"
    | "purchase"
    | "user"
    | "demande"
    | "mission"
    | "candidate"
    | "consultant";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const LIMIT = 8;

/**
 * Construit un filtre Prisma "tous les mots doivent matcher au moins un champ".
 * Renvoie un AND de OR (un OR par mot, chaque OR contient toutes les variantes).
 *
 *  buildAndOfOr(["mike", "dasolabs"], (w) => [
 *    { firstName: { contains: w, mode: "insensitive" } },
 *    { company: { name: { contains: w, mode: "insensitive" } } }
 *  ])
 *
 *  → { AND: [
 *        { OR: [{ firstName: {...mike...} }, { company: {...mike...} }] },
 *        { OR: [{ firstName: {...dasolabs...} }, { company: {...dasolabs...} }] }
 *    ]}
 */
function buildAndOfOr<T>(words: string[], builder: (w: string) => T[]): any {
  if (words.length === 0) return {};
  return {
    AND: words.map((w) => ({ OR: builder(w) }))
  };
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const role = session.user.role;
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  if (raw.length < 2) return Response.json({ results: [] });

  // Split en mots de 2+ caractères. "RH offre" -> ["RH", "offre"].
  const words = raw.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return Response.json({ results: [] });

  const results: Result[] = [];

  // ── Entreprises ──────────────────────────────────────────────────────────
  if (can(role, "companies.read")) {
    const where = buildAndOfOr(words, (w) => [
      { name: { contains: w, mode: "insensitive" as const } },
      { vatNumber: { contains: w, mode: "insensitive" as const } },
      { city: { contains: w, mode: "insensitive" as const } }
    ]);
    const cs = await prisma.company.findMany({
      where,
      take: LIMIT,
      orderBy: { name: "asc" }
    });
    cs.forEach((c) =>
      results.push({
        type: "company",
        id: c.id,
        title: c.name,
        subtitle: c.vatNumber ?? c.city ?? "",
        href: `/companies/${c.id}`
      })
    );
  }

  // ── Contacts ─────────────────────────────────────────────────────────────
  if (can(role, "contacts.read")) {
    const where = buildAndOfOr(words, (w) => [
      { firstName: { contains: w, mode: "insensitive" as const } },
      { lastName: { contains: w, mode: "insensitive" as const } },
      { email: { contains: w, mode: "insensitive" as const } },
      { jobTitle: { contains: w, mode: "insensitive" as const } },
      { company: { name: { contains: w, mode: "insensitive" as const } } }
    ]);
    const ct = await prisma.contact.findMany({
      where,
      include: { company: true },
      take: LIMIT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    ct.forEach((c) =>
      results.push({
        type: "contact",
        id: c.id,
        title: `${c.firstName} ${c.lastName}`,
        subtitle: c.company?.name ?? c.email ?? "",
        href: `/contacts/${c.id}`
      })
    );
  }

  // ── Offres ───────────────────────────────────────────────────────────────
  if (can(role, "offers.read")) {
    const where = buildAndOfOr(words, (w) => [
      { title: { contains: w, mode: "insensitive" as const } },
      { reference: { contains: w, mode: "insensitive" as const } },
      { description: { contains: w, mode: "insensitive" as const } },
      { company: { name: { contains: w, mode: "insensitive" as const } } }
    ]);
    const os = await prisma.offer.findMany({
      where,
      include: { company: true },
      take: LIMIT,
      orderBy: { createdAt: "desc" }
    });
    os.forEach((o) =>
      results.push({
        type: "offer",
        id: o.id,
        title: `${o.reference} — ${o.title}`,
        subtitle: o.company.name,
        href: `/offers/${o.id}`
      })
    );
  }

  // ── Projets ──────────────────────────────────────────────────────────────
  if (can(role, "projects.read")) {
    const where = buildAndOfOr(words, (w) => [
      { name: { contains: w, mode: "insensitive" as const } },
      { reference: { contains: w, mode: "insensitive" as const } },
      { description: { contains: w, mode: "insensitive" as const } },
      { company: { name: { contains: w, mode: "insensitive" as const } } }
    ]);
    const ps = await prisma.project.findMany({
      where,
      include: { company: true },
      take: LIMIT,
      orderBy: { createdAt: "desc" }
    });
    ps.forEach((p) =>
      results.push({
        type: "project",
        id: p.id,
        title: `${p.reference} — ${p.name}`,
        subtitle: p.company.name,
        href: `/projects/${p.id}`
      })
    );
  }

  // ── Achats ───────────────────────────────────────────────────────────────
  if (can(role, "purchases.read")) {
    const where = buildAndOfOr(words, (w) => [
      { description: { contains: w, mode: "insensitive" as const } },
      { project: { reference: { contains: w, mode: "insensitive" as const } } },
      { project: { company: { name: { contains: w, mode: "insensitive" as const } } } }
    ]);
    const pu = await prisma.purchase.findMany({
      where,
      include: { project: true },
      take: LIMIT,
      orderBy: { createdAt: "desc" }
    });
    pu.forEach((p) =>
      results.push({
        type: "purchase",
        id: p.id,
        title: p.description,
        subtitle: p.project.reference,
        href: `/purchases/${p.id}`
      })
    );
  }

  // ── Utilisateurs (gestion only) ──────────────────────────────────────────
  if (can(role, "users.manage")) {
    const where = buildAndOfOr(words, (w) => [
      { firstName: { contains: w, mode: "insensitive" as const } },
      { lastName: { contains: w, mode: "insensitive" as const } },
      { email: { contains: w, mode: "insensitive" as const } }
    ]);
    const us = await prisma.user.findMany({
      where,
      take: LIMIT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    us.forEach((u) =>
      results.push({
        type: "user",
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.email,
        href: `/users/${u.id}`
      })
    );
  }

  // ── Consultance : demandes, missions, candidats, consultants ────────────
  if (can(role, "consulting.read")) {
    // Demandes de mission
    const whereDemandes = buildAndOfOr(words, (w) => [
      { title: { contains: w, mode: "insensitive" as const } },
      { reference: { contains: w, mode: "insensitive" as const } },
      { description: { contains: w, mode: "insensitive" as const } },
      { company: { name: { contains: w, mode: "insensitive" as const } } }
    ]);
    const ms = await prisma.missionRequest.findMany({
      where: whereDemandes,
      include: { company: true },
      take: LIMIT,
      orderBy: { createdAt: "desc" }
    });
    ms.forEach((m) =>
      results.push({
        type: "demande",
        id: m.id,
        title: `${m.reference} — ${m.title}`,
        subtitle: m.company.name,
        href: `/mission-requests/${m.id}`
      })
    );

    // Missions exécutées
    const whereMission = buildAndOfOr(words, (w) => [
      { title: { contains: w, mode: "insensitive" as const } },
      { reference: { contains: w, mode: "insensitive" as const } },
      { company: { name: { contains: w, mode: "insensitive" as const } } },
      { consultant: { firstName: { contains: w, mode: "insensitive" as const } } },
      { consultant: { lastName: { contains: w, mode: "insensitive" as const } } }
    ]);
    const exec = await prisma.mission.findMany({
      where: whereMission,
      include: { company: true, consultant: true },
      take: LIMIT,
      orderBy: { createdAt: "desc" }
    });
    exec.forEach((e) =>
      results.push({
        type: "mission",
        id: e.id,
        title: `${e.reference} — ${e.title}`,
        subtitle: `${e.company.name}${
          e.consultant ? ` · ${e.consultant.firstName} ${e.consultant.lastName}` : ""
        }`,
        href: `/missions/${e.id}`
      })
    );

    // Candidats — recherche en deux temps :
    //   1) match direct sur firstName / lastName / email / city / seniority / notes
    //   2) match sur les skills (String[]) : on cherche d'abord les skills qui
    //      contiennent un des mots dans la table Skill, puis on filtre les
    //      candidats qui ont au moins un de ces skills (hasSome).
    const skillsForWord = await Promise.all(
      words.map((w) =>
        prisma.skill.findMany({
          where: { name: { contains: w, mode: "insensitive" } },
          select: { name: true },
          take: 50
        })
      )
    );
    // On garde la liste des noms de skill qui matchent N'IMPORTE QUEL mot
    const matchedSkillNames = Array.from(
      new Set(skillsForWord.flat().map((s) => s.name))
    );

    const whereCandidate = buildAndOfOr(words, (w) => {
      const ors: any[] = [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { email: { contains: w, mode: "insensitive" as const } },
        { city: { contains: w, mode: "insensitive" as const } },
        { seniority: { contains: w, mode: "insensitive" as const } },
        { notes: { contains: w, mode: "insensitive" as const } }
      ];
      // Si on a au moins un skill qui matche ce mot, on autorise le hasSome.
      // On ne peut pas filtrer par w directement dans hasSome, donc on liste
      // tous les skills matchés (cette branche peut être un peu généreuse
      // quand plusieurs mots — c'est OK, l'AND filtre derrière).
      if (matchedSkillNames.length > 0) {
        ors.push({ skills: { hasSome: matchedSkillNames } });
      }
      return ors;
    });

    const cs = await prisma.candidate.findMany({
      where: whereCandidate,
      take: LIMIT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    cs.forEach((c) =>
      results.push({
        type: "candidate",
        id: c.id,
        title: `${c.firstName} ${c.lastName}`,
        subtitle:
          c.seniority ??
          (c.skills.length > 0 ? c.skills.slice(0, 3).join(" · ") : c.email ?? ""),
        href: `/candidates/${c.id}`
      })
    );

    // Consultants (utilisateurs avec rôle consultant/manager/commercial/finance)
    const whereConsultant = buildAndOfOr(words, (w) => {
      const ors: any[] = [
        { firstName: { contains: w, mode: "insensitive" as const } },
        { lastName: { contains: w, mode: "insensitive" as const } },
        { email: { contains: w, mode: "insensitive" as const } },
        { seniority: { contains: w, mode: "insensitive" as const } }
      ];
      if (matchedSkillNames.length > 0) {
        ors.push({ skills: { hasSome: matchedSkillNames } });
      }
      return ors;
    });

    const us = await prisma.user.findMany({
      where: {
        AND: [
          whereConsultant,
          { role: { in: ["CONSULTANT", "MANAGER", "COMMERCIAL", "FINANCE"] } },
          { candidateProfile: { is: null } } // exclut les comptes portail candidat
        ]
      },
      take: LIMIT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    us.forEach((u) =>
      results.push({
        type: "consultant",
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle:
          u.seniority ??
          (u.skills.length > 0 ? u.skills.slice(0, 3).join(" · ") : u.email),
        href: `/consultants/${u.id}`
      })
    );
  }

  return Response.json({ results });
}
