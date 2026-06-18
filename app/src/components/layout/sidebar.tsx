"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, FileText, FolderKanban,
  Clock, ShoppingCart, CalendarRange, UserCog, Receipt, Settings,
  MessageSquare, BadgeCheck, Briefcase, History, UserPlus, Headset,
  ClipboardCheck, Plane, CalendarDays, ShieldCheck, Sparkles, User as UserIcon,
  Gauge, Calculator, X, TrendingUp,
  FlaskConical, Percent, Wallet, Workflow, FileScan, GitCompareArrows, Inbox,
  AppWindow, GraduationCap, Files
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
      { href: "/dashboard",         label: "Tableau de bord",      icon: LayoutDashboard, perm: "dashboard.read" },
      { href: "/project-status",    label: "Statut projet",        icon: Gauge,         perm: "projects.read" },
      { href: "/salary-simulator",  label: "Simulateur package",   icon: Calculator,    perm: "consulting.read" },
      { href: "/cashflow",          label: "Cashflow",             icon: TrendingUp,    perm: "finance.read" },
      { href: "/test/tva",          label: "TVA trimestrielle",    icon: Percent,       perm: "finance.read" },
      { href: "/app-links",         label: "Outils & apps",        icon: AppWindow,     perm: "applinks.read" }
    ]
  },
  {
    label: "Commerciale",
    items: [
      { href: "/companies",   label: "Entreprises",          icon: Building2,       perm: "companies.read" },
      { href: "/contacts",    label: "Contacts",             icon: Users,           perm: "contacts.read" },
      { href: "/commercial",  label: "Activités commerciales", icon: MessageSquare, perm: "contacts.read" }
      // CRM pipeline retiré sur demande utilisateur — page /test/crm
      // reste accessible par URL directe si besoin.
    ]
  },
  {
    label: "Consultance",
    items: [
      { href: "/candidates",       label: "Candidats",            icon: UserPlus,        perm: "consulting.read" },
      { href: "/consultants",      label: "Consultants",          icon: Users,           perm: "consulting.read" },
      { href: "/mission-requests", label: "Demandes de mission",  icon: Headset,         perm: "consulting.read" },
      { href: "/missions",         label: "Missions",             icon: Plane,           perm: "consulting.read" },
      { href: "/test/matching",    label: "Matching mission",     icon: GitCompareArrows, perm: "consulting.read" },
      { href: "/reviews",          label: "Entretiens",           icon: ClipboardCheck,  perm: "reviews.read" },
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
  // Section "Test (preview)" masquée — les pages restent accessibles par URL directe
  // (/test/expenses, /test/supplier-invoices, /test/cv-parser, /test/tva, /test/matching)
  // mais ne sont plus dans la navigation. CRM a été déplacé dans "Commerciale".
  {
    label: "RH & Documents",
    items: [
      { href: "/onboarding", label: "Onboarding",       icon: GraduationCap,  perm: "onboarding.read" },
      { href: "/documents",  label: "Documents",        icon: Files,          perm: "documents.read" },
      { href: "/tests",      label: "Tests techniques", icon: ClipboardCheck, perm: "tests.manage" }
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
      { href: "/audit",            label: "Audit trail",      icon: History,         perm: "audit.read" },
      { href: "/settings",         label: "Paramètres",       icon: Settings,        perm: "settings.manage" }
    ]
  }
];

export function Sidebar({
  role,
  permissions,
  restricted = false,
  mobileOpen = false,
  onMobileClose
}: {
  role: Role;
  permissions: Permission[];
  restricted?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const path = usePathname();
  const permSet = new Set(permissions);

  // Classes communes : sticky/visible en md+, drawer fixe en mobile
  const asideClasses = cn(
    "w-60 shrink-0 bg-midnight-950 text-midnight-100 flex flex-col z-40",
    "fixed inset-y-0 left-0 h-screen transition-transform duration-200 ease-out",
    "md:sticky md:top-0 md:translate-x-0",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  );

  const closeButton = onMobileClose && (
    <button
      type="button"
      onClick={onMobileClose}
      className="md:hidden text-midnight-300 hover:text-white p-1"
      aria-label="Fermer le menu"
    >
      <X className="w-5 h-5" />
    </button>
  );

  // Visiteur / compte portail : sidebar minimale avec Mon profil uniquement
  if (restricted) {
    const active = path === "/me" || path.startsWith("/me/");
    return (
      <aside className={asideClasses}>
        <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="bg-white rounded-lg p-1.5">
            <Image src="/dasolabs-icon.svg" alt="" width={26} height={32} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Dasohub</div>
            <div className="text-[11px] text-midnight-300 -mt-0.5">Espace personnel</div>
          </div>
          {closeButton}
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
    <aside className={asideClasses}>
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="bg-white rounded-lg p-1.5">
          <Image src="/dasolabs-icon.svg" alt="" width={26} height={32} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Dasohub</div>
          <div className="text-[11px] text-midnight-300 -mt-0.5">Pilotage Dasolabs</div>
        </div>
        {closeButton}
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
