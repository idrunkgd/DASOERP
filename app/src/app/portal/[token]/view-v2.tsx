"use client";
/**
 * Vue V2 du portail client — workflow multi-étapes (entretien 1 → 2 →
 * shortlist → accepté) avec 3 créneaux proposables par entretien.
 *
 * UI dans la charte Hub Dasolabs (midnight / indigoaccent / cards white
 * avec border-border). Reste public — aucune session, aucune navigation
 * Hub autour.
 */
import { useState, useTransition } from "react";
import { respondToProposalV2 } from "@/server/actions/client-portal-public";
import {
  User, MapPin, Check, X, CalendarCheck, Users as UsersIcon,
  Clock, Video, Building2, Plus, Trash2, FileDown, Eye
} from "lucide-react";

type Slot = { date: string; startTime: string; endTime: string; mode: "VISIO" | "ONSITE" };

type Proposal = {
  id: string;
  status: string;
  proposedDailyRate: number;
  clientMessage: string | null;
  actedByContactName: string | null;
  interview1Slots: Slot[] | null;
  interview1ConfirmedAt: string | null;
  interview1DoneAt: string | null;
  interview1Notes: string | null;
  interview2Slots: Slot[] | null;
  interview2ConfirmedAt: string | null;
  interview2DoneAt: string | null;
  interview2Notes: string | null;
  shortlistedAt: string | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    yearsExperience: number | null;
    seniority: string | null;
    photoUrl: string | null;
    city: string | null;
    skills: string[];
    experiences: {
      id: string; companyName: string | null; jobTitle: string | null;
      startDate: string | null; endDate: string | null; description: string | null;
    }[];
  };
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior", MEDIOR: "Medior", CONFIRMED: "Confirmé",
  SENIOR: "Senior", EXPERT: "Expert"
};

const STEPS = [
  { key: "PROPOSED",              label: "Proposé" },
  { key: "INTERVIEW_1_REQUESTED", label: "Entretien 1", alt: ["INTERVIEW_1_DONE"] },
  { key: "INTERVIEW_2_REQUESTED", label: "Entretien 2", alt: ["INTERVIEW_2_DONE"] },
  { key: "SHORTLISTED",           label: "Shortlisté" },
  { key: "ACCEPTED",              label: "Accepté" }
];

function stepIndex(status: string) {
  if (status === "REJECTED") return -1;
  const idx = STEPS.findIndex((s) =>
    s.key === status || (s.alt && s.alt.includes(status))
  );
  return idx === -1 ? 0 : idx;
}

export function PortalClientViewV2({ token, data }: {
  token: string;
  data: { name: string; logoUrl: string | null; greetingName: string | null; proposals: Proposal[] };
}) {
  const firstName = data.greetingName?.split(/\s+/)[0];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-200">
        {data.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={data.logoUrl} alt="" className="h-14 object-contain" />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-slate-200 grid place-items-center text-slate-500 font-semibold">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-midnight-900">{data.name}</h1>
          <p className="text-sm text-midnight-500">
            {firstName ? `Bonjour ${firstName}, voici les profils proposés pour votre équipe.` : "Profils proposés pour votre équipe"}
          </p>
        </div>
      </header>

      {data.proposals.length === 0 ? (
        <div className="text-center py-16 text-midnight-500">
          <p>Aucun profil proposé pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.proposals.map((p) => (
            <ProposalCardV2 key={p.id} token={token} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCardV2({ token, proposal }: { token: string; proposal: Proposal }) {
  const c = proposal.candidate;
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(proposal.status);
  const isRejected = status === "REJECTED";

  return (
    <article className="bg-white border border-border rounded-xl p-5 shadow-sm">
      <StepTimeline status={status} />

      <div className="flex gap-4 mt-4">
        {c.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={c.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-midnight-100 grid place-items-center text-midnight-500">
            <User className="w-8 h-8" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-midnight-900">
              {c.firstName} {c.lastName.slice(0, 1)}.
            </h2>
            {c.seniority && (
              <span className="text-[11px] bg-indigoaccent/10 text-indigoaccent px-2 py-0.5 rounded-full font-medium">
                {SENIORITY_LABEL[c.seniority] ?? c.seniority}
              </span>
            )}
            {c.yearsExperience != null && (
              <span className="text-xs text-midnight-500">{c.yearsExperience} ans</span>
            )}
            {c.city && (
              <span className="text-xs text-midnight-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{c.city}
              </span>
            )}
          </div>
          {c.experiences?.[0]?.jobTitle && (
            <p className="text-sm text-midnight-600 mt-1">{c.experiences[0].jobTitle}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {c.skills.slice(0, 10).map((s) => (
              <span key={s} className="text-[11px] bg-midnight-100 text-midnight-700 px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>
          {c.experiences.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-indigoaccent hover:underline mt-3">
              {expanded ? "Masquer" : "Voir"} l'expérience détaillée
            </button>
          )}
          {expanded && (
            <div className="mt-3 space-y-2 pl-3 border-l-2 border-midnight-100">
              {c.experiences.map((x) => (
                <div key={x.id}>
                  <div className="font-medium text-sm">
                    {x.jobTitle || "—"}{x.companyName ? ` · ${x.companyName}` : ""}
                  </div>
                  <div className="text-[11px] text-midnight-500">{fmtDate(x.startDate)} → {x.endDate ? fmtDate(x.endDate) : "actuel"}</div>
                  {x.description && <p className="text-xs text-midnight-600 mt-1 whitespace-pre-line">{x.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <div>
            <div className="text-xs text-midnight-500">TJM proposé</div>
            <div className="text-2xl font-bold text-midnight-900">{proposal.proposedDailyRate} €</div>
            <div className="text-xs text-midnight-500">par jour HT</div>
          </div>
          <div className="flex gap-1.5">
            <a href={`/api/portal/${token}/cv/${proposal.id}?inline=1`} target="_blank" rel="noreferrer"
              className="btn-ghost text-xs flex items-center gap-1">
              <Eye className="w-3 h-3" /> Aperçu
            </a>
            <a href={`/api/portal/${token}/cv/${proposal.id}`}
              className="btn-primary text-xs flex items-center gap-1">
              <FileDown className="w-3 h-3" /> CV
            </a>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        {isRejected ? (
          <RejectedPanel proposal={proposal} />
        ) : (
          <ActionZone
            token={token}
            proposal={proposal}
            status={status}
            onStatus={setStatus}
          />
        )}
      </div>
    </article>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────

function StepTimeline({ status }: { status: string }) {
  if (status === "REJECTED") {
    return (
      <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-3 py-1 w-fit">
        <X className="w-3 h-3" /> Proposition refusée
      </div>
    );
  }
  const current = stepIndex(status);
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
      {STEPS.map((s, i) => {
        const past = i < current;
        const now  = i === current;
        const cls =
          past ? "bg-emerald-600 text-white" :
          now  ? "bg-indigoaccent text-white" :
                 "bg-midnight-200 text-midnight-500";
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span className={`${cls} w-6 h-6 rounded-full grid place-items-center font-bold`}>{i + 1}</span>
            <span className={now ? "text-midnight-900 font-semibold" : past ? "text-midnight-700" : "text-midnight-400"}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`w-6 h-px ${past ? "bg-emerald-600" : "bg-midnight-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Action zone (change selon le status) ──────────────────────────

function ActionZone({ token, proposal, status, onStatus }: {
  token: string; proposal: Proposal; status: string;
  onStatus: (s: string) => void;
}) {
  // Terminaux : pas d'actions possibles
  if (status === "ACCEPTED") return <AcceptedPanel />;

  // État initial
  if (status === "PROPOSED") {
    return <ActionsPanel
      token={token} proposal={proposal} onStatus={onStatus}
      stage="initial"
    />;
  }

  // Après avoir demandé l'entretien 1 (créneaux envoyés)
  if (status === "INTERVIEW_1_REQUESTED") {
    return <>
      <InterviewRequestedPanel which={1} proposal={proposal} />
      <div className="mt-4" />
      <ActionsPanel
        token={token} proposal={proposal} onStatus={onStatus}
        stage="after-interview-1"
      />
    </>;
  }

  // Entretien 1 marqué effectué par Dasolabs
  if (status === "INTERVIEW_1_DONE") {
    return <ActionsPanel
      token={token} proposal={proposal} onStatus={onStatus}
      stage="after-interview-1"
      showDoneBlock={1}
    />;
  }

  // Après avoir demandé l'entretien 2
  if (status === "INTERVIEW_2_REQUESTED") {
    return <>
      <InterviewRequestedPanel which={2} proposal={proposal} />
      <div className="mt-4" />
      <ActionsPanel
        token={token} proposal={proposal} onStatus={onStatus}
        stage="after-interview-2"
      />
    </>;
  }

  if (status === "INTERVIEW_2_DONE") {
    return <ActionsPanel
      token={token} proposal={proposal} onStatus={onStatus}
      stage="after-interview-2"
      showDoneBlock={2}
    />;
  }

  if (status === "SHORTLISTED") {
    return <ActionsPanel
      token={token} proposal={proposal} onStatus={onStatus}
      stage="shortlisted"
    />;
  }

  return <ActionsPanel
    token={token} proposal={proposal} onStatus={onStatus}
    stage="initial"
  />;
}

// ─── Panels d'actions ──────────────────────────────────────────────

/**
 * Panel d'actions unifié — s'adapte au stade du candidat.
 * Toujours visible : textarea commentaire + boutons. Pas d'attente du
 * marquage admin : le client peut toujours progresser.
 */
function ActionsPanel({ token, proposal, onStatus, stage, showDoneBlock }: {
  token: string;
  proposal: Proposal;
  onStatus: (s: string) => void;
  stage: "initial" | "after-interview-1" | "after-interview-2" | "shortlisted";
  showDoneBlock?: 1 | 2;
}) {
  const [picker, setPicker] = useState<null | "REQUEST_INTERVIEW_1" | "REQUEST_INTERVIEW_2" | "REQUEST_ADDITIONAL_INTERVIEW">(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  function act(kind: "ACCEPT" | "REJECT" | "SHORTLIST") {
    start(async () => {
      try {
        const r = await respondToProposalV2({
          token, proposalId: proposal.id,
          action: { kind },
          clientMessage: message || undefined
        });
        onStatus(r.status);
      } catch (e: any) { alert(e.message); }
    });
  }

  if (picker) {
    const title =
      picker === "REQUEST_INTERVIEW_1"          ? "Planifier l'entretien 1" :
      picker === "REQUEST_INTERVIEW_2"          ? "Planifier l'entretien 2" :
                                                  "Entretien complémentaire";
    return (
      <SlotPicker
        token={token} proposal={proposal}
        actionKind={picker}
        title={title}
        initialMessage={message}
        onCancel={() => setPicker(null)}
        onDone={(s) => { setPicker(null); onStatus(s); }}
      />
    );
  }

  // Bloc notes Dasolabs (entretien effectué) — s'affiche en haut
  const doneNotes =
    showDoneBlock === 1 ? proposal.interview1Notes :
    showDoneBlock === 2 ? proposal.interview2Notes : null;
  const doneAt =
    showDoneBlock === 1 ? proposal.interview1DoneAt :
    showDoneBlock === 2 ? proposal.interview2DoneAt : null;

  // Bloc shortlist
  const shortlistBlock = stage === "shortlisted";

  // Prompt contextuel
  const prompt =
    stage === "initial"             ? "Choisissez une action :" :
    stage === "after-interview-1"   ? "Comment voulez-vous poursuivre ?" :
    stage === "after-interview-2"   ? "Comment voulez-vous poursuivre ?" :
                                       "Votre décision finale :";

  // Quels boutons afficher ?
  const showPlanInterview1    = stage === "initial";
  const showPlanInterview2    = stage === "after-interview-1";
  const showShortlist         = stage === "after-interview-1" || stage === "after-interview-2";
  const showAdditionalInt     = stage === "shortlisted";

  return (
    <div>
      {showDoneBlock && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <Check className="w-4 h-4" /> Entretien {showDoneBlock} effectué
            {doneAt && <span className="text-[11px] font-normal text-emerald-700">· {fmtDate(doneAt)}</span>}
          </div>
          {doneNotes && (
            <p className="text-sm text-emerald-900 mt-2 whitespace-pre-line">
              <strong>Retour Dasolabs :</strong> {doneNotes}
            </p>
          )}
        </div>
      )}

      {shortlistBlock && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 text-sm">
          <strong>Profil shortlisté</strong> depuis le {fmtDate(proposal.shortlistedAt)}.
        </div>
      )}

      {/* Commentaire optionnel — toujours visible */}
      <div className="mb-3">
        <label className="text-xs text-midnight-500 block mb-1">Commentaire (optionnel) — sera envoyé à Dasolabs</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Vos impressions, remarques, contraintes…"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <p className="text-sm text-midnight-500 mb-2">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        <GreenAcceptButton onClick={() => act("ACCEPT")} disabled={pending}
          label={stage === "shortlisted" ? "Accepter ce profil" : "Accepter"} />
        {showShortlist && (
          <button onClick={() => act("SHORTLIST")} disabled={pending}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
            <UsersIcon className="w-4 h-4" /> Shortlister
          </button>
        )}
        {showPlanInterview1 && (
          <button onClick={() => setPicker("REQUEST_INTERVIEW_1")} disabled={pending}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
            <CalendarCheck className="w-4 h-4" /> Planifier un entretien
          </button>
        )}
        {showPlanInterview2 && (
          <button onClick={() => setPicker("REQUEST_INTERVIEW_2")} disabled={pending}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
            <CalendarCheck className="w-4 h-4" /> Planifier entretien 2
          </button>
        )}
        {showAdditionalInt && (
          <button onClick={() => setPicker("REQUEST_ADDITIONAL_INTERVIEW")} disabled={pending}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
            <CalendarCheck className="w-4 h-4" /> Entretien complémentaire
          </button>
        )}
        <button onClick={() => act("REJECT")} disabled={pending}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
          <X className="w-4 h-4" /> {stage === "shortlisted" ? "Finalement non" : "Refuser"}
        </button>
      </div>
    </div>
  );
}

function GreenAcceptButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg shadow-sm">
      <Check className="w-4 h-4" /> {label}
    </button>
  );
}

function AcceptedPanel() {
  return (
    <div className="rounded-lg bg-emerald-50 border-2 border-emerald-300 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center text-xl font-bold">✓</div>
        <div>
          <div className="text-lg font-bold text-emerald-900">Profil accepté</div>
          <div className="text-sm text-emerald-800">Dasolabs revient vers vous sous 24h avec le contrat.</div>
        </div>
      </div>
    </div>
  );
}

function RejectedPanel({ proposal }: { proposal: Proposal }) {
  return (
    <div className="text-sm text-midnight-500">
      Cette proposition a été refusée{proposal.actedByContactName ? ` par ${proposal.actedByContactName}` : ""}.
      {proposal.clientMessage && (<div className="text-xs mt-1 italic">« {proposal.clientMessage} »</div>)}
    </div>
  );
}

function InterviewRequestedPanel({ which, proposal }: { which: 1 | 2; proposal: Proposal }) {
  const slots = (which === 1 ? proposal.interview1Slots : proposal.interview2Slots) ?? [];
  const confirmedAt = which === 1 ? proposal.interview1ConfirmedAt : proposal.interview2ConfirmedAt;
  return (
    <div className="rounded-lg bg-indigoaccent/5 border border-indigoaccent/30 p-4">
      <div className="flex items-center gap-2 text-indigoaccent font-semibold text-sm">
        <CalendarCheck className="w-4 h-4" />
        Entretien {which} — {confirmedAt ? "confirmé" : "en attente de confirmation Dasolabs"}
      </div>
      {confirmedAt && (
        <p className="text-sm text-midnight-700 mt-2">
          Créneau retenu : <strong>{new Date(confirmedAt).toLocaleString("fr-BE")}</strong>
        </p>
      )}
      {!confirmedAt && slots.length > 0 && (
        <ul className="text-sm text-midnight-700 mt-2 space-y-1">
          {slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-midnight-400" />
              {fmtDate(s.date)} · {s.startTime}–{s.endTime} ·
              {s.mode === "VISIO" ? <><Video className="w-3 h-3 inline" /> Visio</> : <><Building2 className="w-3 h-3 inline" /> Sur site</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Slot picker (3 créneaux) ──────────────────────────────────────

function SlotPicker({ token, proposal, actionKind, title, initialMessage, onCancel, onDone }: {
  token: string;
  proposal: Proposal;
  actionKind: "REQUEST_INTERVIEW_1" | "REQUEST_INTERVIEW_2" | "REQUEST_ADDITIONAL_INTERVIEW";
  title: string;
  initialMessage?: string;
  onCancel: () => void;
  onDone: (nextStatus: string) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [slots, setSlots] = useState<Slot[]>([
    { date: todayIso, startTime: "10:00", endTime: "11:30", mode: "VISIO" }
  ]);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState(initialMessage || "");

  function update(i: number, patch: Partial<Slot>) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function remove(i: number) {
    setSlots(slots.filter((_, idx) => idx !== i));
  }
  function add() {
    if (slots.length >= 3) return;
    setSlots([...slots, { date: todayIso, startTime: "10:00", endTime: "11:30", mode: "VISIO" }]);
  }

  function submit() {
    if (slots.length < 1) { alert("Proposez au moins un créneau."); return; }
    start(async () => {
      try {
        const r = await respondToProposalV2({
          token, proposalId: proposal.id,
          action: { kind: actionKind, slots },
          clientMessage: message || undefined
        });
        onDone(r.status);
      } catch (e: any) { alert(e.message); }
    });
  }

  return (
    <div>
      <h3 className="font-semibold text-midnight-900 mb-1">{title}</h3>
      <p className="text-xs text-midnight-500 mb-4">Proposez jusqu'à 3 créneaux. Dasolabs cale avec le candidat et confirme.</p>

      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end bg-midnight-50 border border-border rounded-lg p-2">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-wider text-midnight-500">Date</label>
              <input type="date" value={s.date} min={todayIso}
                onChange={(e) => update(i, { date: e.target.value })}
                className="input input-sm w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-midnight-500">Début</label>
              <input type="time" value={s.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
                className="input input-sm w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-midnight-500">Fin</label>
              <input type="time" value={s.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
                className="input input-sm w-full" />
            </div>
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-wider text-midnight-500">Mode</label>
              <select value={s.mode} onChange={(e) => update(i, { mode: e.target.value as any })}
                className="input input-sm w-full">
                <option value="VISIO">Visio</option>
                <option value="ONSITE">Sur site</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end">
              {slots.length > 1 && (
                <button onClick={() => remove(i)} className="btn-ghost text-rose-600 btn-sm">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
        {slots.length < 3 && (
          <button onClick={add} className="btn-ghost text-indigoaccent text-sm">
            <Plus className="w-3 h-3" /> Ajouter un créneau ({slots.length}/3)
          </button>
        )}
      </div>

      <div className="mt-3">
        <label className="text-xs text-midnight-500">Message pour Dasolabs (optionnel)</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
          placeholder="Contraintes, préférences…"
          className="input w-full text-sm" />
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="btn-ghost">Annuler</button>
        <button onClick={submit} disabled={pending} className="btn-primary">
          {pending ? "..." : "Envoyer les créneaux"}
        </button>
      </div>
    </div>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
