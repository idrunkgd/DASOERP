"use client";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Search, LogOut, ChevronDown, User as UserIcon, Menu } from "lucide-react";
import Link from "next/link";

type Result = {
  type: "company" | "contact" | "offer" | "project" | "purchase" | "user";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export function Topbar({ accessGroupName, onToggleMenu }: { accessGroupName: string; onToggleMenu?: () => void }) {
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data = await r.json();
        setResults(data.results ?? []);
        setOpen(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

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
      <div className="flex-1 max-w-xl relative" ref={ref}>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-midnight-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Rechercher..."
          className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-muted/40 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigoaccent/30"
        />
        {open && results.length > 0 && (
          <div className="absolute mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
            {results.map((r) => (
              <Link
                key={`${r.type}-${r.id}`}
                href={r.href}
                onClick={() => { setOpen(false); setQ(""); }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-midnight-50 text-sm"
              >
                <span className="badge-info uppercase">{r.type}</span>
                <span className="font-medium text-midnight-900">{r.title}</span>
                {r.subtitle && <span className="text-midnight-500 truncate">— {r.subtitle}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
      <UserMenu name={session?.user?.name ?? ""} accessGroupName={accessGroupName} />
    </header>
  );
}

function UserMenu({ name, accessGroupName }: { name: string; accessGroupName: string }) {
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
    <div className="relative" ref={ref}>
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
