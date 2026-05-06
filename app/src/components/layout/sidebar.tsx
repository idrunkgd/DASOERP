"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, FileText, FolderKanban,
  Clock, ShoppingCart, CalendarRange, UserCog, Receipt, Settings,
  MessageSquare, BadgeCheck, Briefcase, History, UserPlus, Headset,
  ClipboardCheck, Plane, CalendarDays, ShieldCheck, Sparkles, User as UserIcon,
  Gauge, Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { type Permission } from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: any; perm?: Permission; allowedRoles?: Role[] };
type Section = { label: string; items: NavItem[] };

const SECTIONS: Section[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/dashboard",         label: "Tableau de bord",      icon: LayoutDashboard },
      { href: "/project-status",    label: "Statut projet",        icon: Gauge },
      { href: "/salary-simulator",  label: "Simulateur package",   icon: Calculator,    perm: "consulting.read" }
    ]
  },
  {
    label: "Commerciale",
    items: [
      { href: "/companies",   label: "Entreprises",          icon: Building2,       perm: "companies.read" },
      { href: "/contacts",    label: "Contacts",             icon: Users,           perm: "contacts.read" },
      { href: "/commercial",  label: "Activités commerciales", icon: MessageSquare, perm: "contacts.read" }
    ]
  },
  {
    label: "Consultance",
    items: [
      { href: "/candidates",       label: "Candidats",            icon: UserPlus,        perm: "consulting.read" },
      { href: "/consultants",      label: "Consultants",          icon: Users,           perm: "consulting.read" },
      { href: "/mission-requests", label: "Demandes de mission",  icon: Headset,         perm: "consulting.read" },
      { href: "/missions",         label: "Missions",             icon: Plane,           perm: "consulting.read" },
      { href: "/reviews",          label: "Entretiens",           icon: ClipboardCheck,  allowedRoles: ["ADMIN","MANAGER","CONSULTANT"] },
      { href: "/calendar",         label: "Calendrier",           icon: CalendarDays,    perm: "consulting.read" }
    ]
  },
  {
    label: "Projet",
    items: [
      { href: "/offers",      label: "Offres",                icon: FileText,        perm: "offers.read" },
      { href: "/projects",    label: "Projets",               icon: FolderKanban,    perm: "projects.read" },
      { href: "/timesheet",   label: "Timesheets",            icon: Clock,           perm: "timesheet.self.write" },
      { href: "/purchases",   label: "Achats",                icon: ShoppingCart,    perm: "purchases.read" },
      { href: "/planning",    label: "Planning",              icon: CalendarRange,   perm: "planning.read" }
    ]
  },
  {
    label: "Finances",
    items: [
      { href: "/finance",     label: "Facturations",          icon: Receipt,         perm: "finance.read" }
    ]
  },
  {
    label: "Configuration",
    items: [
      { href: "/service-profiles", label: "Profils",          icon: BadgeCheck,      perm: "offers.write" },
      { href: "/skills",           label: "Compétences",      icon: Sparkles,        perm: "settings.manage" },
      { href: "/cost-centers",     label: "Centres de coûts", icon: Briefcase,       perm: "settings.manage" },
      { href: "/users",            label: "Utilisateurs",     icon: UserCog,         perm: "users.manage" },
      { href: "/access",           label: "Accès",            icon: ShieldCheck,     perm: "users.manage" },
      { href: "/audit",            label: "Audit trail",      icon: History,         allowedRoles: ["ADMIN","MANAGER","FINANCE"] },
      { href: "/settings",         label: "Paramètres",       icon: Settings,        perm: "settings.manage" }
    ]
  }
];

export function Sidebar({ role, permissions, restricted = false }: { role: Role; permissions: Permission[]; restricted?: boolean }) {
  const path = usePathname();
  const permSet = new Set(permissions);

  // Visiteur / compte portail : sidebar minimale avec Mon profil uniquement
  if (restricted) {
    const active = path === "/me" || path.startsWith("/me/");
    return (
      <aside className="w-60 shrink-0 bg-midnight-950 text-midnight-100 flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="bg-white rounded-lg p-1.5">
            <Image src="/dasolabs-icon.svg" alt="" width={26} height={32} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Dasolabs</div>
            <div className="text-[11px] text-midnight-300 -mt-0.5">Espace personnel</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2">
          <Link
            href="/me"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              active ? "bg-indigoaccent/20 text-white font-medium" : "text-midnight-200 hover:bg-white/5 hover:text-white"
            )}
          >
            <UserIcon className="w-4 h-4 shrink-0" />
            <span>Mon profil</span>
          </Link>
        </nav>
        <div className="p-3 border-t border-white/5 text-[11px] text-midnight-300">
          v0.2 · {new Date().getFullYear()}
        </div>
      </aside>
    );
  }
  return (
    <aside className="w-60 shrink-0 bg-midnight-950 text-midnight-100 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="bg-white rounded-lg p-1.5">
          <Image src="/dasolabs-icon.svg" alt="" width={26} height={32} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Dasolabs</div>
          <div className="text-[11px] text-midnight-300 -mt-0.5">ERP interne</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => {
            if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
            if (item.perm && !permSet.has(item.perm)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-2">
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-midnight-400 font-semibold">{section.label}</div>
              {visibleItems.map(item => {
                const active = path === item.href || path.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active ? "bg-indigoaccent/20 text-white font-medium" : "text-midnight-200 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5 text-[11px] text-midnight-300">
        v0.2 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
