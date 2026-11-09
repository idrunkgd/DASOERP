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
  AppWindow, GraduationCap, Files, ReceiptText, HeartPulse, ChevronDown, BookOpen,
  Car, FileSignature, PiggyBank, ArrowUp, ArrowDown, Pencil, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import { type Permission } from "@/lib/rbac";

type NavItem = { href: string; label: string; icon: any; perm?: Permission | Permission[]; allowedRoles?: Role[] };
type Section = { label: string; items: NavItem[] };

const SECTIONS: Section[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/dashboard",         label: "Tableau de bord",      icon: LayoutDashboard, perm: "dashboard.read" },
      { href: "/my-hub",             label: "Mon espace",           icon: UserIcon },
      { href: "/calendar",          label: "Calendrier",           icon: CalendarDays,  perm: "consulting.read" },
      { href: "/commercial",        label: "Activité",             icon: MessageSquare, perm: "contacts.read" },
      { href: "/salary-simulator",  label: "Simulateur package",   icon: Calculator,    perm: "consulting.read" },
      { href: "/cashflow",          label: "Cashflow",             icon: TrendingUp,    perm: "finance.read" },
      { href: "/financial-resume",  label: "Résumé financier",     icon: PiggyBank,     perm: "finance.read" },
      { href: "/logs",              label: "Logs d'erreurs",       icon: FileScan,      perm: "users.manage" },
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
      { href: "/candidates",  label: "Candidats",            icon: UserPlus,        perm: "consulting.read" },
      { href: "/client-portals", label: "Portails clients",   icon: ShieldCheck,     perm: "consulting.write" }
    ]
  },
  {
    label: "Consultance",
    items: [
      { href: "/consultants",      label: "Consultants",          icon: Users,           perm: "consulting.read" },
      { href: "/mission-requests", label: "Demandes de mission",  icon: Headset,         perm: "consulting.read" },
      { href: "/missions",         label: "Missions",             icon: Plane,           perm: ["consulting.read", "self.read"] as Permission[] },
      { href: "/timesheet",        label: "Timesheets",           icon: Clock,           perm: "timesheet.self.write" }
    ]
  },
  {
    label: "Projet",
    items: [
      { href: "/offers",      label: "Offres",                icon: FileText,        perm: "offers.read" },
      { href: "/projects",    label: "Projets",               icon: FolderKanban,    perm: "projects.read" },
      { href: "/timesheet",   label: "Timesheets",            icon: Clock,           perm: "timesheet.self.write" },
      { href: "/purchase-orders", label: "Bons de commande", icon: ShoppingCart, perm: "purchases.read" },
      { href: "/expenses",    label: "Notes de frais",        icon: Receipt,         perm: ["expenses.read", "expenses.write"] as Permission[] },
      { href: "/planning",    label: "Planning",              icon: CalendarRange,   perm: ["planning.read", "self.read"] as Permission[] }
    ]
  },
  {
    label: "Finances",
    items: [
      { href: "/finance",           label: "Facturations",         icon: Receipt,     perm: "finance.read" },
      { href: "/finance/payments",  label: "Historique paiements", icon: Wallet,      perm: "finance.read" }
    ]
  },
  {
    label: "RH & Documents",
    items: [
      { href: "/onboarding",  label: "Onboarding",       icon: GraduationCap,  perm: "onboarding.read" },
      { href: "/leaves",      label: "Congés",           icon: Plane,          perm: ["leaves.read", "self.read"] as Permission[] },
      { href: "/sick-leaves", label: "Arrêts maladie",   icon: HeartPulse,     perm: "users.manage" },
      { href: "/documents",   label: "Documents",        icon: Files,          perm: "documents.read" },
      { href: "/me/documents", label: "Mes documents",   icon: Files,          perm: "self.read" },
      { href: "/tests",       label: "Tests techniques", icon: ClipboardCheck, perm: "tests.manage" },
      { href: "/fleet",       label: "Ma voiture / Flotte", icon: Car,         perm: ["fleet.read", "self.read"] as Permission[] },
      { href: "/contracts",   label: "Contrats",         icon: FileSignature,  perm: "contracts.read" },
      { href: "/policies",    label: "Chartes & politiques", icon: FileText,   perm: ["policies.read", "self.read"] as Permission[] },
      { href: "/training",    label: "Formations techniques", icon: GraduationCap, perm: ["training.read", "self.read"] as Permission[] }
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

/** Clé localStorage — l'état d'ouverture des sections persiste entre refresh.
 *  Bumpée en v2 pour nettoyer les anciennes préférences "tout déplié" et
 *  laisser le nouveau défaut (seulement Pilotage ouvert) prendre le relais. */
const COLLAPSED_KEY = "dasohub-sidebar-collapsed-v2";

/** Clé localStorage — ordre custom des items par section (optionnel, utilisateur).
 *  Forme : { "Pilotage": ["/my-hub", "/dashboard", ...], "Commerciale": [...] }
 *  Les hrefs manquants sont placés à la fin dans l'ordre du code source. */
const ORDER_KEY = "dasohub-sidebar-order-v1";

/** Clé localStorage — mode édition actif (passage en mode drag/réorder). */
const EDITMODE_KEY = "dasohub-sidebar-editmode-v1";

function loadOrder(): Record<string, string[]> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(ORDER_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch { return {}; }
}
function saveOrder(order: Record<string, string[]>) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch { /* noop */ }
}
/** Retourne les items réordonnés selon la préférence user. Les items absents
 *  de la liste persistée (nouveautés ajoutées plus tard dans le code) sont
 *  concaténés à la fin dans l'ordre d'origine. */
function applyOrder<T extends { href: string }>(items: T[], saved: string[] | undefined): T[] {
  if (!saved || saved.length === 0) return items;
  const byHref = new Map(items.map((i) => [i.href, i]));
  const out: T[] = [];
  for (const href of saved) {
    const found = byHref.get(href);
    if (found) { out.push(found); byHref.delete(href); }
  }
  // Les nouveautés pas encore dans la pref user → à la fin
  for (const it of items) if (byHref.has(it.href)) out.push(it);
  return out;
}

export function Sidebar({
  role,
  permissions,
  restricted = false,
  mobileOpen = false,
  onMobileClose,
  demoModeActive = false,
  demoAllowed = false
}: {
  role: Role;
  permissions: Permission[];
  restricted?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** True si le cookie demo-mode=1 est présent → on affiche le bouton "Sortir" */
  demoModeActive?: boolean;
  /** True si l'utilisateur peut activer le mode démo (Admin/Manager) */
  demoAllowed?: boolean;
}) {
  const path = usePathname();
  const permSet = useMemo(() => new Set(permissions), [permissions]);

  // ─── Ordre custom des items (persisté localStorage par user) ───
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    setOrder(loadOrder());
    try {
      if (localStorage.getItem(EDITMODE_KEY) === "1") setEditMode(true);
    } catch { /* noop */ }
  }, []);
  function toggleEditMode() {
    const next = !editMode;
    setEditMode(next);
    try { localStorage.setItem(EDITMODE_KEY, next ? "1" : "0"); } catch { /* noop */ }
  }
  function moveItem(sectionLabel: string, visibleHrefs: string[], href: string, dir: -1 | 1) {
    const idx = visibleHrefs.indexOf(href);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= visibleHrefs.length) return;
    const next = [...visibleHrefs];
    [next[idx], next[target]] = [next[target], next[idx]];
    const updated = { ...order, [sectionLabel]: next };
    setOrder(updated);
    saveOrder(updated);
  }

  // Badges dynamiques par route (docs à signer, tâches, demandes, factures…).
  // Une seule requête GET /api/nav-badges renvoie la map complète, rafraîchie
  // toutes les 60s + à chaque navigation (path change) pour refléter les
  // actions faites par l'user sans qu'il attende le prochain tick.
  const [badges, setBadges] = useState<Record<string, number>>({});
  useEffect(() => {
    if (restricted) return;
    let cancelled = false;
    async function fetchBadges() {
      try {
        const r = await fetch("/api/nav-badges", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setBadges(j ?? {});
      } catch { /* ignore */ }
    }
    fetchBadges();
    const t = setInterval(fetchBadges, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [restricted, path]);

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
    <div className="border-t border-white/10">
      {/* Le toggle mode démo est maintenant dans le topbar (petit bouton play
          orange à côté du nom) — retiré d'ici pour ne pas doubler l'UI. */}
      <div className="px-4 py-3 text-[11px] text-indigo-200/70 flex items-center justify-between">
        <span>v0.2.1</span>
        <button
          type="button"
          onClick={toggleEditMode}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded transition-colors",
            editMode
              ? "bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40"
              : "text-indigo-300/70 hover:bg-white/10 hover:text-indigo-100"
          )}
          title={editMode ? "Terminer la réorganisation" : "Réorganiser le menu"}
        >
          {editMode ? <><Check className="w-3 h-3" /> Terminer</> : <><Pencil className="w-3 h-3" /> Réorganiser</>}
        </button>
      </div>
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
          const filtered = section.items.filter((item) => {
            if (item.allowedRoles && !item.allowedRoles.includes(role)) return false;
            if (item.perm) {
              const needed = Array.isArray(item.perm) ? item.perm : [item.perm];
              if (!needed.some((p) => permSet.has(p))) return false;
            }
            return true;
          });
          if (filtered.length === 0) return null;
          // Applique l'ordre custom (si défini pour cette section)
          const visibleItems = applyOrder(filtered, order[section.label]);
          // Une section reste dépliée d'office si la route active tombe dedans
          const containsActive = visibleItems.some(
            (i) => path === i.href || path.startsWith(i.href + "/")
          );
          const visibleHrefs = visibleItems.map((i) => i.href);
          return (
            <SidebarSection
              key={section.label}
              label={section.label}
              items={visibleItems}
              path={path}
              forceOpen={containsActive || editMode}
              badges={badges}
              editMode={editMode}
              onMove={(href, dir) => moveItem(section.label, visibleHrefs, href, dir)}
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
  forceOpen,
  badges = {},
  editMode = false,
  onMove
}: {
  label: string;
  items: NavItem[];
  path: string;
  forceOpen: boolean;
  badges?: Record<string, number>;
  editMode?: boolean;
  onMove?: (href: string, dir: -1 | 1) => void;
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
          {items.map((item, idx) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            return (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
                badge={badges[item.href] ?? 0}
                editMode={editMode}
                canMoveUp={idx > 0}
                canMoveDown={idx < items.length - 1}
                onMove={onMove ? (dir) => onMove(item.href, dir) : undefined}
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
  href, icon: Icon, label, active, badge = 0,
  editMode = false, canMoveUp = false, canMoveDown = false, onMove
}: {
  href: string;
  icon: any;
  label: string;
  active: boolean;
  badge?: number;
  editMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (dir: -1 | 1) => void;
}) {
  const content = (
    <>
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
      <span className="truncate flex-1">{label}</span>
      {editMode ? (
        <span className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove?.(-1); }}
            disabled={!canMoveUp}
            className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Monter"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove?.(1); }}
            disabled={!canMoveDown}
            className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Descendre"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </span>
      ) : badge > 0 ? (
        <span
          className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white min-w-[1.25rem] text-center leading-tight"
          title={`${badge} en attente`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );
  const cls = cn(
    "group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100",
    active
      ? "bg-indigoaccent/20 text-indigo-100 font-medium"
      : "text-indigo-300 hover:bg-indigoaccent/10 hover:text-indigo-100",
    editMode && "ring-1 ring-indigo-400/30 bg-indigoaccent/5"
  );
  // En mode édition : pas de navigation (les flèches gèrent le move)
  if (editMode) {
    return <div className={cls}>{content}</div>;
  }
  return <Link href={href} className={cls}>{content}</Link>;
}
