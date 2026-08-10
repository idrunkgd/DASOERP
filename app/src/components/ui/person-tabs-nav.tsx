"use client";
/**
 * Navigation par onglets pour fiche personne (candidat, consultant, /me).
 * Chaque tab est une URL ?tab=key : bookmarkable + refreshable, rendu SSR.
 * Préserve les autres query params de l'URL (ex: ?edit=xxx, ?section=…).
 *
 * IMPORTANT : les icônes sont passées par NOM (string) et résolues côté
 * client via ICON_MAP. On ne peut PAS passer un composant Lucide depuis
 * un Server Component — les fonctions ne traversent pas la frontière RSC.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  User, FileText, Briefcase, ClipboardCheck, FileSignature,
  Users, ClipboardList, MessageSquare, Building2, GraduationCap
} from "lucide-react";

export type PersonTabIcon =
  | "user"
  | "file"
  | "briefcase"
  | "check"
  | "contract"
  | "users"
  | "list"
  | "message"
  | "company"
  | "graduation";

const ICON_MAP: Record<PersonTabIcon, typeof User> = {
  user:      User,
  file:      FileText,
  briefcase: Briefcase,
  check:     ClipboardCheck,
  contract:  FileSignature,
  users:     Users,
  list:      ClipboardList,
  message:   MessageSquare,
  company:   Building2,
  graduation: GraduationCap
};

export type PersonTab = {
  key: string;
  label: string;
  icon: PersonTabIcon;
  /** Badge optionnel (compteur, ex: 3 pour 3 entretiens) */
  badge?: number | string;
};

export function PersonTabsNav({
  tabs, current, className
}: {
  tabs: PersonTab[];
  current: string;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div className={"flex items-center gap-1 border-b border-midnight-200 mb-4 overflow-x-auto " + (className ?? "")}>
      {tabs.map((t) => {
        const active = t.key === current;
        const sp = new URLSearchParams(searchParams?.toString() ?? "");
        sp.set("tab", t.key);
        const href = `${pathname}?${sp.toString()}`;
        const Icon = ICON_MAP[t.icon] ?? User;
        return (
          <Link
            key={t.key}
            href={href}
            className={
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors " +
              (active
                ? "text-indigoaccent border-b-2 border-indigoaccent -mb-px"
                : "text-midnight-500 hover:text-midnight-800")
            }
          >
            <Icon className="w-4 h-4" />
            {t.label}
            {t.badge != null && (
              <span className={
                "ml-1 text-[10px] px-1.5 rounded-full " +
                (active ? "bg-indigoaccent text-white" : "bg-midnight-100 text-midnight-600")
              }>
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
