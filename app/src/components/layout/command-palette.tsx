"use client";
// Palet de recherche globale style Linear/Notion : raccourci Cmd+K (Mac) /
// Ctrl+K (Windows), modal centrée, navigation au clavier, résultats groupés
// par type. Réutilise l'API existante /api/search qui respecte déjà la RBAC.
//
// L'état d'ouverture est exposé via un événement custom 'cowork:open-palette'
// pour que la topbar puisse aussi déclencher l'ouverture au clic.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Users,
  FileText,
  FolderKanban,
  ShoppingCart,
  UserCog,
  Headset,
  Plane,
  UserPlus,
  Briefcase,
  BookOpen,
  GraduationCap
} from "lucide-react";

type Result = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const TYPE_META: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  company:    { label: "Entreprises",  icon: Building2,    color: "text-blue-500" },
  contact:    { label: "Contacts",     icon: Users,        color: "text-emerald-500" },
  offer:      { label: "Offres",       icon: FileText,     color: "text-violet-500" },
  project:    { label: "Projets",      icon: FolderKanban, color: "text-amber-500" },
  purchase:   { label: "Achats",       icon: ShoppingCart, color: "text-orange-500" },
  user:       { label: "Utilisateurs", icon: UserCog,      color: "text-midnight-500" },
  demande:    { label: "Demandes",     icon: Headset,      color: "text-sky-500" },
  mission:    { label: "Missions",     icon: Plane,        color: "text-indigo-500" },
  candidate:  { label: "Candidats",    icon: UserPlus,     color: "text-pink-500" },
  consultant: { label: "Consultants",  icon: Briefcase,    color: "text-indigoaccent" },
  wiki:       { label: "Wiki",         icon: BookOpen,     color: "text-teal-500" },
  onboarding: { label: "Onboarding",   icon: GraduationCap, color: "text-rose-500" }
};

// Ordre d'affichage des groupes (les types absents sont mis à la fin)
const TYPE_ORDER = [
  "company",
  "contact",
  "offer",
  "project",
  "demande",
  "mission",
  "candidate",
  "consultant",
  "onboarding",
  "wiki",
  "purchase",
  "user"
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Raccourcis globaux : Cmd+K / Ctrl+K toggle, Escape ferme.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Permet à la topbar de l'ouvrir par clic via dispatchEvent
  useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("cowork:open-palette", onOpenEvent);
    return () => window.removeEventListener("cowork:open-palette", onOpenEvent);
  }, []);

  // Focus l'input à l'ouverture, reset au close.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ("");
      setResults([]);
      setActiveIdx(0);
    }
  }, [open]);

  // Debounced fetch sur /api/search.
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal
        });
        if (r.ok) {
          const data = await r.json();
          // Trie par type selon l'ordre voulu
          const sorted: Result[] = (data.results ?? []).slice().sort(
            (a: Result, b: Result) =>
              (TYPE_ORDER.indexOf(a.type) === -1 ? 99 : TYPE_ORDER.indexOf(a.type)) -
              (TYPE_ORDER.indexOf(b.type) === -1 ? 99 : TYPE_ORDER.indexOf(b.type))
          );
          setResults(sorted);
          setActiveIdx(0);
        }
      } catch {
        // ignore les aborts
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, open]);

  // Navigation clavier (↑ ↓ Entrée) dans la liste.
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) {
        router.push(r.href);
        setOpen(false);
      }
    }
  }

  if (!open) return null;

  // Groupe par type (en gardant l'ordre du tableau "results" qui est déjà trié)
  const grouped: { type: string; items: Result[] }[] = [];
  for (const r of results) {
    const last = grouped[grouped.length - 1];
    if (last && last.type === r.type) last.items.push(r);
    else grouped.push({ type: r.type, items: [r] });
  }

  // Pour mapper l'index global (utilisé par activeIdx) sur chaque item :
  let cursor = -1;
  const indexOfItem = (item: Result) => results.indexOf(item);

  return (
    <div
      className="fixed inset-0 z-50 bg-midnight-900/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-auto mt-[12vh] w-[92%] max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-midnight-100">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-midnight-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Rechercher entreprises, contacts, projets, offres..."
            className="w-full h-14 pl-11 pr-16 text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase text-midnight-500 border border-midnight-200 rounded px-1.5 py-0.5 hover:bg-midnight-50"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <EmptyHint />
          ) : loading && results.length === 0 ? (
            <div className="p-8 text-center text-xs text-midnight-400">
              Recherche…
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-midnight-400">
              Aucun résultat pour <span className="font-medium">« {q} »</span>.
            </div>
          ) : (
            <div className="py-2">
              {grouped.map((g) => {
                const meta = TYPE_META[g.type] ?? {
                  label: g.type,
                  icon: Search,
                  color: "text-midnight-500"
                };
                const Icon = meta.icon;
                return (
                  <div key={g.type} className="mb-1">
                    <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-midnight-400 font-semibold">
                      {meta.label}
                    </div>
                    {g.items.map((r) => {
                      const idx = indexOfItem(r);
                      const active = idx === activeIdx;
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => {
                            router.push(r.href);
                            setOpen(false);
                          }}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`w-full px-4 py-2 text-left flex items-center gap-3 text-sm transition-colors ${
                            active ? "bg-indigoaccent/10" : "hover:bg-midnight-50"
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-midnight-900 truncate">
                              {r.title}
                            </div>
                            {r.subtitle && (
                              <div className="text-[11px] text-midnight-500 truncate">
                                {r.subtitle}
                              </div>
                            )}
                          </div>
                          {active && (
                            <span className="text-[10px] text-midnight-400">↵</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-midnight-100 px-3 py-1.5 flex items-center justify-between text-[10px] text-midnight-400">
          <div className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>naviguer</span>
            <Kbd>↵</Kbd>
            <span>ouvrir</span>
          </div>
          <div className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            <span>fermer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="p-8 text-center text-xs text-midnight-400">
      Tape au moins 2 caractères pour rechercher.
      <div className="mt-3 text-[10px] text-midnight-300">
        Cherche dans tes entreprises, contacts, projets, offres, missions,
        candidats, consultants, achats, utilisateurs.
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-midnight-50 border border-midnight-200 text-midnight-700 font-mono text-[10px]">
      {children}
    </span>
  );
}
