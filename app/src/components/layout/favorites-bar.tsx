"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addFavorite, removeFavorite } from "@/server/actions/favorites";

export type Favorite = {
  id: string;
  label: string;
  href: string;
  icon: string | null;
};

const MAX = 10;

/**
 * Barre de favoris sous le topbar. Affiche jusqu'à 10 raccourcis
 * personnels avec un "+" qui pré-remplit la page courante (label =
 * titre du <title>, href = pathname). Chaque favori a un petit ×
 * au hover pour retirer.
 */
export function FavoritesBar({ initial }: { initial: Favorite[] }) {
  const [favorites, setFavorites] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const pathname = usePathname();
  const [pending, start] = useTransition();

  // Ré-hydrate depuis le serveur quand on ferme la popover
  useEffect(() => {
    setFavorites(initial);
  }, [initial]);

  const atMax = favorites.length >= MAX;
  const currentIsFavorite = favorites.some((f) => f.href === pathname);

  function handleAdd(fd: FormData) {
    start(async () => {
      try {
        await addFavorite(fd);
        toast.success("Favori ajouté");
        setShowAdd(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function handleRemove(id: string) {
    start(async () => {
      try {
        await removeFavorite(id);
        setFavorites((list) => list.filter((f) => f.id !== id));
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Rien à afficher si aucun favori ET pas de bouton visible → on
  // affiche quand même la barre avec le +, pour découvrabilité.

  return (
    <div className="bg-muted/30 border-b border-border px-3 md:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
      <Star className="w-3.5 h-3.5 text-midnight-400 flex-shrink-0" />
      {favorites.length === 0 && (
        <span className="text-xs text-midnight-400 italic mr-2">
          Aucun favori — clique sur + pour épingler cette page
        </span>
      )}
      {favorites.map((f) => (
        <FavoriteChip
          key={f.id}
          favorite={f}
          active={f.href === pathname}
          onRemove={() => handleRemove(f.id)}
          disabled={pending}
        />
      ))}
      {!atMax && !currentIsFavorite && (
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-midnight-300 text-midnight-500 hover:border-indigoaccent hover:text-indigoaccent hover:bg-white"
            title={`Épingler cette page (${favorites.length}/${MAX})`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {showAdd && (
            <AddPopover
              defaultHref={pathname}
              onClose={() => setShowAdd(false)}
              onSubmit={handleAdd}
              pending={pending}
            />
          )}
        </div>
      )}
      {atMax && (
        <span className="text-[10px] text-midnight-400 ml-1">
          {MAX}/{MAX} — retire un favori pour en ajouter un autre
        </span>
      )}
    </div>
  );
}

function FavoriteChip({
  favorite, active, onRemove, disabled
}: {
  favorite: Favorite;
  active: boolean;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="group relative flex-shrink-0">
      <Link
        href={favorite.href}
        className={
          "inline-flex items-center px-2.5 h-6 rounded-full text-xs border transition-colors pr-6 " +
          (active
            ? "bg-indigoaccent text-white border-indigoaccent"
            : "bg-white border-border text-midnight-700 hover:border-indigoaccent hover:text-indigoaccent")
        }
        title={favorite.href}
      >
        <span className="truncate max-w-[140px]">{favorite.label}</span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={
          "absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity " +
          (active
            ? "text-white hover:bg-white/20"
            : "text-midnight-400 hover:bg-red-50 hover:text-red-600")
        }
        title="Retirer ce favori"
        aria-label="Retirer"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

function AddPopover({
  defaultHref, onClose, onSubmit, pending
}: {
  defaultHref: string;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [defaultLabel, setDefaultLabel] = useState("");

  // Récupère un label par défaut basé sur le titre de la page,
  // ou dérive du pathname si document.title est vide.
  useEffect(() => {
    const title = typeof document !== "undefined" ? document.title : "";
    // On enlève " · Dasohub" ou pattern similaire
    const cleaned = title.split(" · ")[0].split(" — ")[0].trim();
    if (cleaned) setDefaultLabel(cleaned);
    else setDefaultLabel(defaultHref.split("/").filter(Boolean).slice(-1)[0] ?? "");
  }, [defaultHref]);

  // Fermeture au clic extérieur
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // Défère l'écouteur pour éviter de capter le clic qui a ouvert la popover
    const t = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-8 left-0 z-30 w-72 bg-white border border-border rounded-lg shadow-lg p-3"
    >
      <div className="text-xs font-semibold text-midnight-700 mb-2">Ajouter un favori</div>
      <form action={onSubmit} className="space-y-2">
        <div>
          <label className="text-[10px] text-midnight-500 uppercase tracking-wide">Nom</label>
          <input
            name="label"
            required
            maxLength={60}
            defaultValue={defaultLabel}
            className="input text-sm"
            placeholder="Ex: Cashflow 2026"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] text-midnight-500 uppercase tracking-wide">Adresse</label>
          <input
            name="href"
            required
            defaultValue={defaultHref}
            className="input text-sm font-mono text-xs"
            placeholder="/cashflow"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            Annuler
          </button>
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            Épingler
          </button>
        </div>
      </form>
    </div>
  );
}
