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
  resetProposalStatus,
  createPortalContact,
  togglePortalContact,
  deletePortalContact,
  regeneratePortalContactToken,
  markInterviewDone,
  confirmInterviewSlot,
  setPortalWorkflow,
  addDasolabsReply,
  createPortalNeed,
  updatePortalNeed,
  deletePortalNeed,
  assignProposalToNeed
} from "@/server/actions/client-portals";
import { Copy, RefreshCw, Trash2, EyeOff, Eye as EyeIcon, ExternalLink, Pencil, RotateCcw, UserPlus, UserCheck, MessageSquare, Send } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PROPOSED:              { label: "En attente",      cls: "badge-muted" },
  ACCEPTED:              { label: "Accepté",         cls: "badge-success" },
  REJECTED:              { label: "Refusé",          cls: "badge-rose" },
  INTERVIEW_REQUESTED:   { label: "Entretien demandé", cls: "badge-indigo" },
  INTERVIEW_1_REQUESTED: { label: "Entretien 1 demandé", cls: "badge-indigo" },
  INTERVIEW_1_DONE:      { label: "Entretien 1 effectué", cls: "badge-emerald" },
  INTERVIEW_2_REQUESTED: { label: "Entretien 2 demandé", cls: "badge-indigo" },
  INTERVIEW_2_DONE:      { label: "Entretien 2 effectué", cls: "badge-emerald" },
  SHORTLISTED:           { label: "Shortlisté",      cls: "badge-amber" }
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
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-midnight-500">Lien unique du portail (à envoyer au client)</div>
          <div className="flex items-center gap-2">
            <span className={`badge-${portal.workflowVersion === "V2" ? "success" : "muted"} text-[10px]`}>
              Workflow {portal.workflowVersion ?? "LEGACY"}
            </span>
            <button
              onClick={() => {
                const next = portal.workflowVersion === "V2" ? "LEGACY" : "V2";
                if (!window.confirm(`Basculer ce portail vers le workflow ${next} ?`)) return;
                start(async () => {
                  try { await setPortalWorkflow(portal.id, next); toast.success(`Workflow ${next}`); }
                  catch (e: any) { toast.error(e.message); }
                });
              }}
              disabled={pending}
              className="btn-ghost btn-sm text-[10px]"
              title="Bascule workflow LEGACY ↔ V2"
            >Basculer</button>
          </div>
        </div>
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

      {/* Liens personnels par contact */}
      <PersonalLinksSection portalId={portal.id} contacts={portal.personalLinks || []} />

      {/* Besoins / postes ouverts du portail */}
      <PortalNeedsSection portalId={portal.id} needs={portal.needs || []} />

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
                    {/* Rattachement à un besoin du portail (dropdown rapide) */}
                    <ProposalNeedSelect
                      proposalId={p.id}
                      currentNeedId={p.needId ?? null}
                      needs={portal.needs || []}
                    />
                    {!p.needId && (portal.needs?.length ?? 0) > 0 && (
                      <div className="mt-1 text-[11px] text-amber-700">
                        ⚠ Pas de besoin assigné — le candidat apparaîtra sous « Autres profils » côté client.
                      </div>
                    )}
                    {p.actedByContactName && (
                      <div className="mt-2 text-[11px] text-indigo-800 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        Décision par <strong>{p.actedByContactName}</strong>
                        {p.clientActedAt && <span className="text-midnight-500">· {new Date(p.clientActedAt).toLocaleString("fr-BE")}</span>}
                      </div>
                    )}
                    {p.clientMessage && (
                      <div className="mt-2 text-xs bg-indigo-50 border border-indigo-100 rounded p-2 text-indigo-900">
                        <strong>Message client :</strong> {p.clientMessage}
                      </div>
                    )}
                    {p.internalNote && (
                      <div className="mt-1 text-[11px] text-midnight-500">Note interne : {p.internalNote}</div>
                    )}
                    {/* ─── Workflow V2 : créneaux + marquer effectué ─── */}
                    {portal.workflowVersion === "V2" && (
                      <V2InterviewBlock proposal={p} />
                    )}
                    {/* ─── Fil de discussion ─── */}
                    <ProposalCommentsAdmin proposal={p} />
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

// ─── Besoins du portail (ex: "Senior Automation", "Roboticien") ──────────
const NEED_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN:   { label: "Ouvert",   cls: "bg-emerald-100 text-emerald-800" },
  FILLED: { label: "Pourvu",   cls: "bg-blue-100 text-blue-800" },
  CLOSED: { label: "Clôturé",  cls: "bg-slate-200 text-slate-700" }
};

function PortalNeedsSection({ portalId, needs }: { portalId: string; needs: any[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  async function create(fd: FormData) {
    fd.set("portalId", portalId);
    start(async () => {
      try {
        await createPortalNeed(fd);
        toast.success("Besoin ajouté");
        setOpen(false);
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-semibold">Besoins ouverts ({needs.length})</h2>
          <p className="text-xs text-midnight-500 mt-0.5">
            Postes à pourvoir pour ce client. Chaque candidat proposé est rattaché à un besoin pour que le client voie clairement qui est proposé pour quoi.
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setOpen(!open)}>
          + Ajouter un besoin
        </button>
      </div>

      {open && (
        <form action={create} className="mb-3 p-3 border border-indigo-200 bg-indigo-50/40 rounded space-y-2">
          <input name="title" required placeholder="Ex: Senior Automation Engineer" className="input text-sm" maxLength={200} />
          <textarea name="description" placeholder="Contexte, stack, lieu, urgence… (optionnel)" className="input text-sm min-h-[60px] py-2" />
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary btn-sm" disabled={pending}>Ajouter</button>
          </div>
        </form>
      )}

      {needs.length === 0 ? (
        <p className="text-sm text-midnight-500 italic">Aucun besoin pour l'instant. Ajoute-en pour organiser les candidats proposés.</p>
      ) : (
        <div className="space-y-2">
          {needs.map((n) => <NeedRow key={n.id} need={n} />)}
        </div>
      )}
    </div>
  );
}

function NeedRow({ need }: { need: any }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(need.title);
  const [description, setDescription] = useState(need.description ?? "");

  async function saveStatus(status: "OPEN" | "FILLED" | "CLOSED") {
    start(async () => {
      try { await updatePortalNeed(need.id, { status }); toast.success(`Statut → ${NEED_STATUS[status].label}`); }
      catch (e: any) { toast.error(e.message); }
    });
  }
  async function saveEdit() {
    start(async () => {
      try {
        await updatePortalNeed(need.id, { title, description: description || null });
        toast.success("Besoin mis à jour");
        setEditing(false);
      } catch (e: any) { toast.error(e.message); }
    });
  }
  async function remove() {
    if (!confirm(`Supprimer le besoin « ${need.title} » ? Les candidats liés seront détachés mais pas supprimés.`)) return;
    start(async () => {
      try { await deletePortalNeed(need.id); toast.success("Besoin supprimé"); }
      catch (e: any) { toast.error(e.message); }
    });
  }

  const st = NEED_STATUS[need.status] ?? NEED_STATUS.OPEN;
  return (
    <div className="border border-border rounded p-3 bg-white">
      {!editing ? (
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-midnight-900">{need.title}</strong>
              <span className={`text-[10px] px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
            </div>
            {need.description && <div className="text-xs text-midnight-600 mt-1 whitespace-pre-line">{need.description}</div>}
          </div>
          <div className="flex items-center gap-1">
            <select
              value={need.status}
              onChange={(e) => saveStatus(e.target.value as any)}
              disabled={pending}
              className="input input-sm text-xs max-w-[110px]"
            >
              <option value="OPEN">Ouvert</option>
              <option value="FILLED">Pourvu</option>
              <option value="CLOSED">Clôturé</option>
            </select>
            <button onClick={() => setEditing(true)} className="btn-ghost btn-sm">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={remove} disabled={pending} className="btn-ghost btn-sm text-rose-600">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input text-sm min-h-[60px] py-2" />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setEditing(false); setTitle(need.title); setDescription(need.description ?? ""); }} className="btn-ghost btn-sm">Annuler</button>
            <button onClick={saveEdit} disabled={pending} className="btn-primary btn-sm">Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalNeedSelect({ proposalId, currentNeedId, needs }: {
  proposalId: string; currentNeedId: string | null; needs: any[];
}) {
  const [pending, start] = useTransition();
  if (needs.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-midnight-500">Besoin :</span>
      <select
        value={currentNeedId ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          start(async () => {
            try { await assignProposalToNeed(proposalId, next); toast.success(next ? "Candidat rattaché au besoin" : "Candidat détaché"); }
            catch (err: any) { toast.error(err.message); }
          });
        }}
        disabled={pending}
        className="input input-sm text-xs max-w-[280px]"
      >
        <option value="">— Aucun besoin (sous « Autres profils ») —</option>
        {needs.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}{n.status !== "OPEN" ? ` · ${NEED_STATUS[n.status]?.label ?? n.status}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function PersonalLinksSection({ portalId, contacts }: { portalId: string; contacts: any[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  async function copy(token: string) {
    const url = `${window.location.origin}/portal/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  }

  async function create(fd: FormData) {
    fd.set("portalId", portalId);
    start(async () => {
      try {
        await createPortalContact(fd);
        toast.success("Lien personnel créé");
        setOpen(false);
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Liens personnels par contact</h2>
        <button onClick={() => setOpen(!open)} className="btn-secondary btn-sm flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> {open ? "Annuler" : "Ajouter un contact"}
        </button>
      </div>

      <p className="text-xs text-midnight-500 mb-3">
        Chaque contact reçoit son propre lien. Même vue que le lien général,
        mais toute action (accepter / refuser / commentaire) est tracée au contact.
      </p>

      {open && (
        <form action={create} className="border border-indigoaccent/30 bg-indigoaccent/5 rounded p-3 mb-3 grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="label">Nom *</label>
            <input name="name" required className="input" placeholder="Jean Dupont" />
          </div>
          <div className="col-span-4">
            <label className="label">Email</label>
            <input name="email" type="email" className="input" placeholder="jean@client.com" />
          </div>
          <div className="col-span-3">
            <label className="label">Fonction</label>
            <input name="jobTitle" className="input" placeholder="CTO" />
          </div>
          <div className="col-span-1">
            <button disabled={pending} className="btn-primary w-full">OK</button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="text-xs text-midnight-500 italic">Aucun contact personnel — tout passe par le lien général.</p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c: any) => (
            <PersonalLinkRow key={c.id} contact={c} onCopy={() => copy(c.token)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalLinkRow({ contact, onCopy }: { contact: any; onCopy: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className={`border rounded p-2.5 flex items-center gap-3 text-xs ${contact.isActive ? "" : "opacity-50 bg-midnight-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <strong>{contact.name}</strong>
          {contact.jobTitle && <span className="text-midnight-500">· {contact.jobTitle}</span>}
          {contact.email && <span className="text-midnight-500">· {contact.email}</span>}
          {!contact.isActive && <span className="badge-muted text-[10px]">Désactivé</span>}
        </div>
        <div className="text-[10px] text-midnight-500 mt-1 font-mono truncate">
          /portal/{contact.token.slice(0, 10)}… · {contact.viewCount} vue{contact.viewCount > 1 ? "s" : ""}
          {contact.lastViewedAt && ` · vue le ${new Date(contact.lastViewedAt).toLocaleDateString("fr-BE")}`}
        </div>
      </div>
      <button onClick={onCopy} className="btn-ghost btn-sm flex items-center gap-1" title="Copier le lien">
        <Copy className="w-3 h-3" /> Copier
      </button>
      <button
        onClick={() => start(async () => {
          try { await togglePortalContact(contact.id); toast.success(contact.isActive ? "Désactivé" : "Réactivé"); }
          catch (e: any) { toast.error(e.message); }
        })}
        disabled={pending}
        className="btn-ghost btn-sm"
      >
        {contact.isActive ? "Désactiver" : "Réactiver"}
      </button>
      <button
        onClick={() => {
          if (!window.confirm(`Régénérer le lien de « ${contact.name} » ? L'ancien lien ne fonctionnera plus.`)) return;
          start(async () => {
            try { await regeneratePortalContactToken(contact.id); toast.success("Nouveau lien généré"); }
            catch (e: any) { toast.error(e.message); }
          });
        }}
        disabled={pending}
        className="btn-ghost btn-sm flex items-center gap-1 text-amber-700"
        title="Régénérer le token"
      >
        <RefreshCw className="w-3 h-3" />
      </button>
      <button
        onClick={() => {
          if (!window.confirm(`Supprimer définitivement le lien de « ${contact.name} » ?`)) return;
          start(async () => {
            try { await deletePortalContact(contact.id); toast.success("Supprimé"); }
            catch (e: any) { toast.error(e.message); }
          });
        }}
        disabled={pending}
        className="btn-ghost btn-sm text-rose-600"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function ProposalCommentsAdmin({ proposal }: { proposal: any }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const comments = proposal.comments || [];

  function submit() {
    const content = draft.trim();
    if (!content) return;
    start(async () => {
      try {
        await addDasolabsReply({ proposalId: proposal.id, content });
        toast.success("Réponse envoyée au client");
        setDraft("");
      } catch (e: any) { toast.error(e.message); }
    });
  }

  const clientCount = comments.filter((c: any) => c.authorKind === "CLIENT").length;

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-indigoaccent hover:underline font-medium"
      >
        <MessageSquare className="w-3 h-3" />
        Discussion ({comments.length}){clientCount > 0 && ` · ${clientCount} côté client`}
        <span className="text-midnight-500">{open ? " ▲" : " ▼"}</span>
      </button>
      {open && (
        <div className="mt-2 bg-midnight-50 border border-border rounded p-2 space-y-2 max-h-80 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-[11px] text-midnight-500 italic">Aucun commentaire pour l'instant.</p>
          )}
          {comments.map((c: any) => {
            const isDaso = c.authorKind === "DASOLABS";
            return (
              <div key={c.id} className={`flex ${isDaso ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded px-2 py-1.5 ${
                  isDaso
                    ? "bg-indigoaccent/10 border border-indigoaccent/30 text-indigoaccent"
                    : "bg-white border border-border text-midnight-900"
                }`}>
                  <div className={`text-[10px] font-semibold ${isDaso ? "text-indigoaccent" : "text-midnight-500"}`}>
                    {isDaso ? "Dasolabs · " : "Client · "}{c.authorName} · {new Date(c.createdAt).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                  <div className="text-[11px] whitespace-pre-line mt-0.5">{c.content}</div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-1 items-end pt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Répondre au client…"
              className="input flex-1 text-xs"
            />
            <button onClick={submit} disabled={pending || !draft.trim()}
              className="btn-primary btn-sm shrink-0">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function V2InterviewBlock({ proposal }: { proposal: any }) {
  const [pending, start] = useTransition();
  const [notesOpen, setNotesOpen] = useState<null | 1 | 2>(null);
  const [notes, setNotes] = useState("");

  const which: 1 | 2 | null =
    proposal.status === "INTERVIEW_1_REQUESTED" ? 1 :
    proposal.status === "INTERVIEW_2_REQUESTED" ? 2 : null;

  const slots: any[] | null =
    which === 1 ? proposal.interview1Slots :
    which === 2 ? proposal.interview2Slots : null;

  const confirmedAt =
    which === 1 ? proposal.interview1ConfirmedAt :
    which === 2 ? proposal.interview2ConfirmedAt : null;

  if (!which) {
    // En statut DONE : juste rappel des notes
    const doneNotes =
      proposal.status === "INTERVIEW_1_DONE" ? proposal.interview1Notes :
      proposal.status === "INTERVIEW_2_DONE" ? proposal.interview2Notes : null;
    if (!doneNotes) return null;
    return (
      <div className="mt-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">
        <strong>Retour partagé au client :</strong> {doneNotes}
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs bg-indigoaccent/5 border border-indigoaccent/30 rounded p-2 space-y-2">
      <div className="font-semibold text-indigoaccent">Créneaux proposés par le client (entretien {which})</div>
      <ul className="space-y-1">
        {(slots ?? []).map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="text-midnight-700">
              {s.date} · {s.startTime}–{s.endTime} · {s.mode === "VISIO" ? "Visio" : "Sur site"}
            </span>
            {!confirmedAt && (
              <button
                onClick={() => start(async () => {
                  try { await confirmInterviewSlot({ proposalId: proposal.id, which, slotIndex: i }); toast.success("Créneau confirmé"); }
                  catch (e: any) { toast.error(e.message); }
                })}
                disabled={pending}
                className="btn-ghost btn-sm text-emerald-700"
              >Confirmer</button>
            )}
            {confirmedAt && i === 0 && (
              <span className="text-[10px] text-emerald-700">Confirmé le {new Date(confirmedAt).toLocaleString("fr-BE")}</span>
            )}
          </li>
        ))}
      </ul>
      {!notesOpen ? (
        <button
          onClick={() => setNotesOpen(which)}
          className="btn-primary btn-sm"
        >Marquer l'entretien effectué</button>
      ) : (
        <div className="space-y-1">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Retour partagé au client (visible côté client)…"
            className="input w-full text-xs"
          />
          <div className="flex gap-1">
            <button
              onClick={() => start(async () => {
                try {
                  await markInterviewDone({ proposalId: proposal.id, which: notesOpen!, notes });
                  toast.success("Entretien marqué effectué");
                  setNotesOpen(null); setNotes("");
                } catch (e: any) { toast.error(e.message); }
              })}
              disabled={pending}
              className="btn-primary btn-sm"
            >Valider</button>
            <button onClick={() => { setNotesOpen(null); setNotes(""); }} className="btn-ghost btn-sm">Annuler</button>
          </div>
        </div>
      )}
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
