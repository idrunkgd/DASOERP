"use client";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, X, Loader2 } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead, deleteNotification } from "@/server/actions/notifications";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Notif = {
  id: string; type: string; title: string; message: string | null; href: string | null;
  read: boolean; createdAt: string;
};

export function NotifRow({ notif }: { notif: Notif }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const body = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 group hover:bg-midnight-50/50 transition-colors",
        !notif.read && "bg-indigoaccent/[.03]"
      )}
    >
      <div className={cn(
        "w-2 h-2 rounded-full mt-2 shrink-0",
        notif.read ? "bg-transparent" : "bg-indigoaccent"
      )} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", notif.read ? "text-midnight-700 font-normal" : "text-midnight-900 font-semibold")}>
          {notif.title}
        </div>
        {notif.message && (
          <div className="text-xs text-midnight-500 mt-1">{notif.message}</div>
        )}
        <div className="text-[10px] text-midnight-400 mt-1.5 font-mono">
          {new Date(notif.createdAt).toLocaleString("fr-BE")}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
        {!notif.read && (
          <button
            onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              start(() => markNotificationRead(notif.id).then(() => router.refresh()));
            }}
            className="w-7 h-7 rounded flex items-center justify-center text-midnight-400 hover:text-emerald-600 hover:bg-emerald-50"
            title="Marquer lu"
          ><CheckCheck className="w-3.5 h-3.5" /></button>
        )}
        <button
          onClick={(e) => {
            e.preventDefault(); e.stopPropagation();
            start(() => deleteNotification(notif.id).then(() => router.refresh()));
          }}
          className="w-7 h-7 rounded flex items-center justify-center text-midnight-400 hover:text-red-600 hover:bg-red-50"
          title="Supprimer"
        ><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
  return notif.href ? (
    <Link href={notif.href} onClick={() => !notif.read && markNotificationRead(notif.id).catch(() => {})}>{body}</Link>
  ) : (
    <div>{body}</div>
  );
}

export function MarkAllButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => start(async () => {
        try {
          const r = await markAllNotificationsRead();
          toast.success(`${r.count} marquée(s) lue(s)`);
          router.refresh();
        } catch (err: any) { toast.error(err?.message || "Erreur"); }
      })}
      disabled={pending}
      className="btn-primary text-sm inline-flex items-center gap-1"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
      Tout marquer lu
    </button>
  );
}
