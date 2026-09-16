import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

/**
 * GET /api/notifications
 *   ?limit=20 (default) — dernières notifs pour l'user
 *   ?unread=1           — uniquement non lues
 * Retourne : { items: [...], unreadCount: number }
 * Poller ce endpoint depuis la cloche (60s) — léger.
 */
export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const unreadOnly = url.searchParams.get("unread") === "1";

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } })
  ]);

  return NextResponse.json({ items, unreadCount });
}
