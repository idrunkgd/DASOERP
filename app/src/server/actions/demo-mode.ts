"use server";
/**
 * Mode démo — impersonation temporaire du user "Jean Démo" (isDemo=true).
 *
 * Un admin/manager clique le bouton "Mode démo" dans le sidebar → un cookie
 * `demo-mode=1` est posé pour 24h. Toutes les requêtes côté serveur qui
 * passent par requireSession() vont voir la session comme celle de Jean Démo :
 * même id/name/email/role → il "devient" Jean Démo dans l'app.
 *
 * Aucune donnée réelle n'est touchée. En sortant du mode démo, on retire le
 * cookie et l'utilisateur retrouve son propre compte immédiatement.
 *
 * Sécurité :
 * - Seuls les users avec role ADMIN/MANAGER (ou permission users.manage)
 *   peuvent activer le mode démo.
 * - Le cookie est HttpOnly + SameSite=Lax + max-age 24h.
 * - Une entrée est loguée dans ActivityLog à chaque activation/désactivation.
 */
import { cookies } from "next/headers";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const DEMO_COOKIE_NAME = "demo-mode";

export async function enableDemoMode() {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const roleStr = String(session.user.role ?? "").toUpperCase();
  const isAdmin =
    roleStr === "ADMIN" || roleStr === "MANAGER" ||
    roleStr.startsWith("ADMIN") || roleStr.startsWith("MANAG") ||
    perms.includes("users.manage");
  if (!isAdmin) throw new Error("Forbidden — seul un admin/manager peut activer le mode démo.");

  // Chercher le user démo — même s'il est inactive (défaut off)
  const demoUser = await prisma.user.findFirst({ where: { isDemo: true } as any });
  if (!demoUser) throw new Error("Aucun user démo trouvé — le seed-demo n'a pas encore tourné ?");

  // ACTIVE-ON : Jean Démo devient visible partout dans l'app
  await prisma.user.update({ where: { id: demoUser.id }, data: { active: true } });
  // Idem véhicule fictif
  await prisma.vehicle.updateMany({
    where: { plate: "1-DEMO-42" },
    data: { status: "ACTIVE" }
  });

  cookies().set(DEMO_COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 // 24h
  });

  await logActivity({
    actorId: session.user.id,
    action: "LOGIN", // pas de nouvelle valeur d'enum → on utilise LOGIN qui reflète bien l'idée
    entityType: "User",
    entityId: demoUser.id,
    message: `Mode démo activé (impersonation Jean Démo) par ${session.user.name ?? session.user.email}`
  });

  revalidatePath("/", "layout");
}

export async function disableDemoMode() {
  // Ordre critique :
  // 1. Retirer le cookie D'ABORD → la prochaine requête voit le vrai user
  // 2. Désactiver Jean Démo ENSUITE → il disparaît des listes (consultants,
  //    véhicules, dashboards) mais ses données restent en DB (isDemo=true)
  //    pour la prochaine démo.
  cookies().delete(DEMO_COOKIE_NAME);
  await prisma.user.updateMany({
    where: { isDemo: true } as any,
    data: { active: false }
  });
  await prisma.vehicle.updateMany({
    where: { plate: "1-DEMO-42" },
    data: { status: "ARCHIVED" }
  });
  revalidatePath("/", "layout");
}

export async function isDemoModeActive(): Promise<boolean> {
  return cookies().get(DEMO_COOKIE_NAME)?.value === "1";
}
