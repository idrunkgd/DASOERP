"use client";
/**
 * Navigation par onglets sur la page /me (consultant interne).
 * Utilise <Link> pour rester server-rendered — chaque tab est une URL
 * ?tab=general|cv|rh, ce qui garde l'état bookmarkable et refreshable.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { User, FileText, Briefcase } from "lucide-react";

type TabDef = { key: string; label: string; icon: any };
const TABS: TabDef[] = [
  { key: "general", label: "Général",       icon: User },
  { key: "cv",      label: "Mon CV",        icon: FileText },
  { key: "rh",      label: "RH & Note de frais", icon: Briefcase }
];

export function MeTabsNav({ current }: { current: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <div className="flex items-center gap-1 border-b border-midnight-200 mb-4">
      {TABS.map((t) => {
        const active = t.key === current;
        // Préserve les autres query params éventuels
        const sp = new URLSearchParams(searchParams?.toString() ?? "");
        sp.set("tab", t.key);
        const href = `${pathname}?${sp.toString()}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors " +
              (active
                ? "text-indigoaccent border-b-2 border-indigoaccent -mb-px"
                : "text-midnight-500 hover:text-midnight-800")
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
