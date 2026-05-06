"use client";
import { useTransition } from "react";
import { createMission, updateMission } from "@/server/actions/missions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function MissionForm({
  initial, companies, contacts, users, initialOwnerId
}: {
  initial?: any;
  companies: { id: string; name: string }[];
  contacts: { id: string; firstName: string; lastName: string; companyId: string | null }[];
  users: { id: string; firstName: string; lastName: string }[];
  initialOwnerId?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updateMission(initial.id, fd); toast.success("Mis à jour"); router.refresh(); }
          else { await createMission(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8">
          <label className="label">Titre *</label>
          <input name="title" defaultValue={initial?.title ?? ""} required className="input" placeholder="ex: Senior Backend Java pour MES" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "NEW"} className="input">
            <option value="NEW">Nouvelle</option>
            <option value="QUALIFYING">Qualification</option>
            <option value="PRESENTING">Présentation</option>
            <option value="CONTRACTED">Contractée</option>
            <option value="LOST">Perdue</option>
            <option value="CANCELLED">Annulée</option>
          </select>
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Resp. commercial</label>
          <select name="ownerId" defaultValue={initial?.ownerId ?? initialOwnerId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
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
          <label className="label">Contact client</label>
          <select name="contactId" defaultValue={initial?.contactId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Société de portage <span className="text-midnight-400 text-xs">(optionnel — ex: Randstad)</span></label>
          <select name="intermediaryCompanyId" defaultValue={initial?.intermediaryCompanyId ?? ""} className="input">
            <option value="">— Mission directe (sans intermédiaire) —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Contact société de portage</label>
          <select name="intermediaryContactId" defaultValue={initial?.intermediaryContactId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-4">
          <label className="label">Séniorité</label>
          <input name="seniority" defaultValue={initial?.seniority ?? ""} placeholder="ex: Senior 5+ ans" className="input" />
        </div>
        <div className="col-span-4">
          <label className="label">Localisation</label>
          <input name="workLocation" defaultValue={initial?.workLocation ?? ""} placeholder="ex: Hybride Bruxelles 2j/semaine" className="input" />
        </div>
        <div className="col-span-4">
          <label className="label">Jours estimés</label>
          <input name="estimatedDays" type="number" defaultValue={initial?.estimatedDays ?? ""} className="input" />
        </div>
        <div className="col-span-12">
          <label className="label">Compétences requises (séparées par virgule)</label>
          <input name="requiredSkills" defaultValue={(initial?.requiredSkills ?? []).join(", ")} className="input" placeholder="java, spring boot, kubernetes..." />
        </div>
        <div className="col-span-3">
          <label className="label">Date début</label>
          <input name="startDate" type="date" defaultValue={initial?.startDate ? new Date(initial.startDate).toISOString().slice(0,10) : ""} className="input" />
        </div>
        <div className="col-span-3">
          <label className="label">Date fin</label>
          <input name="endDate" type="date" defaultValue={initial?.endDate ? new Date(initial.endDate).toISOString().slice(0,10) : ""} className="input" />
        </div>
        <div className="col-span-3">
          <label className="label">Tarif cible (€/j)</label>
          <input name="targetDailyRate" type="number" step="0.01" defaultValue={initial?.targetDailyRate ?? ""} className="input" />
        </div>
        <div className="col-span-3">
          <label className="label">Tarif max accepté</label>
          <input name="maxDailyRate" type="number" step="0.01" defaultValue={initial?.maxDailyRate ?? ""} className="input" />
        </div>
        <div className="col-span-12">
          <label className="label">Description</label>
          <textarea name="description" defaultValue={initial?.description ?? ""} className="input min-h-[100px] py-2" />
        </div>
        <div className="col-span-12">
          <label className="label">Notes internes</label>
          <textarea name="notes" defaultValue={initial?.notes ?? ""} className="input min-h-[60px] py-2" />
        </div>
      </div>
      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer la demande"}</button>
      </div>
    </form>
  );
}
