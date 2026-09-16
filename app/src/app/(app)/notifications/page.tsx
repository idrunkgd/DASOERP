import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { NotifRow, MarkAllButton } from "./client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const unread = items.filter((n: any) => !n.read).length;

  // Groupe par jour
  const byDay = new Map<string, typeof items>();
  for (const n of items) {
    const day = new Date(n.createdAt).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, [] as any);
    byDay.get(day)!.push(n as any);
  }

  return (
    <div>
      <PageHeader
        pill="NOTIFICATIONS"
        title="Notifications"
        subtitle={`${items.length} au total · ${unread} non lue${unread > 1 ? "s" : ""}`}
        actions={unread > 0 ? <MarkAllButton /> : null}
      />

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500 italic">
          Aucune notification pour l'instant.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([day, list]) => (
            <div key={day}>
              <div className="text-xs font-mono uppercase tracking-widest text-midnight-400 mb-2">
                {formatDate(new Date(day), { weekday: "long", day: "2-digit", month: "long" })}
              </div>
              <div className="card divide-y divide-border/40 overflow-hidden">
                {list.map((n: any) => (
                  <NotifRow key={n.id} notif={{ ...n, createdAt: n.createdAt.toISOString() }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
