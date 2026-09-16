"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead, deleteNotification } from "@/server/actions/notifications";
import { cn } from "@/lib/utils";

type Notif = {
  id: string; type: string; title: string; message: string | null; href: string | null;
  read: boolean; createdAt: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const r = await fetch("/api/notifications?limit=15", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setItems(j.items ?? []);
      setUnread(j.unreadCount ?? 0);
    } catch { /* ignore */ }
  }

  // Poll toutes les 60s + à chaque navigation
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [pathname]);

  // Fermer si clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleClickNotif(n: Notif) {
    if (!n.read) {
      setItems((its) => its.map((x) => x.id === n.id ? { ...x, read: true } : x));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    if (n.href) setOpen(false);
  }

  async function handleMarkAll() {
    setLoading(true);
    try {
      await markAllNotificationsRead();
      setItems((its) => its.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    setItems((its) => its.filter((x) => x.id !== id));
    deleteNotification(id).catch(() => refresh());
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg text-midnight-700 hover:bg-midnight-100 flex items-center justify-center transition-colors"
        aria-label={`Notifications (${unread} non lues)`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-midnight-400">Notifications</div>
              <div className="text-sm font-semibold text-midnight-900">
                {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour 👍"}
              </div>
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={loading}
                className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-midnight-400 italic">Aucune notification</div>
            ) : (
              items.map((n) => (
                <NotifRow key={n.id} notif={n} onClick={() => handleClickNotif(n)} onDelete={() => handleDelete(n.id)} />
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center px-4 py-3 text-xs font-semibold text-indigoaccent hover:bg-indigoaccent/5 border-t border-border transition-colors"
          >
            Voir toutes les notifications →
          </Link>
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, onClick, onDelete }: { notif: Notif; onClick: () => void; onDelete: () => void }) {
  const time = timeAgo(notif.createdAt);
  const body = (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-midnight-50/50 border-b border-border/30 last:border-b-0 transition-colors group">
      <div className={cn(
        "w-2 h-2 rounded-full mt-1.5 shrink-0",
        notif.read ? "bg-transparent" : "bg-indigoaccent"
      )} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm truncate", notif.read ? "text-midnight-600 font-normal" : "text-midnight-900 font-semibold")}>
          {notif.title}
        </div>
        {notif.message && (
          <div className="text-xs text-midnight-500 mt-0.5 line-clamp-2">{notif.message}</div>
        )}
        <div className="text-[10px] text-midnight-400 mt-1 font-mono">{time}</div>
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-midnight-400 hover:text-red-600 hover:bg-red-50 transition-all"
        title="Supprimer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
  return notif.href ? (
    <Link href={notif.href} onClick={onClick}>{body}</Link>
  ) : (
    <div onClick={onClick} className="cursor-pointer">{body}</div>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j}j`;
  return new Date(iso).toLocaleDateString("fr-BE");
}
