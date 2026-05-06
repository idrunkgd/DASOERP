"use client";
import { useTransition } from "react";
import { updateMissionExec } from "@/server/actions/mission-execs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function dateInput(d?: Date | string | null) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export function MissionExecForm({
  initial, companies, consultants, contacts
}: {
  initial?: any;
  companies: { id: string; name: string }[];
  consultants: { id: string; firstName: string; lastName: string }[];
  contacts: { id: string; firstName: string; lastName: string; companyId: string | null }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try { await updateMissionExec(initial.id, fd); toast.success("Mis à jour"); router.refresh(); }
        catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8">
          <label className="label">Titre *</label>
          <input name="title" defaultValue={initial.title} required className="input" />
        </div>
        <div className="col-span-12 md:col-span-4">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial.status} className="input">
            <option value="PLANNED">Planifiée</option>
            <option value="ACTIVE">Active</option>
            <option value="EXTENDED">Prolongée</option>
            <option value="ON_HOLD">En pause</option>
            <option value="COMPLETED">Terminée</option>
            <option value="CANCELLED">Annulée</option>
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Client final *</label>
          <select name="companyId" defaultValue={initial.companyId} required className="input">
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Consultant assigné</label>
          <select name="consultantId" defaultValue={initial.consultantId ?? ""} className="input">
            <option value="">— Non assignée —</option>
            {consultants.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Société de portage <span className="text-midnight-400 text-xs">(optionnel)</span></label>
          <select name="intermediaryCompanyId" defaultValue={initial.intermediaryCompanyId ?? ""} className="input">
            <option value="">— Mission directe —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Contact société de portage</label>
          <select name="intermediaryContactId" defaultValue={initial.intermediaryContactId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-3"><label className="label">Début *</label><input name="startDate" type="date" defaultValue={dateInput(initial.startDate)} required className="input" /></div>
        <div className="col-span-3"><label className="label">Fin prévue *</label><input name="endDate" type="date" defaultValue={dateInput(initial.endDate)} required className="input" /></div>
        <div className="col-span-3"><label className="label">Fin réelle</label><input name="actualEndDate" type="date" defaultValue={dateInput(initial.actualEndDate)} className="input" /></div>
        <div className="col-span-3"><label className="label">Jours estimés</label><input name="estimatedDays" type="number" defaultValue={initial.estimatedDays ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Tarif / j (€) *</label><input name="dailyRate" type="number" step="0.01" defaultValue={initial.dailyRate} required className="input" /></div>
        <div className="col-span-3"><label className="label">Coût / j (€) *</label><input name="dailyCost" type="number" step="0.01" defaultValue={initial.dailyCost} required className="input" /></div>
        <div className="col-span-3">
          <label className="label">Facturation</label>
          <select name="billingFrequency" defaultValue={initial.billingFrequency} className="input">
            <option value="MONTHLY">Mensuelle</option>
            <option value="WEEKLY">Hebdomadaire</option>
            <option value="CUSTOM">Sur demande</option>
          </select>
        </div>
        <div className="col-span-3"><label className="label">Localisation</label><input name="workLocation" defaultValue={initial.workLocation ?? ""} className="input" /></div>
        <div className="col-span-12"><label className="label">Notes</label><textarea name="notes" defaultValue={initial.notes ?? ""} className="input min-h-[80px] py-2" /></div>
      </div>
      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "..." : "Enregistrer"}</button>
      </div>
    </form>
  );
}
