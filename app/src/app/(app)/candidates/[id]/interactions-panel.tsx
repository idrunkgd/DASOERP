"use client";
/**
 * Timeline d'interactions candidat : appels, mails, meetings, notes.
 * Même ergonomie que la timeline du contact (edit inline au survol, suppression).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Loader2, Phone, Mail, Users, MessageSquare, Plus } from "lucide-react";
import {
  addCandidateInteraction, updateCandidateInteraction, deleteCandidateInteraction
} from "@/server/actions/candidate-interactions";

type Interaction = {
  id: string;
  kind: string;
  subject: string;
  body: string | null;
  occurredAt: string;
  user: { firstName: string; lastName: string } | null;
};

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  note:    { label: "Note",    icon: MessageSquare, color: "text-midnight-500" },
  call:    { label: "Appel",   icon: Phone,         color: "text-emerald-600" },
  email:   { label: "Email",   icon: Mail,          color: "text-indigoaccent" },
  meeting: { label: "Réunion", icon: Users,         color: "text-amber-600" }
};

export function CandidateInteractionsPanel({
  candidateId, interactions, canManage
}: {
  candidateId: string;
  interactions: Interaction[];
  canManage: boolean;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3 flex items-center gap-2">Timeline d'interactions ({interactions.length})</h2>
      {canManage && <AddForm candidateId={candidateId} />}
      {interactions.length === 0 ? (
        <p className="text-sm text-midnight-500 italic">Aucune interaction enregistrée. Ajoute un appel, un mail ou une note ci-dessus.</p>
      ) : (
        <ul className="space-y-3 mt-4">
          {interactions.map((i) => <Item key={i.id} interaction={i} canManage={canManage} />)}
        </ul>
      )}
    </section>
  );
}

function AddForm({ candidateId }: { candidateId: string }) {
  const [kind, setKind] = useState("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) { toast.error("Sujet obligatoire"); return; }
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("subject", subject);
    fd.set("body", body);
    start(async () => {
      try { await addCandidateInteraction(candidateId, fd); setSubject(""); setBody(""); toast.success("Ajouté"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2 mb-3">
      <div className="grid grid-cols-12 gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input col-span-2 text-sm">
          <option value="call">Appel</option>
          <option value="email">Email</option>
          <option value="meeting">Réunion</option>
          <option value="note">Note</option>
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet (ex: Point RH, retour entretien...)" className="input col-span-9 text-sm" />
        <button type="submit" disabled={pending || !subject.trim()} className="btn-primary col-span-1 flex items-center justify-center">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Détail (optionnel)" className="input text-sm min-h-[50px] py-1 w-full" />
    </form>
  );
}

function Item({ interaction, canManage }: { interaction: Interaction; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState(interaction.kind);
  const [subject, setSubject] = useState(interaction.subject);
  const [body, setBody] = useState(interaction.body ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    if (!subject.trim()) { toast.error("Sujet obligatoire"); return; }
    const fd = new FormData();
    fd.set("kind", kind); fd.set("subject", subject); fd.set("body", body);
    start(async () => {
      try { await updateCandidateInteraction(interaction.id, fd); setEditing(false); toast.success("Mis à jour"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove() {
    if (!window.confirm(`Supprimer « ${interaction.subject} » ?`)) return;
    start(async () => {
      try { await deleteCandidateInteraction(interaction.id); toast.success("Supprimé"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  const meta = KIND_META[interaction.kind] ?? KIND_META.note;
  const Icon = meta.icon;

  if (editing) {
    return (
      <li className="flex gap-3 border-l-2 border-indigoaccent pl-3 bg-indigoaccent/5 p-2 rounded-r">
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input col-span-3 text-sm h-8">
              <option value="call">Appel</option>
              <option value="email">Email</option>
              <option value="meeting">Réunion</option>
              <option value="note">Note</option>
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input col-span-9 text-sm h-8" placeholder="Sujet" />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input text-sm min-h-[60px] py-1" placeholder="Détail (optionnel)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost btn-sm" disabled={pending}><X className="w-3 h-3" /> Annuler</button>
            <button onClick={save} className="btn-primary btn-sm" disabled={pending}>
              {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Enregistrer
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-3 border-l-2 border-indigoaccent/40 pl-3 group">
      <div className={"shrink-0 mt-1 " + meta.color}><Icon className="w-4 h-4" /></div>
      <div className="flex-1">
        <div className="text-xs text-midnight-500">
          {new Date(interaction.occurredAt).toLocaleString("fr-BE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}<span className="badge-info">{meta.label}</span>
          {" · "}{interaction.user ? `${interaction.user.firstName} ${interaction.user.lastName}` : "—"}
        </div>
        <div className="font-medium text-midnight-900 text-sm">{interaction.subject}</div>
        {interaction.body && <div className="text-sm text-midnight-700 mt-0.5 whitespace-pre-wrap">{interaction.body}</div>}
      </div>
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
          <button onClick={() => setEditing(true)} className="text-midnight-400 hover:text-indigoaccent p-1" title="Modifier" disabled={pending}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={remove} className="text-midnight-400 hover:text-red-600 p-1" title="Supprimer" disabled={pending}>
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </li>
  );
}
