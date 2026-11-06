"use client";
/**
 * Bouton + modal pour qu'un manager RH modifie N'IMPORTE QUELLE demande de
 * congé — y compris APPROVED. Les jours sont recalculés automatiquement par
 * computeLeaveBalance() (pas de gestion manuelle du solde côté serveur).
 */
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { updateLeaveRequest } from "@/server/actions/leave-requests";

type Props = {
  id: string;
  userLabel: string;
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  days: number;
  type: "ANNUAL" | "RTT" | "CARRIED_OVER" | "UNPAID" | "SPECIAL" | "OTHER";
  reason: string | null;
  notes: string | null;
};

export function EditLeaveButton(p: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setMounted(true); }, []);

  const [startDate, setStartDate] = useState(p.startDate);
  const [endDate, setEndDate] = useState(p.endDate);
  const [days, setDays] = useState(String(p.days));
  const [type, setType] = useState(p.type);
  const [reason, setReason] = useState(p.reason ?? "");
  const [notes, setNotes] = useState(p.notes ?? "");

  function reset() {
    setStartDate(p.startDate);
    setEndDate(p.endDate);
    setDays(String(p.days));
    setType(p.type);
    setReason(p.reason ?? "");
    setNotes(p.notes ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    fd.set("days", days);
    fd.set("type", type);
    fd.set("reason", reason);
    fd.set("notes", notes);
    start(async () => {
      try {
        await updateLeaveRequest(p.id, fd);
        toast.success("Congé modifié");
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
      onClick={() => { setOpen(false); reset(); }}
    >
      <form
        onSubmit={submit}
        className="card p-6 w-full max-w-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={() => { setOpen(false); reset(); }} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg mb-1">Modifier le congé</h2>
        <p className="text-xs text-midnight-500 mb-4">
          {p.userLabel} — ajuste dates, jours ou type. Le solde est recalculé automatiquement.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Jours ouvrés</label>
            <input type="number" step="0.5" min="0.5" value={days} onChange={(e) => setDays(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="input">
              <option value="ANNUAL">Légaux</option>
              <option value="RTT">RTT</option>
              <option value="CARRIED_OVER">Report N-1</option>
              <option value="UNPAID">Sans solde</option>
              <option value="SPECIAL">Spécial</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Motif</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="input" maxLength={500} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes internes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[60px] py-2" maxLength={1000} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button type="button" onClick={() => { setOpen(false); reset(); }} className="btn-ghost">Annuler</button>
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
        className="text-midnight-600 hover:bg-midnight-50 rounded p-1"
        title="Modifier (manager RH)"
      >
        <Pencil className="w-4 h-4" />
      </button>
      {modal}
    </>
  );
}
