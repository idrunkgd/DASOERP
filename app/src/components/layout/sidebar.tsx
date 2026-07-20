"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard, Building2, Users, FileText, FolderKanban,
  Clock, ShoppingCart, CalendarRange, UserCog, Receipt, Settings,
  MessageSquare, BadgeCheck, Briefcase, History, UserPlus, Headset,
  ClipboardCheck, Plane, CalendarDays, ShieldCheck, Sparkles, User as UserIcon,
  Gauge, Calculator, X, TrendingUp,
  FlaskConical, Percent, Wallet, Workflow, FileScan, GitCompareArrows, Inbox,
  AppWindow, GraduationCap, Files, ReceiptText, HeartPulse, ChevronDown
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
      { href: "/employees",         label: "Employés",             icon: Users,         perm: "finance.write" },
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
    ]
  },
  {
    label: "Consultance",
    items: [
      { href: "/prospection",      label: "Prospection",          icon: UserPlus,        perm: "consulting.write" },
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
  {
    label: "RH & Documents",
    items: [
      { href: "/onboarding",  label: "Onboarding",       icon: GraduationCap,  perm: "onboarding.read" },
      { href: "/expenses",    label: "Notes de frais",   icon: ReceiptText,    perm: "expenses.read" },
      { href: "/sick-leaves", label: "Arrêts maladie",   icon: HeartPulse,     perm: "users.manage" },
      { href: "/documents",   label: "Documents",        icon: Files,          perm: "documents.read" },
      { href: "/tests",       label: "Tests techniques", icon: ClipboardCheck, perm: "tests.manage" }
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

/** Clé localStorage — l'état d'ouverture des sections persiste entre refresh. */
const COLLAPSED_KEY = "dasohub-sidebar-collapsed-v1";

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
  const permSet = useMemo(() => new Set(permissions), [permissions]);

  // Classes communes : sticky/visible en md+, drawer fixe en mobile
  const asideClasses = cn(
    "w-64 shrink-0 flex flex-col z-40",
    "bg-gradient-to-b from-midnight-950 via-midnight-950 to-[#0a0e1c] text-midnight-100",
    "fixed inset-y-0 left-0 h-screen transition-transform duration-200 ease-out",
    "md:sticky md:top-0 md:translate-x-0",
    "shadow-2xl md:shadow-none",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  );

  const closeButton = onMobileClose && (
    <button
      type="button"
      onClick={onMobileClose}
      className="md:hidden text-midnight-300 hover:text-white p-1 rounded hover:bg-white/10"
      aria-label="Fermer le menu"
    >
      <X className="w-5 h-5" />
    </button>
  );

  const header = (
    <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
      <div className="bg-white rounded-xl p-2 shadow-md">
        <Image src="/dasolabs-icon.svg" alt="" width={22} height={26} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white tracking-tight">Dasohub</div>
        <div className="text-[10.5px] text-midnight-300 -mt-0.5">
          {restricted ? "Espace personnel" : "Pilotage Dasolabs"}
        </div>
      </div>
      {closeButton}
    </div>
  );

  const footer = (
    <div className="px-4 py-3 border-t border-white/10 text-[11px] text-midnight-400 flex items-center justify-between">
      <span>v0.2</span>
      <span className="text-midnight-500">© {new Date().getFullYear()}</span>
    </div>
  );

  // Visiteur / compte portail : sidebar minimale avec Mon profil uniquement
  if (restricted) {
    const active = path === "/me" || path.startsWith("/me/");
    return (
      <aside className={asideClasses}>
        {header}
        <nav className="flex-1 py-3 px-2">
          <NavLink href="/me" icon={UserIcon} label="Mon profil" active={active} />
        </nav>
        {footer}
      </aside>
    );
  }

  return (
    <aside className={asideClasses}>
      {header}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
            if (item.perm && !permSet.has(item.perm)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          // Une section reste dépliée d'office si la route active tombe dedans
          const containsActive = visibleItems.some(
            (i) => path === i.href || path.startsWith(i.href + "/")
          );
          return (
            <SidebarSection
              key={section.label}
              label={section.label}
              items={visibleItems}
              path={path}
              forceOpen={containsActive}
            />
          );
        })}
      </nav>
      {footer}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// Section repliable

function SidebarSection({
  label,
  items,
  path,
  forceOpen
}: {
  label: string;
  items: NavItem[];
  path: string;
  forceOpen: boolean;
}) {
  // État local, hydraté depuis localStorage après mount pour éviter les
  // mismatch d'hydratation SSR (le serveur ne connaît pas la valeur).
  // Par défaut : tout ouvert au premier rendu.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      if (typeof map[label] === "boolean") setCollapsed(map[label]);
    } catch { /* localStorage désactivé — on garde le défaut */ }
    setHydrated(true);
  }, [label]);

  function toggle() {
    // Si la section contient la route active, on refuse de la replier
    // silencieusement (sinon on cacherait l'entrée courante). L'utilisateur
    // peut toujours naviguer ailleurs et replier ensuite.
    if (forceOpen) return;
    const next = !collapsed;
    setCollapsed(next);
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      map[label] = next;
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  const open = forceOpen || !collapsed;

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 pt-3 pb-1.5 mt-1 group rounded-md",
          "hover:bg-white/[0.04] transition-colors",
          forceOpen ? "cursor-default" : "cursor-pointer"
        )}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-150 text-white",
            open ? "rotate-0" : "-rotate-90",
            forceOpen && "opacity-60"
          )}
        />
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-white">
          {/*
            Volontairement TOUJOURS en blanc pur (ouvert ou fermé) — les
            catégories font office de titres, elles doivent contraster
            franchement avec les items de nav qui sont eux en midnight-300
            (gris moyen). L'état ouvert/fermé se lit uniquement via le
            chevron (▼ vs ▶), pas via la teinte du label.
          */}
          {label}
        </span>
      </button>
      {/* Rendu conditionnel — évite d'insérer des <a> cachés qui polluent le DOM */}
      {(open || !hydrated) && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            return (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Item de nav — indicateur actif : barre gauche + fond léger

function NavLink({
  href, icon: Icon, label, active
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100",
        // NB : l'item actif est en white/85 (et NON pas pur white) pour rester
        // légèrement moins lumineux que les headers de catégorie (pur white).
        // Le repérage se fait via le fond indigo + la barre + l'icône accent,
        // pas via un blanc plus fort que les catégories.
        active
          ? "bg-indigoaccent/15 text-white/85 font-medium"
          : "text-midnight-300 hover:bg-white/5 hover:text-white"
      )}
    >
      {/* Barre indicatrice à gauche (position absolue) */}
      <span
        className={cn(
          "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full transition-all",
          active ? "bg-indigoaccent" : "bg-transparent group-hover:bg-white/20"
        )}
      />
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          active ? "text-indigoaccent" : "text-midnight-400 group-hover:text-midnight-200"
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
