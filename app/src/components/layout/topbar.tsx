"use client";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, ChevronDown, User as UserIcon, Menu, BookOpen, Play, Square } from "lucide-react";
import Link from "next/link";
import { NotificationBell } from "./notification-bell";
import { enableDemoMode, disableDemoMode } from "@/server/actions/demo-mode";

export function Topbar({
  accessGroupName,
  onToggleMenu,
  demoModeActive,
  demoAllowed
}: {
  accessGroupName: string;
  onToggleMenu?: () => void;
  demoModeActive?: boolean;
  demoAllowed?: boolean;
}) {
  const { data: session } = useSession();
  // On détecte la plateforme pour afficher ⌘ (Mac) ou Ctrl (Windows/Linux).
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
    }
  }, []);

  function openPalette() {
    window.dispatchEvent(new CustomEvent("cowork:open-palette"));
  }

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-3 md:px-4 gap-2 md:gap-4 sticky top-0 z-20">
      {/* Hamburger : visible uniquement sur mobile (caché en md+) */}
      {onToggleMenu && (
        <button
          type="button"
          onClick={onToggleMenu}
          className="md:hidden p-2 -ml-1 rounded-md hover:bg-midnight-50 text-midnight-700"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      {/* Trigger du palet de recherche globale (Cmd+K). Visuellement c'est
          un faux input pour la familiarité ; au clic ça ouvre le modal. */}
      <button
        type="button"
        onClick={openPalette}
        className="flex-1 max-w-xl h-9 pl-9 pr-3 rounded-md border border-border bg-muted/40 text-sm text-left text-midnight-400 hover:bg-white hover:border-midnight-300 transition-colors relative flex items-center"
        aria-label="Rechercher (Cmd+K)"
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
        <span className="flex-1">Rechercher…</span>
        <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-midnight-400 font-mono">
          <kbd className="border border-midnight-200 rounded px-1 py-0.5 bg-white">
            {isMac ? "⌘" : "Ctrl"}
          </kbd>
          <kbd className="border border-midnight-200 rounded px-1 py-0.5 bg-white">K</kbd>
        </span>
      </button>
      {/* Raccourci wiki formation — s'ouvre dans un nouvel onglet vers le
          sous-domaine dédié. Discret mais toujours visible. */}
      <a
        href="https://wiki.hub.dasolabs.be"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-md border border-border text-sm text-midnight-700 hover:bg-indigoaccent/5 hover:border-indigoaccent hover:text-indigoaccent transition-colors"
        title="Ouvrir le wiki formation dans un nouvel onglet"
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden md:inline">Wiki</span>
      </a>
      <NotificationBell />
      <UserMenu
        name={session?.user?.name ?? ""}
        accessGroupName={accessGroupName}
        demoModeActive={demoModeActive ?? false}
        demoAllowed={demoAllowed ?? false}
      />
    </header>
  );
}

function DemoToggleIcon({ active, allowed }: { active: boolean; allowed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!allowed && !active) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          try {
            if (active) await disableDemoMode();
            else await enableDemoMode();
            // Reload complet — sinon useSession() garde la session en cache
            window.location.reload();
          } catch (err) {
            alert((err as Error).message);
          }
        });
      }}
      disabled={pending}
      title={active ? "Sortir du mode démo" : "Activer le mode démo"}
      className={[
        "w-7 h-7 rounded-full grid place-items-center transition shadow-sm shrink-0",
        active
          ? "bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300"
          : "bg-orange-500 hover:bg-orange-600 text-white"
      ].join(" ")}
    >
      {active ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
    </button>
  );
}

function UserMenu({
  name,
  accessGroupName,
  demoModeActive,
  demoAllowed
}: {
  name: string;
  accessGroupName: string;
  demoModeActive: boolean;
  demoAllowed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);
  const isVisitor = accessGroupName === "Visiteur";
  return (
    <div className="relative flex items-center gap-1.5" ref={ref}>
      {/* Petit bouton play/stop pour le mode démo, à gauche du nom.
          Bouton client isolé — ne déclenche pas l'ouverture du menu. */}
      <DemoToggleIcon active={demoModeActive} allowed={demoAllowed} />
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-midnight-50">
        <div className="w-8 h-8 rounded-full bg-midnight-900 text-white grid place-items-center text-xs font-semibold">
          {name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase()}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-medium text-midnight-900 leading-tight">{name}</div>
          <div className={"text-[11px] leading-tight " + (isVisitor ? "text-amber-700" : "text-indigoaccent")}>{accessGroupName}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-midnight-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-border rounded-lg shadow-lg p-1">
          <Link href="/me" onClick={() => setOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-midnight-50 rounded-md">
            <UserIcon className="w-4 h-4" /> Mon profil
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-midnight-50 rounded-md">
            <LogOut className="w-4 h-4" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
