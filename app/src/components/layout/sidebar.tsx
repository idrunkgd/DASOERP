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

  // Thème SOMBRE — deux tons de mauve : fond mauve intense (indigoaccent)
  // pour les bandeaux catégorie/header, texte mauve clair (indigo-200) pour
  // les items sur le fond sombre principal.
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
      className="md:hidden text-indigo-100 hover:text-white p-1 rounded hover:bg-white/10"
      aria-label="Fermer le menu"
    >
      <X className="w-5 h-5" />
    </button>
  );

  // Header logo = fond sombre navy (le même que le fond du menu principal)
  // avec le logo dans un carré blanc pour bien ressortir. Le titre / sous-titre
  // reprennent le blanc / mauve clair pour rester lisibles sur le dark.
  const header = (
    <div className="px-4 py-4 bg-midnight-950 border-b border-white/10 flex items-center gap-3">
      <div className="bg-white rounded-xl p-2 shadow-md">
        <Image src="/dasolabs-icon.svg" alt="" width={22} height={26} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white tracking-tight">Dasohub</div>
        <div className="text-[10.5px] text-indigo-200/80 -mt-0.5">
          {restricted ? "Espace personnel" : "Pilotage Dasolabs"}
        </div>
      </div>
      {closeButton}
    </div>
  );

  const footer = (
    <div className="px-4 py-3 border-t border-white/10 text-[11px] text-indigo-200/70 flex items-center justify-between">
      <span>v0.2</span>
      <span className="text-indigo-300/50">© {new Date().getFullYear()}</span>
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
      {/* nav-scroll classe custom (voir globals.css) : cache la scrollbar
          native (webkit + firefox) tout en conservant le scroll. */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 nav-scroll">
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
  // Par défaut : TOUT REPLIÉ sauf "Pilotage" (section principale, toujours
  // ouverte au premier rendu). L'état est ensuite écrasé par localStorage
  // au mount pour respecter les préférences de l'utilisateur.
  const defaultCollapsed = label !== "Pilotage";
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
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
          "w-full flex items-center gap-2 px-3 py-2 mt-1.5 group rounded-md",
          // Bandeau mauve intense pour la catégorie — cohérent avec le header
          // logo en haut de la sidebar. Fermé = même bg avec opacité réduite
          // pour signaler l'état (2ème ton de mauve sur bg mauve).
          open
            ? "bg-indigoaccent hover:bg-indigoaccent/90"
            : "bg-indigoaccent/60 hover:bg-indigoaccent/80",
          "transition-colors shadow-sm",
          forceOpen ? "cursor-default" : "cursor-pointer"
        )}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-150 text-indigo-100",
            open ? "rotate-0" : "-rotate-90",
            forceOpen && "opacity-70"
          )}
        />
        <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-indigo-50">
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
        // Items sur le fond sombre principal : texte mauve clair (indigo-300)
        // — c'est le 2ème ton de mauve, en écho au bandeau catégorie mauve
        // intense (indigoaccent). Actif = mauve plus lumineux (indigo-100) +
        // léger fond mauve translucide.
        active
          ? "bg-indigoaccent/20 text-indigo-100 font-medium"
          : "text-indigo-300 hover:bg-indigoaccent/10 hover:text-indigo-100"
      )}
    >
      {/* Barre indicatrice a gauche */}
      <span
        className={cn(
          "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full transition-all",
          active ? "bg-indigoaccent" : "bg-transparent group-hover:bg-indigoaccent/40"
        )}
      />
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-colors",
          active ? "text-indigo-100" : "text-indigo-400 group-hover:text-indigo-200"
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
