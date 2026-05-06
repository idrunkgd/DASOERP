"use client";
import { useTransition } from "react";
import { createProfile, updateProfile, deleteProfile } from "@/server/actions/service-profiles";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ProfileForm({ initial }: { initial?: any }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updateProfile(initial.id, fd); toast.success("Profil mis à jour"); router.refresh(); }
          else { await createProfile(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 max-w-2xl space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8"><label className="label">Nom *</label><input name="name" defaultValue={initial?.name ?? ""} required className="input" placeholder="ex: Senior Developer" /></div>
        <div className="col-span-4">
          <label className="label">Statut</label>
          <select name="active" defaultValue={initial?.active === false ? "false" : "true"} className="input">
            <option value="true">Actif</option><option value="false">Inactif</option>
          </select>
        </div>
        <div className="col-span-12"><label className="label">Description</label><textarea name="description" defaultValue={initial?.description ?? ""} className="input min-h-[60px] py-2" /></div>
        <div className="col-span-3"><label className="label">Cout / h (€) *</label><input name="hourlyCost" type="number" step="0.01" defaultValue={initial?.hourlyCost ?? ""} required className="input" /></div>
        <div className="col-span-3"><label className="label">Vente / h (€) *</label><input name="hourlySell" type="number" step="0.01" defaultValue={initial?.hourlySell ?? ""} required className="input" /></div>
        <div className="col-span-3"><label className="label">Cout / j (€) *</label><input name="dailyCost" type="number" step="0.01" defaultValue={initial?.dailyCost ?? ""} required className="input" /></div>
        <div className="col-span-3"><label className="label">Vente / j (€) *</label><input name="dailySell" type="number" step="0.01" defaultValue={initial?.dailySell ?? ""} required className="input" /></div>
      </div>
      <div className="flex justify-between">
        {initial?.id ? (
          <button type="button"
            onClick={() => { if (window.confirm("Supprimer ce profil ?")) start(async () => { await deleteProfile(initial.id); window.location.href = "/service-profiles"; }); }}
            className="btn-danger btn-sm"
          >Supprimer</button>
        ) : <span />}
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
