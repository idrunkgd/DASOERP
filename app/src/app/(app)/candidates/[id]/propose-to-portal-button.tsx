"use client";
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createProposal } from "@/server/actions/client-portals";
import { toast } from "sonner";
import { Share2 } from "lucide-react";

type Portal = { id: string; name: string; companyName: string };

export function ProposeToPortalButton({
  candidateId,
  candidateName,
  suggestedRate,
  portals
}: {
  candidateId: string;
  candidateName: string;
  suggestedRate?: number;
  portals: Portal[];
}) {
  const [open, setOpen] = useState(false);
  const [portalId, setPortalId] = useState("");
  const [rate, setRate] = useState<number>(suggestedRate || 0);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  // Groupement par société pour l'optgroup
  const byCompany: Record<string, Portal[]> = {};
  for (const p of portals) {
    (byCompany[p.companyName] ||= []).push(p);
  }

  function submit() {
    if (!portalId) { toast.error("Choisis un portail"); return; }
    if (!rate || rate <= 0) { toast.error("TJM invalide"); return; }
    const fd = new FormData();
    fd.set("portalId", portalId);
    fd.set("candidateId", candidateId);
    fd.set("proposedDailyRate", String(rate));
    if (note) fd.set("internalNote", note);
    start(async () => {
      try {
        await createProposal(fd);
        toast.success("Candidat proposé au client");
        setOpen(false); setPortalId(""); setNote("");
      } catch (e: any) { toast.error(e.message); }
    });
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
        {portals.length === 0 ? (
          <>
            <h2 className="font-semibold mb-2">Aucun portail client actif</h2>
            <p className="text-sm text-midnight-500 mb-4">
              Tu dois d'abord créer un portail (un lien unique par client/équipe) avant de pouvoir y proposer un candidat.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-ghost">Fermer</button>
              <Link href="/client-portals/new" className="btn-primary">Créer un portail</Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold mb-1">Proposer {candidateName}</h2>
            <h2 className="font-semibold mb-1">Proposer {candidateName}</h2>
            <p className="text-xs text-midnight-500 mb-4">
              Le candidat apparaîtra immédiatement dans le portail choisi, avec le TJM que tu indiques ici.
              Aucun autre info interne n'est partagée.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Portail client *</label>
                <select value={portalId} onChange={(e) => setPortalId(e.target.value)} className="input">
                  <option value="">Sélectionner…</option>
                  {Object.entries(byCompany).map(([company, ps]) => (
                    <optgroup key={company} label={company}>
                      {ps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">TJM proposé client (€ HT / jour) *</label>
                <input type="number" min="0" step="1" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="input" />
                {suggestedRate ? (
                  <p className="text-[11px] text-midnight-500 mt-1">Suggestion depuis la simulation : {suggestedRate} €/j</p>
                ) : null}
              </div>
              <div>
                <label className="label">Note interne (optionnel)</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="input"
                  placeholder="Visible UNIQUEMENT en interne. Jamais côté client." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
              <button onClick={submit} disabled={pending} className="btn-primary">
                {pending ? "..." : "Proposer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm flex items-center gap-1">
        <Share2 className="w-3 h-3" /> Proposer à…
      </button>
      {modal}
    </>
  );
}
