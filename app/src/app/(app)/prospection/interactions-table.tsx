"use client";
/**
 * Timeline des interactions — table simple avec actions rapides sur chaque
 * ligne (changer de statut, marquer relance faite, supprimer).
 */
import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  setOutreachStatus, markNextActionDone, deleteOutreach
} from "@/server/actions/outreach";
import { Loader2, Check, X, Trash2, ExternalLink } from "lucide-react";

type Interaction = {
  id: string;
  direction: string;
  channel: string;
  purpose: string;
  status: string;
  sentAt: string;
  respondedAt: string | null;
  candidate: { id: string; firstName: string; lastName: string } | null;
  contact: { id: string; firstName: string; lastName: string; company: { name: string } | null } | null;
  freeformName: string | null;
  freeformCompany: string | null;
  freeformLinkedinUrl: string | null;
  subject: string | null;
  body: string | null;
  template: { name: string } | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  nextActionDone: boolean;
  owner: { firstName: string; lastName: string } | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  SENT:             { label: "Envoyé",       cls: "bg-slate-100 text-slate-700" },
  READ:             { label: "Lu",           cls: "bg-blue-100 text-blue-800" },
  REPLIED_POSITIVE: { label: "Réponse +",    cls: "bg-emerald-100 text-emerald-800" },
  REPLIED_NEGATIVE: { label: "Réponse −",    cls: "bg-red-100 text-red-800" },
  NO_RESPONSE:      { label: "Sans réponse", cls: "bg-amber-100 text-amber-800" },
  BOUNCED:          { label: "Rejeté",       cls: "bg-red-100 text-red-800" }
};

const CHANNEL_META: Record<string, { label: string }> = {
  LINKEDIN: { label: "LinkedIn" }, EMAIL: { label: "Email" },
  PHONE: { label: "Tél" }, MEETING: { label: "RDV" }, OTHER: { label: "Autre" }
};

export function InteractionsTable({ interactions }: { interactions: Interaction[] }) {
  if (interactions.length === 0) {
    return (
      <div className="card p-8 text-center text-midnight-500">
        Aucune interaction à afficher. Utilise « Nouvelle interaction » ci-dessus pour démarrer.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="table-base">
        <thead>
          <tr>
            <th>Contact</th><th>Canal</th><th>Objectif</th><th>Envoyé</th>
            <th>Statut</th><th>Relance</th><th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {interactions.map((i) => <Row key={i.id} i={i} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ i }: { i: Interaction }) {
  const [pending, start] = useTransition();
  const targetName = i.candidate
    ? { name: `${i.candidate.firstName} ${i.candidate.lastName}`, href: `/candidates/${i.candidate.id}`, sub: null }
    : i.contact
      ? { name: `${i.contact.firstName} ${i.contact.lastName}`, href: `/contacts/${i.contact.id}`, sub: i.contact.company?.name ?? null }
      : { name: i.freeformName ?? "?", href: null, sub: i.freeformCompany };

  function status(next: string) {
    start(async () => {
      try { await setOutreachStatus(i.id, next as any); toast.success("Mis à jour"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function relanceDone() {
    start(async () => {
      try { await markNextActionDone(i.id); toast.success("Relance faite"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove() {
    if (!confirm("Supprimer cette interaction ?")) return;
    start(async () => {
      try { await deleteOutreach(i.id); toast.success("Supprimée"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  const st = STATUS_META[i.status] ?? { label: i.status, cls: "" };

  return (
    <tr>
      <td>
        <div className="flex items-center gap-1">
          {targetName.href ? (
            <Link href={targetName.href} className="hover:underline font-medium">{targetName.name}</Link>
          ) : (
            <span className="font-medium">{targetName.name}</span>
          )}
          {i.freeformLinkedinUrl && (
            <a href={i.freeformLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigoaccent">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {targetName.sub && <div className="text-xs text-midnight-500">{targetName.sub}</div>}
      </td>
      <td className="text-sm">{CHANNEL_META[i.channel]?.label ?? i.channel}</td>
      <td className="text-xs text-midnight-500">
        {i.purpose === "SOURCE_CANDIDATE" ? "Sourcing" : i.purpose === "SELL_TO_CLIENT" ? "Client" : "—"}
      </td>
      <td className="text-xs">{formatDate(i.sentAt)}</td>
      <td>
        <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded " + st.cls}>{st.label}</span>
      </td>
      <td className="text-xs">
        {i.nextActionAt && !i.nextActionDone && (
          <div>
            <div>{formatDate(i.nextActionAt)}</div>
            {i.nextActionNote && <div className="text-midnight-500 truncate max-w-[200px]">{i.nextActionNote}</div>}
          </div>
        )}
        {i.nextActionDone && <span className="text-emerald-700">✓ faite</span>}
      </td>
      <td className="text-right">
        <div className="flex gap-1 justify-end">
          {i.status === "SENT" && (
            <>
              <button title="Réponse positive" disabled={pending} onClick={() => status("REPLIED_POSITIVE")} className="text-emerald-700 hover:text-emerald-900">
                <Check className="w-4 h-4" />
              </button>
              <button title="Réponse négative" disabled={pending} onClick={() => status("REPLIED_NEGATIVE")} className="text-red-600 hover:text-red-800">
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {i.nextActionAt && !i.nextActionDone && (
            <button title="Marquer relance faite" disabled={pending} onClick={relanceDone} className="text-indigoaccent">
              <Check className="w-4 h-4" />
            </button>
          )}
          <button title="Supprimer" disabled={pending} onClick={remove} className="text-midnight-400 hover:text-red-600">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
