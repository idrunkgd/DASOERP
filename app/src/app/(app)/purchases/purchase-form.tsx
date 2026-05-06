"use client";
import { useTransition } from "react";
import { createPurchase, updatePurchase, deletePurchase } from "@/server/actions/purchases";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = any;

const CATS = [
  { value: "HARDWARE", label: "Matériel" },
  { value: "LICENSE", label: "Licence" },
  { value: "SUBCONTRACTING", label: "Sous-traitance" },
  { value: "TRAVEL", label: "Déplacement" },
  { value: "TRAINING", label: "Formation" },
  { value: "OTHER", label: "Autre" }
];

export function PurchaseForm({
  initial, projects, suppliers
}: { initial?: Initial; projects: { id: string; reference: string; name: string }[]; suppliers: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updatePurchase(initial.id, fd); toast.success("Mis à jour"); router.refresh(); }
          else { await createPurchase(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 max-w-3xl space-y-4"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <label className="label">Projet *</label>
          <select name="projectId" defaultValue={initial?.projectId ?? ""} required className="input">
            <option value="">— Sélectionner —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Fournisseur</label>
          <select name="supplierId" defaultValue={initial?.supplierId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="col-span-12">
          <label className="label">Description *</label>
          <input name="description" defaultValue={initial?.description ?? ""} required className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Catégorie</label>
          <select name="category" defaultValue={initial?.category ?? "OTHER"} className="input">
            {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Montant HT (€) *</label>
          <input name="amount" type="number" step="0.01" defaultValue={initial?.amount ?? ""} required className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Date *</label>
          <input name="purchaseDate" type="date" defaultValue={initial?.purchaseDate ? new Date(initial.purchaseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)} required className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "PLANNED"} className="input">
            <option value="PLANNED">Prévu</option>
            <option value="ORDERED">Commandé</option>
            <option value="RECEIVED">Reçu</option>
            <option value="PAID">Payé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
        <div className="col-span-12">
          <label className="label">Commentaire</label>
          <textarea name="comment" defaultValue={initial?.comment ?? ""} className="input min-h-[60px] py-2" />
        </div>
      </div>
      <div className="flex justify-between">
        {initial?.id ? (
          <button
            type="button"
            onClick={() => { if (window.confirm("Supprimer ?")) start(async () => { await deletePurchase(initial.id); window.location.href = "/purchases"; }); }}
            className="btn-danger btn-sm"
          >Supprimer</button>
        ) : <span />}
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
