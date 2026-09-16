import { prisma } from "@/lib/db";

// Type local — évite un import direct de @prisma/client avant `prisma generate`
// au premier build. Sync avec l'enum du schéma.
export type NotificationType =
  | "EXPENSE_SUBMITTED" | "EXPENSE_APPROVED" | "EXPENSE_REJECTED" | "EXPENSE_PAID"
  | "LEAVE_SUBMITTED"   | "LEAVE_APPROVED"   | "LEAVE_REJECTED"
  | "SICK_LEAVE_DECLARED"
  | "TIMESHEET_SUBMITTED" | "TIMESHEET_APPROVED" | "TIMESHEET_REJECTED"
  | "POLICY_TO_SIGN" | "CONTRACT_READY"
  | "MISSION_ENDING" | "MISSION_ASSIGNED" | "MENTIONED" | "OTHER";

/**
 * Helper serveur pour créer des notifications à un ou plusieurs users.
 *
 * Usage : appeler depuis les server actions métier (createExpense,
 * submitLeave, approveTimesheet…) après l'opération réussie.
 *
 * Design : silencieux si erreur (best-effort). Une notification ratée ne
 * doit jamais faire échouer une action métier. On log en console pour audit.
 */

export type CreateNotifInput = {
  userId: string | string[];
  type: NotificationType;
  title: string;
  message?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function createNotification(input: CreateNotifInput): Promise<void> {
  const userIds = Array.isArray(input.userId) ? input.userId : [input.userId];
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((uid) => ({
        userId: uid,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null
      }))
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[notifications] createNotification failed:", err);
  }
}

/**
 * Récupère les IDs users qui ont une permission donnée — utile pour cibler
 * les approbateurs (users avec `expenses.approve`, `leaves.approve`, etc.).
 *
 * Cette version simplifiée regarde les groupes d'accès qui contiennent la
 * permission. Pour des surcharges fines par user, on pourrait aussi joindre
 * UserPermissionOverride — mais 95% du temps, la perm est au niveau du groupe.
 */
export async function getUserIdsWithPermission(permission: string, excludeUserId?: string): Promise<string[]> {
  const groups = await prisma.accessGroup.findMany({
    where: { permissions: { has: permission } },
    select: { users: { select: { id: true } } }
  });
  const set = new Set<string>();
  for (const g of groups) for (const u of g.users) set.add(u.id);
  if (excludeUserId) set.delete(excludeUserId);
  return Array.from(set);
}
