"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Phone, X } from "lucide-react";
import { createContactTodo } from "@/server/actions/contacts";

/**
 * Petit bouton téléphone rond en tête de ligne contact.
 * Clic → popover assignation (user + échéance + note optionnelle).
 * Crée une ContactInteraction kind="todo" qui apparaît dans /commercial.
 */
export function PhoneTodoButton({
  contactId,
  contactLabel,
  users,
  defaultAssigneeId
}: {
  contactId: string;
  contactLabel: string;
  users: Array<{ id: string; firstName: string; lastName: string }>;
  defaultAssigneeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    const t = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  function submit(fd: FormData) {
    start(async () => {
      try {
        await createContactTodo(contactId, fd);
        toast.success(`Tâche « rappeler ${contactLabel} » créée`);
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Échéance par défaut = demain à 10h.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultDue = tomorrow.toISOString().slice(0, 16);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border bg-white hover:border-indigoaccent hover:bg-indigoaccent hover:text-white text-midnight-500 transition-colors"
        title={`Créer une tâche de rappel pour ${contactLabel}`}
        aria-label="Créer une tâche de rappel"
      >
        <Phone className="w-3.5 h-3.5" />
      </button>
      {open && (
        <form
          action={submit}
          className="absolute z-30 left-0 top-9 w-80 bg-white border border-border rounded-lg shadow-lg p-3 space-y-2 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="font-medium text-indigoaccent flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Rappeler {contactLabel}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-midnight-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className="label">Assigné à</label>
            <select name="assigneeId" defaultValue={defaultAssigneeId} className="input text-xs">
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Échéance</label>
            <input
              name="dueAt"
              type="datetime-local"
              defaultValue={defaultDue}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="label">Note (optionnel)</label>
            <textarea
              name="body"
              rows={2}
              className="input text-xs"
              placeholder="Sujet du rappel, contexte…"
            />
          </div>
          <input type="hidden" name="subject" value="À rappeler" />
          <div className="flex justify-end pt-1">
            <button disabled={pending} className="btn-primary btn-sm text-xs">
              {pending ? "…" : "Créer la tâche"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
