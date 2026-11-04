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
import { respondToProposalV2, addClientComment } from "@/server/actions/client-portal-public";
import {
  User, MapPin, Check, X, CalendarCheck, Users as UsersIcon,
  Clock, Video, Building2, Plus, Trash2, FileDown, Eye,
  MessageSquare, Send, AlertTriangle
} from "lucide-react";

type Slot = { date: string; startTime: string; endTime: string; mode: "VISIO" | "ONSITE" };

type Comment = {
  id: string;
  authorKind: "CLIENT" | "DASOLABS";
  authorName: string;
  content: string;
  createdAt: string;
};

type Proposal = {
  id: string;
  status: string;
  proposedDailyRate: number;
  clientMessage: string | null;
  actedByContactName: string | null;
  comments: Comment[];
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
  data: {
    name: string; logoUrl: string | null;
    greetingName: string | null;
    isDasolabsPreview?: boolean;
    proposals: Proposal[];
  };
}) {
  const firstName = data.greetingName?.split(/\s+/)[0];
  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {data.isDasolabsPreview && (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Vue interne Dasolabs — prévisualisation</div>
            <div className="text-xs text-amber-800">
              Ce lien est votre lien général. Ne l'envoyez PAS au client — créez un lien personnel nominatif dans l'admin et partagez celui-ci.
            </div>
          </div>
        </div>
      )}
      <header className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-200">
        {data.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={data.logoUrl} alt="" className="h-10 sm:h-14 object-contain shrink-0" />
        ) : (
          <div className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 rounded-lg bg-slate-200 grid place-items-center text-slate-500 font-semibold text-sm">
            {data.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-midnight-900 truncate">{data.name}</h1>
          <p className="text-xs sm:text-sm text-midnight-500">
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
    <article className="bg-white border border-border rounded-xl p-4 sm:p-5 shadow-sm">
      <StepTimeline status={status} />

      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        {/* Photo */}
        <div className="flex items-center gap-4 sm:block">
          {c.photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={c.photoUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-midnight-100 grid place-items-center text-midnight-500 shrink-0">
              <User className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
          )}
          {/* TJM visible à droite de la photo sur mobile */}
          <div className="sm:hidden flex-1 text-right">
            <div className="text-[10px] text-midnight-500 uppercase tracking-wider">TJM proposé</div>
            <div className="text-xl font-bold text-midnight-900">{proposal.proposedDailyRate} €<span className="text-xs font-normal text-midnight-500">/j HT</span></div>
          </div>
        </div>

        {/* Infos candidat */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h2 className="text-base sm:text-lg font-semibold text-midnight-900">
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
          {/* Boutons CV accessibles en bas des infos sur mobile */}
          <div className="flex gap-2 mt-4 sm:hidden">
            <a href={`/api/portal/${token}/cv/${proposal.id}?inline=1`} target="_blank" rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-md">
              <Eye className="w-3 h-3" /> Aperçu
            </a>
            <a href={`/api/portal/${token}/cv/${proposal.id}`}
              className="flex-1 inline-flex items-center justify-center gap-1 text-xs bg-indigo-600 text-white px-3 py-2 rounded-md">
              <FileDown className="w-3 h-3" /> Télécharger CV
            </a>
          </div>
        </div>

        {/* TJM + CV — visibles uniquement sur desktop */}
        <div className="hidden sm:flex text-right shrink-0 flex-col items-end gap-2">
          <div>
            <div className="text-xs text-midnight-500">TJM proposé</div>
            <div className="text-2xl font-bold text-midnight-900">{proposal.proposedDailyRate} €</div>
            <div className="text-xs text-midnight-500">par jour HT</div>
          </div>
          <div className="flex gap-1.5">
            <a href={`/api/portal/${token}/cv/${proposal.id}?inline=1`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md">
              <Eye className="w-3 h-3" /> Aperçu
            </a>
            <a href={`/api/portal/${token}/cv/${proposal.id}`}
              className="inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md">
              <FileDown className="w-3 h-3" /> CV
            </a>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-border space-y-4">
        <CommentsThread token={token} proposal={proposal} />
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

function CommentsThread({ token, proposal }: { token: string; proposal: Proposal }) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);

  function submit() {
    const content = draft.trim();
    if (!content) return;
    start(async () => {
      try {
        await addClientComment({ token, proposalId: proposal.id, content });
        setDraft(""); setShowForm(false);
      } catch (e: any) { alert(e.message); }
    });
  }

  if (!proposal.comments?.length && !showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
      >
        <MessageSquare className="w-3 h-3" /> Ajouter un commentaire
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-midnight-500 font-semibold flex items-center gap-1">
        <MessageSquare className="w-3 h-3" /> Discussion
      </div>
      {proposal.comments.map((c) => {
        const isDaso = c.authorKind === "DASOLABS";
        return (
          <div key={c.id} className={`flex ${isDaso ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              isDaso
                ? "bg-indigo-50 border border-indigo-200 text-indigo-900"
                : "bg-slate-100 border border-slate-200 text-slate-800"
            }`}>
              <div className={`text-[10px] font-semibold ${isDaso ? "text-indigo-700" : "text-slate-500"}`}>
                {isDaso ? "Dasolabs · " : ""}{c.authorName} · {new Date(c.createdAt).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="text-sm whitespace-pre-line mt-0.5">{c.content}</div>
            </div>
          </div>
        );
      })}

      {showForm ? (
        <div className="flex gap-2 items-end mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Écrire un commentaire…"
            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button onClick={submit} disabled={pending || !draft.trim()}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-3 py-2 rounded-md text-sm shrink-0">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-1"
        >
          <MessageSquare className="w-3 h-3" /> Répondre
        </button>
      )}
    </div>
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
  const currentStep = STEPS[current];
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
            <span className={`${cls} w-6 h-6 rounded-full grid place-items-center font-bold shrink-0`}>{i + 1}</span>
            {/* Labels visibles seulement sur sm et + */}
            <span className={`hidden sm:inline ${now ? "text-midnight-900 font-semibold" : past ? "text-midnight-700" : "text-midnight-400"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className={`w-3 sm:w-6 h-px ${past ? "bg-emerald-600" : "bg-midnight-200"}`} />
            )}
          </div>
        );
      })}
      {/* Sur mobile : le label de l'étape courante seul, centré en-dessous */}
      {currentStep && (
        <div className="sm:hidden basis-full text-center mt-1 font-semibold text-indigoaccent">
          Étape {current + 1} : {currentStep.label}
        </div>
      )}
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

  function act(kind: "ACCEPT" | "REJECT" | "SHORTLIST") {
    start(async () => {
      try {
        const r = await respondToProposalV2({
          token, proposalId: proposal.id,
          action: { kind }
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

      <p className="text-sm text-midnight-500 mb-2">{prompt}</p>
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
        <ActionBtn onClick={() => act("ACCEPT")} disabled={pending}
          icon={<Check className="w-4 h-4" />}
          label={stage === "shortlisted" ? "Accepter ce profil" : "Accepter"}
          className="bg-emerald-600 hover:bg-emerald-700 text-white" />
        {showShortlist && (
          <ActionBtn onClick={() => act("SHORTLIST")} disabled={pending}
            icon={<UsersIcon className="w-4 h-4" />}
            label="Shortlister"
            className="bg-amber-500 hover:bg-amber-600 text-white" />
        )}
        {showPlanInterview1 && (
          <ActionBtn onClick={() => setPicker("REQUEST_INTERVIEW_1")} disabled={pending}
            icon={<CalendarCheck className="w-4 h-4" />}
            label="Planifier un entretien"
            className="bg-indigo-600 hover:bg-indigo-700 text-white" />
        )}
        {showPlanInterview2 && (
          <ActionBtn onClick={() => setPicker("REQUEST_INTERVIEW_2")} disabled={pending}
            icon={<CalendarCheck className="w-4 h-4" />}
            label="Planifier entretien 2"
            className="bg-indigo-600 hover:bg-indigo-700 text-white" />
        )}
        {showAdditionalInt && (
          <ActionBtn onClick={() => setPicker("REQUEST_ADDITIONAL_INTERVIEW")} disabled={pending}
            icon={<CalendarCheck className="w-4 h-4" />}
            label="Entretien complémentaire"
            className="bg-indigo-600 hover:bg-indigo-700 text-white" />
        )}
        <ActionBtn onClick={() => act("REJECT")} disabled={pending}
          icon={<X className="w-4 h-4" />}
          label={stage === "shortlisted" ? "Finalement non" : "Refuser"}
          className="bg-slate-800 hover:bg-slate-900 text-white" />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, disabled, icon, label, className }: {
  onClick: () => void; disabled: boolean; icon: React.ReactNode;
  label: string; className: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 disabled:opacity-50 font-semibold px-4 py-2.5 rounded-lg shadow-sm ${className}`}>
      {icon} {label}
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

function SlotPicker({ token, proposal, actionKind, title, onCancel, onDone }: {
  token: string;
  proposal: Proposal;
  actionKind: "REQUEST_INTERVIEW_1" | "REQUEST_INTERVIEW_2" | "REQUEST_ADDITIONAL_INTERVIEW";
  title: string;
  onCancel: () => void;
  onDone: (nextStatus: string) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [slots, setSlots] = useState<Slot[]>([
    { date: todayIso, startTime: "10:00", endTime: "11:30", mode: "VISIO" }
  ]);
  const [pending, start] = useTransition();

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
          action: { kind: actionKind, slots }
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
          <div key={i} className="bg-midnight-50 border border-border rounded-lg p-3 relative">
            {/* Bouton supprimer en haut à droite */}
            {slots.length > 1 && (
              <button onClick={() => remove(i)}
                className="absolute top-2 right-2 text-rose-600 hover:bg-rose-50 rounded p-1"
                title="Supprimer ce créneau">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end pr-6 sm:pr-0">
              <div className="col-span-2 sm:col-span-4">
                <label className="text-[10px] uppercase tracking-wider text-midnight-500">Date</label>
                <input type="date" value={s.date} min={todayIso}
                  onChange={(e) => update(i, { date: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-midnight-500">Début</label>
                <input type="time" value={s.startTime}
                  onChange={(e) => update(i, { startTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-midnight-500">Fin</label>
                <input type="time" value={s.endTime}
                  onChange={(e) => update(i, { endTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="text-[10px] uppercase tracking-wider text-midnight-500">Mode</label>
                <select value={s.mode} onChange={(e) => update(i, { mode: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
                  <option value="VISIO">Visio</option>
                  <option value="ONSITE">Sur site</option>
                </select>
              </div>
            </div>
          </div>
        ))}
        {slots.length < 3 && (
          <button onClick={add} className="btn-ghost text-indigoaccent text-sm">
            <Plus className="w-3 h-3" /> Ajouter un créneau ({slots.length}/3)
          </button>
        )}
      </div>

      <p className="text-[11px] text-midnight-500 mt-3 italic">
        Pour toute précision (contraintes, préférences…), utilisez la discussion sous la carte.
      </p>

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
