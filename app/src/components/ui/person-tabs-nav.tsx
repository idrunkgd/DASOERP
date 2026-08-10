"use client";
/**
 * Navigation par onglets pour fiche personne (candidat, consultant, /me).
 * Chaque tab est une URL ?tab=key : bookmarkable + refreshable, rendu SSR.
 * Préserve les autres query params de l'URL (ex: ?edit=xxx, ?section=…).
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type PersonTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Badge optionnel (compteur, ex: "3" pour 3 entretiens) */
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
            <t.icon className="w-4 h-4" />
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
