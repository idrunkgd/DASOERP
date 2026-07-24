import type { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";

export type Permission =
  | "users.manage"
  | "settings.manage"
  | "companies.read" | "companies.write"
  | "contacts.read"  | "contacts.write"
  | "offers.read"    | "offers.write"
  | "projects.read"  | "projects.write"
  | "timesheet.self.write" | "timesheet.validate"
  | "purchases.read" | "purchases.write"
  | "planning.read"  | "planning.write"
  | "finance.read"   | "finance.write"
  | "consulting.read"| "consulting.write"
  // ── nouvelles permissions (suppression des "ouvert à tous") ──
  | "dashboard.read"
  | "applinks.read"   | "applinks.write"
  | "crm.read"        | "crm.write"
  | "reviews.read"    | "reviews.write"
  | "onboarding.read" | "onboarding.write"
  | "documents.read"  | "documents.write"
  | "tests.manage"    | "tests.take"
  | "expenses.read"   | "expenses.write" | "expenses.approve"
  | "leaves.read"     | "leaves.write"   | "leaves.approve"
  | "fleet.read"      | "fleet.manage"
  | "audit.read";

const ROLE_PERMS: Record<Role, Permission[]> = {
  ADMIN: [
    "users.manage", "settings.manage",
    "companies.read","companies.write",
    "contacts.read","contacts.write",
    "offers.read","offers.write",
    "projects.read","projects.write",
    "timesheet.self.write","timesheet.validate",
    "purchases.read","purchases.write",
    "planning.read","planning.write",
    "finance.read","finance.write",
    "consulting.read","consulting.write",
    "dashboard.read",
    "applinks.read","applinks.write",
    "crm.read","crm.write",
    "reviews.read","reviews.write",
    "onboarding.read","onboarding.write",
    "documents.read","documents.write",
    "tests.manage","tests.take",
    "expenses.read","expenses.write","expenses.approve",
    "leaves.read","leaves.write","leaves.approve","fleet.read","fleet.manage",
    "audit.read"
  ],
  MANAGER: [
    "companies.read","companies.write",
    "contacts.read","contacts.write",
    "offers.read","offers.write",
    "projects.read","projects.write",
    "timesheet.self.write","timesheet.validate",
    "purchases.read","purchases.write",
    "planning.read","planning.write",
    "finance.read",
    "consulting.read","consulting.write",
    "dashboard.read",
    "applinks.read",
    "crm.read","crm.write",
    "reviews.read","reviews.write",
    "onboarding.read","onboarding.write",
    "documents.read","documents.write",
    "tests.manage","tests.take",
    "expenses.read","expenses.write","expenses.approve",
    "leaves.read","leaves.write","leaves.approve","fleet.read","fleet.manage",
    "audit.read"
  ],
  COMMERCIAL: [
    "companies.read","companies.write",
    "contacts.read","contacts.write",
    "offers.read","offers.write",
    "projects.read",
    "timesheet.self.write",
    "planning.read",
    "finance.read",
    "consulting.read","consulting.write",
    "dashboard.read",
    "applinks.read",
    "crm.read","crm.write",
    "documents.read","documents.write",
    "expenses.read","expenses.write",
    "leaves.read","leaves.write","fleet.read"
  ],
  CONSULTANT: [
    "companies.read",
    "contacts.read",
    "projects.read",
    "timesheet.self.write",
    "planning.read",
    "purchases.read",
    "dashboard.read",
    "applinks.read",
    "reviews.read",
    "documents.read",
    "tests.take",
    "expenses.read","expenses.write",
    "leaves.read","leaves.write","fleet.read"
  ],
  FINANCE: [
    "companies.read",
    "contacts.read",
    "offers.read",
    "projects.read",
    "purchases.read","purchases.write",
    "finance.read","finance.write",
    "planning.read",
    "timesheet.self.write",
    "dashboard.read",
    "applinks.read",
    "documents.read","documents.write",
    "expenses.read","expenses.write","expenses.approve",
    "leaves.read","leaves.write","leaves.approve",
    "audit.read"
  ]
};

/** Permissions par défaut du rôle (sans surcharge utilisateur). */
export function rolePermissions(role: Role): Permission[] {
  return ROLE_PERMS[role] ?? [];
}

/** Test rapide rôle-only — utilisé partout où on n'a pas l'objet user complet. */
export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

/**
 * Permissions effectives :
 *   1. base = permissions du groupe d'accès assigné (ou Visiteur si aucun)
 *   2. on applique les surcharges utilisateur (grants / revokes)
 *
 * Le ROLE est conservé en signature pour compat mais n'est PAS utilisé ici :
 * il n'a plus aucun impact sur les droits (c'est juste une étiquette métier).
 */
export function effectivePermissions(
  _role: Role,
  groupPermissions: string[] | null,
  overrides: { permission: string; granted: boolean }[]
): Permission[] {
  const base = new Set<Permission>((groupPermissions ?? []) as Permission[]);
  for (const o of overrides) {
    if (o.granted) base.add(o.permission as Permission);
    else base.delete(o.permission as Permission);
  }
  return Array.from(base);
}

/**
 * Nom du groupe utilisé en fallback quand aucun groupe n'est assigné à l'utilisateur.
 * Doit être créé par le seed. Ses permissions = ce que voit un "Visiteur" (rien).
 */
export const DEFAULT_GROUP_NAME = "Visiteur";

/**
 * Charge les permissions effectives d'un user (1 query) — cachée par requête React.
 *
 * IMPORTANT : le ROLE n'a PLUS d'impact sur les permissions. Seul le groupe d'accès
 * compte. Sans groupe assigné, on retombe sur le groupe "Visiteur" (0 permission).
 */
export const getUserEffectivePermissions = cache(async (userId: string, _role: Role): Promise<Permission[]> => {
  const [user, overrides] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { accessGroup: { select: { name: true, permissions: true } } }
    }),
    prisma.userPermissionOverride.findMany({
      where: { userId },
      select: { permission: true, granted: true }
    })
  ]);
  let basePermissions: string[];
  if (user?.accessGroup) {
    basePermissions = user.accessGroup.permissions;
  } else {
    const visitor = await prisma.accessGroup.findUnique({ where: { name: DEFAULT_GROUP_NAME } });
    basePermissions = visitor?.permissions ?? [];
  }
  // (signature rétrocompatible : on passe juste un Role inutilisé en arg 1)
  return effectivePermissions(_role, basePermissions, overrides);
});

/** Récupère le nom du groupe d'accès effectif d'un utilisateur (Visiteur si aucun). */
export const getUserAccessGroupName = cache(async (userId: string): Promise<string> => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessGroup: { select: { name: true } } }
  });
  return u?.accessGroup?.name ?? DEFAULT_GROUP_NAME;
});

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Vérifie une permission en tenant compte des surcharges fines de l'utilisateur.
 * Si l'utilisateur n'a pas la permission (ni par rôle, ni par grant), throw.
 * À utiliser dans les SERVER ACTIONS (l'erreur remonte au client qui peut
 * afficher un toast).
 */
export async function requirePermission(perm: Permission) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!perms.includes(perm)) {
    throw new Error(`Forbidden: missing permission ${perm}`);
  }
  return session;
}

/**
 * Variante pour les PAGES : si l'utilisateur n'a pas la permission, on
 * redirige vers /me (ou vers `fallback`) plutôt que de throw. Évite de
 * faire afficher une page d'erreur à un user qui tape une URL hors de
 * ses droits — il atterrit silencieusement sur son profil.
 */
export async function requirePermissionOrRedirect(perm: Permission, fallback = "/me") {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!perms.includes(perm)) redirect(fallback);
  return session;
}

export function assertPermission(role: Role, perm: Permission) {
  if (!can(role, perm)) throw new Error(`Forbidden: missing permission ${perm}`);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  COMMERCIAL: "Commercial",
  CONSULTANT: "Consultant",
  FINANCE: "Finance / Backoffice"
};

/** Liste exhaustive des permissions, regroupées par section pour l'UI. */
export const PERMISSION_GROUPS: { label: string; permissions: { value: Permission; label: string }[] }[] = [
  { label: "Commerciale", permissions: [
    { value: "companies.read",  label: "Entreprises (lecture)" },
    { value: "companies.write", label: "Entreprises (écriture)" },
    { value: "contacts.read",   label: "Contacts (lecture)" },
    { value: "contacts.write",  label: "Contacts (écriture)" }
  ]},
  { label: "Consultance", permissions: [
    { value: "consulting.read",  label: "Consultance (lecture)" },
    { value: "consulting.write", label: "Consultance (écriture)" }
  ]},
  { label: "Projet", permissions: [
    { value: "offers.read",     label: "Offres (lecture)" },
    { value: "offers.write",    label: "Offres (écriture)" },
    { value: "projects.read",   label: "Projets (lecture)" },
    { value: "projects.write",  label: "Projets (écriture)" },
    { value: "timesheet.self.write", label: "Timesheet (saisie)" },
    { value: "timesheet.validate",   label: "Timesheet (validation)" },
    { value: "purchases.read",  label: "Achats (lecture)" },
    { value: "purchases.write", label: "Achats (écriture)" },
    { value: "planning.read",   label: "Planning (lecture)" },
    { value: "planning.write",  label: "Planning (écriture)" }
  ]},
  { label: "Finances", permissions: [
    { value: "finance.read",    label: "Facturations (lecture)" },
    { value: "finance.write",   label: "Facturations (écriture)" }
  ]},
  { label: "Configuration", permissions: [
    { value: "users.manage",    label: "Utilisateurs & accès" },
    { value: "settings.manage", label: "Paramètres globaux" },
    { value: "audit.read",      label: "Audit trail (lecture)" }
  ]},
  { label: "Pilotage", permissions: [
    { value: "dashboard.read", label: "Tableau de bord" },
    { value: "applinks.read",  label: "Outils & apps (lecture)" },
    { value: "applinks.write", label: "Outils & apps (écriture)" }
  ]},
  { label: "CRM", permissions: [
    { value: "crm.read",  label: "Pipeline CRM (lecture)" },
    { value: "crm.write", label: "Pipeline CRM (écriture)" }
  ]},
  { label: "RH", permissions: [
    { value: "reviews.read",     label: "Entretiens (lecture)" },
    { value: "reviews.write",    label: "Entretiens (écriture)" },
    { value: "onboarding.read",  label: "Onboarding (lecture)" },
    { value: "onboarding.write", label: "Onboarding (écriture)" }
  ]},
  { label: "Documents", permissions: [
    { value: "documents.read",  label: "Documents (lecture)" },
    { value: "documents.write", label: "Documents (écriture)" },
    { value: "tests.manage",    label: "Tests techniques (gérer et assigner)" },
    { value: "tests.take",      label: "Tests techniques (passer un test)" },
    { value: "fleet.read",      label: "Flotte véhicules (lecture)" },
    { value: "fleet.manage",    label: "Flotte véhicules (gestion complète)" }
  ]}
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.value));

// =============================================================================
// MENU_PERMISSIONS — vue alternative organisée comme la sidebar.
// Chaque section = un groupe de menu, chaque entrée = une page. Les pages sans
// permission requise sont listées avec un `perms: []` pour la transparence.
// Utilisée par la page d'édition d'un groupe d'accès pour une UX intuitive.
// =============================================================================
export type MenuEntryPerm = {
  /** Libellé du menu tel qu'affiché dans la sidebar */
  menuLabel: string;
  /** URL de la page concernée (informationnel) */
  href: string;
  /** Permissions associées à cette entrée. Vide = page ouverte à tout user connecté. */
  perms: { value: Permission; label: string }[];
  /** Note libre (ex: "ouvert à tout user connecté", "réservé admin") */
  note?: string;
};
export type MenuPermSection = { section: string; entries: MenuEntryPerm[] };

export const MENU_PERMISSIONS: MenuPermSection[] = [
  {
    section: "Pilotage",
    entries: [
      { menuLabel: "Tableau de bord",   href: "/dashboard", perms: [
        { value: "dashboard.read", label: "Voir le tableau de bord" }
      ]},
      { menuLabel: "Statut projet",     href: "/project-status", perms: [
        { value: "projects.read", label: "Voir le statut projet" }
      ]},
      { menuLabel: "Simulateur package", href: "/salary-simulator", perms: [
        { value: "consulting.read", label: "Accès au simulateur" }
      ]},
      { menuLabel: "Cashflow",         href: "/cashflow",         perms: [
        { value: "finance.read",  label: "Voir le cashflow" },
        { value: "finance.write", label: "Modifier le cashflow" }
      ]},
      { menuLabel: "TVA trimestrielle", href: "/test/tva", perms: [
        { value: "finance.read", label: "Voir la TVA trimestrielle" }
      ]},
      { menuLabel: "Outils & apps",    href: "/app-links", perms: [
        { value: "applinks.read",  label: "Voir les outils & apps" },
        { value: "applinks.write", label: "Ajouter / modifier des entrées" }
      ]}
    ]
  },
  {
    section: "Commerciale",
    entries: [
      { menuLabel: "Entreprises", href: "/companies", perms: [
        { value: "companies.read",  label: "Voir les entreprises" },
        { value: "companies.write", label: "Modifier les entreprises" }
      ]},
      { menuLabel: "Contacts", href: "/contacts", perms: [
        { value: "contacts.read",  label: "Voir les contacts" },
        { value: "contacts.write", label: "Modifier les contacts" }
      ]},
      { menuLabel: "Activités commerciales", href: "/commercial", perms: [
        { value: "contacts.read",  label: "Voir les activités" }
      ]},
      { menuLabel: "CRM pipeline", href: "/test/crm", perms: [
        { value: "crm.read",  label: "Voir le pipeline CRM" },
        { value: "crm.write", label: "Déplacer / créer des cartes" }
      ]}
    ]
  },
  {
    section: "Consultance",
    entries: [
      { menuLabel: "Candidats", href: "/candidates", perms: [
        { value: "consulting.read",  label: "Voir les candidats" },
        { value: "consulting.write", label: "Modifier les candidats" }
      ]},
      { menuLabel: "Consultants", href: "/consultants", perms: [
        { value: "consulting.read",  label: "Voir les consultants" },
        { value: "consulting.write", label: "Modifier les consultants" }
      ]},
      { menuLabel: "Demandes de mission", href: "/mission-requests", perms: [
        { value: "consulting.read",  label: "Voir les demandes" },
        { value: "consulting.write", label: "Modifier les demandes" }
      ]},
      { menuLabel: "Missions", href: "/missions", perms: [
        { value: "consulting.read",  label: "Voir les missions" },
        { value: "consulting.write", label: "Modifier les missions" }
      ]},
      { menuLabel: "Matching mission", href: "/test/matching", perms: [
        { value: "consulting.read", label: "Accès au matching" }
      ]},
      { menuLabel: "Entretiens",       href: "/reviews",  perms: [
        { value: "reviews.read",  label: "Voir les entretiens" },
        { value: "reviews.write", label: "Créer / modifier des entretiens" }
      ]},
      { menuLabel: "Calendrier",       href: "/calendar",       perms: [
        { value: "consulting.read", label: "Voir le calendrier" }
      ]}
    ]
  },
  {
    section: "Projet",
    entries: [
      { menuLabel: "Offres", href: "/offers", perms: [
        { value: "offers.read",  label: "Voir les offres" },
        { value: "offers.write", label: "Créer & modifier les offres" }
      ]},
      { menuLabel: "Projets", href: "/projects", perms: [
        { value: "projects.read",  label: "Voir les projets" },
        { value: "projects.write", label: "Modifier les projets" }
      ]},
      { menuLabel: "Timesheets", href: "/timesheet", perms: [
        { value: "timesheet.self.write", label: "Saisir ses heures" },
        { value: "timesheet.validate",   label: "Valider les timesheets" }
      ]},
      { menuLabel: "Achats", href: "/purchases", perms: [
        { value: "purchases.read",  label: "Voir les achats" },
        { value: "purchases.write", label: "Créer & modifier les achats" }
      ]},
      { menuLabel: "Notes de frais", href: "/expenses", perms: [
        { value: "expenses.read",    label: "Voir les notes de frais" },
        { value: "expenses.write",   label: "Saisir & soumettre ses notes" },
        { value: "expenses.approve", label: "Approuver / rembourser" }
      ]},
      { menuLabel: "Planning", href: "/planning", perms: [
        { value: "planning.read",  label: "Voir le planning" },
        { value: "planning.write", label: "Modifier le planning" }
      ]}
    ]
  },
  {
    section: "Finances",
    entries: [
      { menuLabel: "Facturations", href: "/finance", perms: [
        { value: "finance.read",  label: "Voir les facturations" },
        { value: "finance.write", label: "Émettre & modifier les factures" }
      ]}
    ]
  },
  {
    section: "RH & Documents",
    entries: [
      { menuLabel: "Onboarding", href: "/onboarding", perms: [
        { value: "onboarding.read",  label: "Voir les onboardings" },
        { value: "onboarding.write", label: "Créer / éditer des onboardings" }
      ]},
      { menuLabel: "Documents",  href: "/documents",  perms: [
        { value: "documents.read",  label: "Consulter et télécharger" },
        { value: "documents.write", label: "Uploader / modifier / supprimer" }
      ]},
      { menuLabel: "Tests techniques", href: "/tests", perms: [
        { value: "tests.manage", label: "Gérer et assigner les tests (admin)" },
        { value: "tests.take",   label: "Passer un test assigné" }
      ]},
      { menuLabel: "Flotte véhicules", href: "/fleet", perms: [
        { value: "fleet.read",   label: "Voir la flotte et les attributions" },
        { value: "fleet.manage", label: "Ajouter/éditer/attribuer/supprimer un véhicule" }
      ]}
    ]
  },
  {
    section: "Configuration",
    entries: [
      { menuLabel: "Profils",           href: "/service-profiles", perms: [
        { value: "offers.write", label: "Gérer les profils de prestation" }
      ]},
      { menuLabel: "Compétences",       href: "/skills",        perms: [
        { value: "settings.manage", label: "Gérer la liste des compétences" }
      ]},
      { menuLabel: "Centres de coûts",  href: "/cost-centers",  perms: [
        { value: "settings.manage", label: "Gérer les centres de coûts" }
      ]},
      { menuLabel: "Utilisateurs",      href: "/users",         perms: [
        { value: "users.manage", label: "Gérer les utilisateurs" }
      ]},
      { menuLabel: "Accès",             href: "/access",        perms: [
        { value: "users.manage", label: "Gérer les groupes d'accès" }
      ]},
      { menuLabel: "Audit trail",       href: "/audit", perms: [
        { value: "audit.read", label: "Consulter l'audit trail" }
      ]},
      { menuLabel: "Paramètres",        href: "/settings",      perms: [
        { value: "settings.manage", label: "Modifier les paramètres globaux" }
      ]}
    ]
  }
];
