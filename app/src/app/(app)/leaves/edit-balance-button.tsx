"use client";
/**
 * Bouton + modal pour éditer directement le solde (entitled) d'un bucket
 * (Légaux / RTT / Report N-1) d'un consultant pour l'année en cours.
 * Réservé aux managers RH (leaves.approve). Le solde restant se recalcule
 * automatiquement à partir de entitled - approved.
 */
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { setLeaveBalanceEntitled } from "@/server/actions/leave-requests";

export function EditBalanceButton({
  userId, userLabel, year,
  legalEntitled, rttEntitled, carriedEntitled
}: {
  userId: string;
  userLabel: string;
  year: number;
  legalEntitled: number;
  rttEntitled: number;
  carriedEntitled: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setMounted(true); }, []);

  const [legal, setLegal] = useState(String(legalEntitled));
  const [rtt, setRtt] = useState(String(rttEntitled));
  const [carried, setCarried] = useState(String(carriedEntitled));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(legal), b = Number(rtt), c = Number(carried);
    if (isNaN(a) || isNaN(b) || isNaN(c)) return toast.error("Valeurs invalides");
    start(async () => {
      try {
        await Promise.all([
          setLeaveBalanceEntitled({ userId, year, type: "ANNUAL_LEGAL", entitled: a }),
          setLeaveBalanceEntitled({ userId, year, type: "RTT",          entitled: b }),
          setLeaveBalanceEntitled({ userId, year, type: "CARRIED_OVER", entitled: c })
        ]);
        toast.success(`Soldes ${year} mis à jour`);
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  const modal = open && mounted ? createPortal((
    <div
      className="fixed inset-0 z-[9999] bg-black/50 grid place-items-center p-4 overflow-y-auto"
      onClick={() => setOpen(false)}
    >
      <form onSubmit={submit} className="card p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg">Modifier les soldes {year}</h2>
        <p className="text-xs text-midnight-500 mb-4">
          {userLabel} — les jours restants se recalculent automatiquement.
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Congés légaux (j)</label>
            <input type="number" step="0.5" min="0" max="100" value={legal} onChange={(e) => setLegal(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">RTT (j)</label>
            <input type="number" step="0.5" min="0" max="100" value={rtt} onChange={(e) => setRtt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Report N-1 (j)</label>
            <input type="number" step="0.5" min="0" max="100" value={carried} onChange={(e) => setCarried(e.target.value)} className="input" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  ), document.body) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1"
        title="Modifier les soldes"
      >
        <Pencil className="w-3 h-3" /> Modifier solde
      </button>
      {modal}
    </>
  );
}
