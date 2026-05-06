"use client";
import { useTransition } from "react";
import { createProjectAction, updateProjectAction } from "@/server/actions/projects";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = any;

function dateInput(d?: Date | string | null) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export function ProjectForm({
  initial, companies, users
}: { initial?: Initial; companies: { id: string; name: string }[]; users: { id: string; firstName: string; lastName: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updateProjectAction(initial.id, fd); toast.success("Projet mis à jour"); router.refresh(); }
          else { await createProjectAction(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <label className="label">Nom *</label>
          <input name="name" defaultValue={initial?.name ?? ""} required className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Mode</label>
          <select name="mode" defaultValue={initial?.mode ?? "PROJECT"} className="input" disabled={!!initial?.id}>
            <option value="PROJECT">Projet (forfait)</option>
            <option value="CONSULTING">Consultance (T&amp;M)</option>
          </select>
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "TO_START"} className="input">
            <option value="TO_START">À démarrer</option>
            <option value="ACTIVE">Actif</option>
            <option value="ON_HOLD">En pause</option>
            <option value="COMPLETED">Terminé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Client *</label>
          <select name="companyId" defaultValue={initial?.companyId ?? ""} required className="input">
            <option value="">— Sélectionner —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Chef de projet</label>
          <select name="managerId" defaultValue={initial?.managerId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Début prévu</label>
          <input name="plannedStart" type="date" defaultValue={dateInput(initial?.plannedStart)} className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Fin prévue</label>
          <input name="plannedEnd" type="date" defaultValue={dateInput(initial?.plannedEnd)} className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Début réel</label>
          <input name="actualStart" type="date" defaultValue={dateInput(initial?.actualStart)} className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Fin réelle</label>
          <input name="actualEnd" type="date" defaultValue={dateInput(initial?.actualEnd)} className="input" />
        </div>
        <div className="col-span-4">
          <label className="label">Budget vendu HT (€)</label>
          <input name="budgetSell" type="number" step="0.01" defaultValue={initial?.budgetSell ?? 0} className="input" />
        </div>
        <div className="col-span-4">
          <label className="label">Budget coût (€)</label>
          <input name="budgetCost" type="number" step="0.01" defaultValue={initial?.budgetCost ?? 0} className="input" />
        </div>
        <div className="col-span-4">
          <label className="label">Budget temps (heures)</label>
          <input name="budgetTimeH" type="number" step="0.5" defaultValue={initial?.budgetTimeH ?? 0} className="input" />
        </div>
        <div className="col-span-12">
          <label className="label">Description</label>
          <textarea name="description" defaultValue={initial?.description ?? ""} className="input min-h-[80px] py-2" />
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Risques</label>
          <textarea name="risks" defaultValue={initial?.risks ?? ""} className="input min-h-[60px] py-2" />
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Notes</label>
          <textarea name="notes" defaultValue={initial?.notes ?? ""} className="input min-h-[60px] py-2" />
        </div>
      </div>
      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer le projet"}</button>
      </div>
    </form>
  );
}
