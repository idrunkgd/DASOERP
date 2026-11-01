"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  updateClientPortal,
  regenerateClientPortalToken,
  deleteClientPortal,
  retractProposal,
  restoreProposal,
  updateProposalRate,
  resetProposalStatus
} from "@/server/actions/client-portals";
import { Copy, RefreshCw, Trash2, EyeOff, Eye as EyeIcon, ExternalLink, Pencil, RotateCcw } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PROPOSED:            { label: "En attente",      cls: "badge-muted" },
  ACCEPTED:            { label: "Accepté",         cls: "badge-success" },
  REJECTED:            { label: "Refusé",          cls: "badge-rose" },
  INTERVIEW_REQUESTED: { label: "Entretien demandé", cls: "badge-indigo" }
};

export function PortalDetailPanel({ portal }: { portal: any }) {
  const [pending, start] = useTransition();
  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/portal/${portal.token}`
    : `/portal/${portal.token}`;

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Lien copié dans le presse-papier");
  }

  async function regenerate() {
    if (!confirm("Régénérer le token invalidera l'ancien lien côté client. Continuer ?")) return;
    start(async () => {
      try {
        await regenerateClientPortalToken(portal.id);
        toast.success("Nouveau lien généré");
      } catch (e: any) { toast.error(e.message); }
    });
  }

  async function remove() {
    if (!confirm(`Supprimer le portail « ${portal.name} » ? Les propositions seront supprimées aussi.`)) return;
    start(async () => {
      try { await deleteClientPortal(portal.id); } catch (e: any) { toast.error(e.message); }
    });
  }

  async function toggleActive() {
    const fd = new FormData();
    fd.set("name", portal.name);
    fd.set("companyId", portal.companyId);
    if (portal.logoUrl) fd.set("logoUrl", portal.logoUrl);
    if (portal.contactName) fd.set("contactName", portal.contactName);
    if (portal.contactEmail) fd.set("contactEmail", portal.contactEmail);
    if (portal.notes) fd.set("notes", portal.notes);
    fd.set("isActive", portal.isActive ? "" : "true");
    start(async () => {
      try {
        await updateClientPortal(portal.id, fd);
        toast.success(portal.isActive ? "Portail désactivé" : "Portail réactivé");
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="space-y-6">
      {/* Lien public */}
      <div className="card p-4">
        <div className="text-xs text-midnight-500 mb-1">Lien unique du portail (à envoyer au client)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-midnight-50 border rounded px-3 py-2 text-xs font-mono truncate">{publicUrl}</code>
          <button onClick={copyLink} className="btn-secondary btn-sm flex items-center gap-1"><Copy className="w-3 h-3" /> Copier</button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Ouvrir
          </a>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-midnight-500">
          <button onClick={regenerate} disabled={pending} className="btn-ghost btn-sm flex items-center gap-1 text-amber-700">
            <RefreshCw className="w-3 h-3" /> Régénérer le lien
          </button>
          <button onClick={toggleActive} disabled={pending} className="btn-ghost btn-sm flex items-center gap-1">
            {portal.isActive ? "Désactiver" : "Réactiver"}
          </button>
          <button onClick={remove} disabled={pending} className="btn-ghost btn-sm flex items-center gap-1 text-rose-600">
            <Trash2 className="w-3 h-3" /> Supprimer
          </button>
        </div>
      </div>

      {/* Propositions */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Candidats proposés</h2>
        {portal.proposals.length === 0 ? (
          <p className="text-sm text-midnight-500">Aucun candidat proposé pour l'instant. Utilise le bouton « Proposer à » sur une fiche candidat.</p>
        ) : (
          <div className="space-y-2">
            {portal.proposals.map((p: any) => {
              const sb = STATUS_BADGE[p.status] || STATUS_BADGE.PROPOSED;
              return (
                <div key={p.id} className={`border rounded-lg p-3 flex gap-3 items-start ${!p.isVisible ? "opacity-50" : ""}`}>
                  {p.candidate.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.candidate.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-sm font-semibold">
                      {p.candidate.firstName?.[0]}{p.candidate.lastName?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/candidates/${p.candidate.id}`} className="font-medium hover:underline">
                        {p.candidate.firstName} {p.candidate.lastName}
                      </Link>
                      <span className={`${sb.cls} text-[10px]`}>{sb.label}</span>
                      {!p.isVisible && <span className="badge-muted text-[10px]">Masqué côté client</span>}
                    </div>
                    {p.candidate.cvContactRole && <div className="text-xs text-midnight-500 truncate">{p.candidate.cvContactRole}</div>}
                    <div className="mt-1 text-xs text-midnight-600">
                      TJM proposé client : <strong>{Number(p.proposedDailyRate)} €/j HT</strong>
                      {p.candidate.yearsExperience ? ` · ${p.candidate.yearsExperience} ans d'XP` : ""}
                    </div>
                    {p.clientMessage && (
                      <div className="mt-2 text-xs bg-indigo-50 border border-indigo-100 rounded p-2 text-indigo-900">
                        <strong>Message client :</strong> {p.clientMessage}
                      </div>
                    )}
                    {p.internalNote && (
                      <div className="mt-1 text-[11px] text-midnight-500">Note interne : {p.internalNote}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <RateEditor id={p.id} current={Number(p.proposedDailyRate)} internalNote={p.internalNote} />
                    {p.status !== "PROPOSED" && (
                      <button
                        onClick={() => {
                          if (!window.confirm(`Repasser « ${p.candidate.firstName} ${p.candidate.lastName} » en « En attente » ? Le client pourra à nouveau répondre.`)) return;
                          start(async () => {
                            try { await resetProposalStatus(p.id); toast.success("Statut réinitialisé"); }
                            catch (e: any) { toast.error(e.message); }
                          });
                        }}
                        disabled={pending}
                        className="btn-ghost btn-sm flex items-center gap-1 text-indigo-700"
                      ><RotateCcw className="w-3 h-3" /> En attente</button>
                    )}
                    {p.isVisible ? (
                      <button
                        onClick={() => start(async () => { try { await retractProposal(p.id); toast.success("Masqué"); } catch (e: any) { toast.error(e.message); } })}
                        disabled={pending}
                        className="btn-ghost btn-sm flex items-center gap-1 text-amber-700"
                      ><EyeOff className="w-3 h-3" /> Masquer</button>
                    ) : (
                      <button
                        onClick={() => start(async () => { try { await restoreProposal(p.id); toast.success("Rendu visible"); } catch (e: any) { toast.error(e.message); } })}
                        disabled={pending}
                        className="btn-ghost btn-sm flex items-center gap-1 text-emerald-700"
                      ><EyeIcon className="w-3 h-3" /> Afficher</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RateEditor({ id, current, internalNote }: { id: string; current: number; internalNote: string | null }) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(current);
  const [note, setNote] = useState(internalNote || "");
  const [pending, start] = useTransition();
  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost btn-sm flex items-center gap-1"><Pencil className="w-3 h-3" /> TJM</button>;
  return (
    <div className="flex items-center gap-1">
      <input type="number" step="1" min="0" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="input input-sm w-20" />
      <button
        onClick={() => start(async () => { try { await updateProposalRate(id, rate, note); toast.success("Tarif mis à jour"); setOpen(false); } catch (e: any) { toast.error(e.message); } })}
        disabled={pending}
        className="btn-primary btn-sm"
      >OK</button>
      <button onClick={() => setOpen(false)} className="btn-ghost btn-sm">×</button>
    </div>
  );
}
