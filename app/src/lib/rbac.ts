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
  | "consulting.read"| "consulting.write";

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
    "consulting.read","consulting.write"
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
    "consulting.read","consulting.write"
  ],
  COMMERCIAL: [
    "companies.read","companies.write",
    "contacts.read","contacts.write",
    "offers.read","offers.write",
    "projects.read",
    "timesheet.self.write",
    "planning.read",
    "finance.read",
    "consulting.read","consulting.write"
  ],
  CONSULTANT: [
    "companies.read",
    "contacts.read",
    "projects.read",
    "timesheet.self.write",
    "planning.read",
    "purchases.read"
  ],
  FINANCE: [
    "companies.read",
    "contacts.read",
    "offers.read",
    "projects.read",
    "purchases.read","purchases.write",
    "finance.read","finance.write",
    "planning.read",
    "timesheet.self.write"
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
 */
export async function requirePermission(perm: Permission) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!perms.includes(perm)) {
    throw new Error(`Forbidden: missing permission ${perm}`);
  }
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
    { value: "settings.manage", label: "Paramètres globaux" }
  ]}
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.value));
