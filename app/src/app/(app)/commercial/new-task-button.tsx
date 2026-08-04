"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { createStandaloneTask } from "@/server/actions/contacts";

/**
 * Bouton "+ Nouvelle tâche" pour la page Activité. Ouvre un mini-form
 * inline pour créer une ContactInteraction kind="todo" sans contactId
 * (tâche générique : commander cartes de visite, renouveler abonnement…).
 */
export function NewTaskButton({
  users,
  defaultAssigneeId
}: {
  users: Array<{ id: string; firstName: string; lastName: string }>;
  defaultAssigneeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      try {
        await createStandaloneTask(fd);
        toast.success("Tâche créée");
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Échéance par défaut = demain 10h.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const defaultDue = tomorrow.toISOString().slice(0, 16);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary btn-sm"
      >
        <Plus className="w-4 h-4" /> Nouvelle tâche
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="card p-4 mb-4 border-indigoaccent/30 bg-indigoaccent/5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-indigoaccent flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-midnight-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>
        <label className="label">Titre *</label>
        <input
          name="subject"
          required
          maxLength={200}
          placeholder='Ex : "Commander cartes de visite", "Renouveler licence Notion"'
          className="input text-sm"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Assigné à</label>
          <select name="assigneeId" defaultValue={defaultAssigneeId} className="input text-sm">
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Échéance</label>
          <input name="dueAt" type="datetime-local" defaultValue={defaultDue} className="input text-sm" />
        </div>
      </div>
      <div>
        <label className="label">Notes / détails</label>
        <textarea
          name="body"
          rows={2}
          className="input text-sm"
          placeholder="Contexte, liens, fournisseur…"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Annuler
        </button>
        <button disabled={pending} className="btn-primary btn-sm">
          {pending ? "Création…" : "Créer la tâche"}
        </button>
      </div>
    </form>
  );
}
