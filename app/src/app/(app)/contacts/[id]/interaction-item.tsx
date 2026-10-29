"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { updateInteraction, deleteInteraction } from "@/server/actions/contacts";
import { formatDate } from "@/lib/utils";

type Interaction = {
  id: string;
  kind: string;
  subject: string;
  body: string | null;
  occurredAt: Date | string;
  user: { firstName: string; lastName: string } | null;
};

export function InteractionItem({ interaction }: { interaction: Interaction }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(interaction.kind);
  const [subject, setSubject] = useState(interaction.subject);
  const [body, setBody] = useState(interaction.body ?? "");

  function save() {
    if (!subject.trim()) { toast.error("Le sujet est obligatoire"); return; }
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("subject", subject);
    fd.set("body", body);
    start(async () => {
      try { await updateInteraction(interaction.id, fd); toast.success("Interaction mise à jour"); setEditing(false); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  function remove() {
    if (!window.confirm(`Supprimer l'interaction « ${interaction.subject} » ?`)) return;
    start(async () => {
      try { await deleteInteraction(interaction.id); toast.success("Interaction supprimée"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  if (editing) {
    return (
      <li className="flex gap-3 border-l-2 border-indigoaccent pl-3 bg-indigoaccent/5 p-2 rounded-r">
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input col-span-3 text-sm h-8">
              <option value="note">Note</option>
              <option value="call">Appel</option>
              <option value="email">Email</option>
              <option value="meeting">Réunion</option>
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input col-span-9 text-sm h-8" placeholder="Sujet" />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input text-sm min-h-[60px] py-1" placeholder="Détail (optionnel)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost btn-sm" disabled={pending}>
              <X className="w-3 h-3" /> Annuler
            </button>
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
      <div className="flex-1">
        <div className="text-xs text-midnight-500">
          {formatDate(interaction.occurredAt as any, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } as any)}
          {" · "}<span className="badge-info">{interaction.kind}</span>
          {" · "}{interaction.user ? `${interaction.user.firstName} ${interaction.user.lastName}` : "—"}
        </div>
        <div className="font-medium text-midnight-900 text-sm">{interaction.subject}</div>
        {interaction.body && <div className="text-sm text-midnight-700 mt-0.5">{interaction.body}</div>}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
        <button onClick={() => setEditing(true)} className="text-midnight-400 hover:text-indigoaccent p-1" title="Modifier" disabled={pending}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={remove} className="text-midnight-400 hover:text-red-600 p-1" title="Supprimer" disabled={pending}>
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </li>
  );
}
