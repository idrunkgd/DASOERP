"use client";
import { useTransition } from "react";
import { createCostCenter, updateCostCenter, deleteCostCenter } from "@/server/actions/cost-centers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CostCenterForm({ initial }: { initial?: any }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updateCostCenter(initial.id, fd); toast.success("Mis à jour"); router.refresh(); }
          else { await createCostCenter(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 max-w-2xl space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3"><label className="label">Code *</label><input name="code" defaultValue={initial?.code ?? ""} required className="input font-mono uppercase" placeholder="ex: SALES" /></div>
        <div className="col-span-9"><label className="label">Nom *</label><input name="name" defaultValue={initial?.name ?? ""} required className="input" placeholder="ex: Activité commerciale" /></div>
        <div className="col-span-6">
          <label className="label">Type</label>
          <select name="kind" defaultValue={initial?.kind ?? "OTHER"} className="input">
            <option value="SALES">Commercial</option>
            <option value="LEAVE">Congés</option>
            <option value="MEETING">Réunion interne</option>
            <option value="ADMIN">Administratif</option>
            <option value="TRAINING">Formation</option>
            <option value="RND">R&D</option>
            <option value="OTHER">Autre</option>
          </select>
        </div>
        <div className="col-span-3">
          <label className="label">Compte comme productif</label>
          <select name="countsAsBillable" defaultValue={initial?.countsAsBillable ? "true" : "false"} className="input">
            <option value="false">Non</option><option value="true">Oui</option>
          </select>
        </div>
        <div className="col-span-3">
          <label className="label">Statut</label>
          <select name="active" defaultValue={initial?.active === false ? "false" : "true"} className="input">
            <option value="true">Actif</option><option value="false">Inactif</option>
          </select>
        </div>
        <div className="col-span-12"><label className="label">Description</label><textarea name="description" defaultValue={initial?.description ?? ""} className="input min-h-[60px] py-2" /></div>
      </div>
      <div className="flex justify-between">
        {initial?.id ? (
          <button type="button"
            onClick={() => { if (window.confirm("Supprimer ?")) start(async () => { await deleteCostCenter(initial.id); window.location.href = "/cost-centers"; }); }}
            className="btn-danger btn-sm"
          >Supprimer</button>
        ) : <span />}
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
