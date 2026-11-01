"use client";
import { useState, useTransition } from "react";
import { respondToProposalPublic } from "@/server/actions/client-portal-public";
import { Check, X, CalendarCheck, User, MapPin } from "lucide-react";

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  cvContactRole: string | null;
  yearsExperience: number | null;
  seniority: string | null;
  photoUrl: string | null;
  city: string | null;
  skills: string[];
  experiences: {
    id: string;
    companyName: string | null;
    jobTitle: string | null;
    startDate: string | null;
    endDate: string | null;
    description: string | null;
  }[];
};

type Proposal = {
  id: string;
  status: string;
  clientMessage: string | null;
  proposedDailyRate: number;
  candidate: Candidate;
};

const SENIORITY_LABEL: Record<string, string> = {
  JUNIOR: "Junior", CONFIRMED: "Confirmé",
  SENIOR: "Senior", EXPERT: "Expert", REFERENT: "Référent"
};

export function PortalClientView({ token, data }: { token: string; data: { name: string; logoUrl: string | null; proposals: Proposal[] } }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header client (SON logo, pas Dasolabs) */}
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
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-slate-500">Profils proposés pour votre équipe</p>
        </div>
      </header>

      {data.proposals.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p>Aucun profil proposé pour l'instant.</p>
          <p className="text-xs mt-2">Vous serez notifié lorsque de nouveaux profils seront ajoutés.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.proposals.map((p) => (
            <ProposalCard key={p.id} token={token} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ token, proposal }: { token: string; proposal: Proposal }) {
  const c = proposal.candidate;
  const [expanded, setExpanded] = useState(false);
  const [acted, setActed] = useState(proposal.status);
  const [showMessage, setShowMessage] = useState<null | "ACCEPT" | "REJECT" | "REQUEST_INTERVIEW">(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  async function act(action: "ACCEPT" | "REJECT" | "REQUEST_INTERVIEW") {
    start(async () => {
      try {
        const res = await respondToProposalPublic({ token, proposalId: proposal.id, action, clientMessage: message || undefined });
        setActed(res.status);
        setShowMessage(null);
        setMessage("");
      } catch (e: any) {
        alert(e.message);
      }
    });
  }

  const isPending = acted === "PROPOSED";

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex gap-4">
        {c.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={c.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-slate-100 grid place-items-center text-slate-500">
            <User className="w-8 h-8" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold">{c.firstName} {c.lastName.slice(0, 1)}.</h2>
            {c.seniority && (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                {SENIORITY_LABEL[c.seniority] || c.seniority}
              </span>
            )}
            {c.yearsExperience != null && (
              <span className="text-xs text-slate-500">{c.yearsExperience} ans d'expérience</span>
            )}
            {c.city && (
              <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>
            )}
          </div>
          {c.cvContactRole && <p className="text-sm text-slate-600 mt-1">{c.cvContactRole}</p>}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {c.skills.slice(0, 10).map((s) => (
              <span key={s} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{s}</span>
            ))}
          </div>
          {c.experiences.length > 0 && (
            <>
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-indigo-600 hover:underline mt-3">
                {expanded ? "Masquer" : "Voir"} l'expérience détaillée
              </button>
              {expanded && (
                <div className="mt-3 space-y-3 pl-3 border-l-2 border-slate-100">
                  {c.experiences.map((x) => (
                    <div key={x.id}>
                      <div className="font-medium text-sm">
                        {x.jobTitle || "—"}{x.companyName ? ` · ${x.companyName}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fmt(x.startDate)} → {x.endDate ? fmt(x.endDate) : "actuel"}
                      </div>
                      {x.description && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{x.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">TJM proposé</div>
          <div className="text-2xl font-bold text-slate-900">{proposal.proposedDailyRate} €<span className="text-sm text-slate-500">/j HT</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        {!isPending ? (
          <div className="text-sm">
            <StatusBadge status={acted} />
            {proposal.clientMessage && (
              <p className="text-xs text-slate-500 mt-2">Votre message : « {proposal.clientMessage} »</p>
            )}
          </div>
        ) : showMessage ? (
          <div className="space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder={showMessage === "REQUEST_INTERVIEW" ? "Précisez vos disponibilités..." : "Message optionnel"}
            />
            <div className="flex gap-2">
              <button onClick={() => act(showMessage)} disabled={pending} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50">
                Confirmer
              </button>
              <button onClick={() => { setShowMessage(null); setMessage(""); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowMessage("ACCEPT")} disabled={pending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              <Check className="w-4 h-4" /> Accepter
            </button>
            <button onClick={() => setShowMessage("REQUEST_INTERVIEW")} disabled={pending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" /> Demander un entretien
            </button>
            <button onClick={() => setShowMessage("REJECT")} disabled={pending}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
              <X className="w-4 h-4" /> Refuser
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACCEPTED") return <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs"><Check className="w-3 h-3" />Vous avez accepté ce profil</span>;
  if (status === "REJECTED") return <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-3 py-1 rounded-full text-xs"><X className="w-3 h-3" />Vous avez refusé ce profil</span>;
  if (status === "INTERVIEW_REQUESTED") return <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full text-xs"><CalendarCheck className="w-3 h-3" />Entretien demandé</span>;
  return null;
}

function fmt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}
