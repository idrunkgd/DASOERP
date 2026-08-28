"use client";
import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { createPurchaseOrder, updatePurchaseOrder } from "@/server/actions/purchase-orders";
import { isNextControlFlow } from "@/lib/next-errors";

export interface POLineInput {
  label: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPriceHt: number;
  vatRate: number;
}

export interface POFormInitial {
  id?: string;                     // présent = mode édition
  title: string;
  projectId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryDate?: string | null;    // yyyy-mm-dd
  paymentTerms?: string | null;
  notes?: string | null;
  currency: string;
  lines: POLineInput[];
}

export function POForm({
  initial,
  suppliers,
  projects
}: {
  initial: POFormInitial;
  suppliers: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; reference: string; name: string }>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [projectId, setProjectId] = useState<string>(initial.projectId ?? "");
  const [supplierId, setSupplierId] = useState<string>(initial.supplierId ?? "");
  const [supplierName, setSupplierName] = useState(initial.supplierName ?? "");
  const [contactName, setContactName] = useState(initial.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(initial.deliveryAddress ?? "");
  const [deliveryDate, setDeliveryDate] = useState(initial.deliveryDate ?? "");
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms ?? "30 jours net");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [currency, setCurrency] = useState(initial.currency);
  const [lines, setLines] = useState<POLineInput[]>(
    initial.lines.length > 0
      ? initial.lines
      : [{ label: "", quantity: 1, unitPriceHt: 0, vatRate: 21 }]
  );
  const [pending, start] = useTransition();
  const router = useRouter();

  const totals = useMemo(() => {
    let ht = 0, vat = 0;
    for (const l of lines) {
      const line = Number((l.quantity * l.unitPriceHt).toFixed(2));
      ht += line;
      vat += Number(((line * l.vatRate) / 100).toFixed(2));
    }
    return { ht, vat, ttc: ht + vat };
  }, [lines]);

  function updateLine(i: number, patch: Partial<POLineInput>) {
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() {
    setLines((ls) => [...ls, { label: "", quantity: 1, unitPriceHt: 0, vatRate: 21 }]);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);
  }

  function onSubmit() {
    // Validation client basique
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!supplierId && !supplierName.trim()) { toast.error("Sélectionne un fournisseur ou saisis un nom"); return; }
    if (lines.some((l) => !l.label.trim())) { toast.error("Toutes les lignes doivent avoir une désignation"); return; }

    const fd = new FormData();
    fd.set("title", title);
    fd.set("projectId", projectId);
    fd.set("supplierId", supplierId);
    fd.set("supplierName", supplierName);
    fd.set("contactName", contactName);
    fd.set("contactEmail", contactEmail);
    fd.set("deliveryAddress", deliveryAddress);
    fd.set("deliveryDate", deliveryDate);
    fd.set("paymentTerms", paymentTerms);
    fd.set("notes", notes);
    fd.set("currency", currency);
    fd.set("lines", JSON.stringify(lines));

    start(async () => {
      try {
        if (initial.id) {
          await updatePurchaseOrder(initial.id, fd);
          toast.success("PO mis à jour");
          router.refresh();
        } else {
          await createPurchaseOrder(fd);
          // createPO fait un redirect vers /purchase-orders/[id] côté serveur
        }
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      {/* Section 1 : Titre + fournisseur */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Informations générales</h3>
        <div>
          <label className="label">Titre / objet du PO *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} className="input" placeholder="Commande matériel PLC — mission Yara" />
        </div>
        <div>
          <label className="label">Projet lié (optionnel)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
            <option value="">— Aucun (achat hors projet) —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
          </select>
          <p className="text-[10px] text-midnight-500 mt-1">Rattacher un PO à un projet permet de suivre le budget d'achats depuis la fiche projet.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Fournisseur (dans le CRM)</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
              <option value="">— Aucun (utiliser le nom libre ci-dessous) —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ou nom fournisseur (texte libre)</label>
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="input" placeholder="Siemens SA" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Contact chez le fournisseur</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="input" placeholder="Marie Dupont" />
          </div>
          <div>
            <label className="label">Email du contact</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input" placeholder="marie@fournisseur.be" />
          </div>
        </div>
      </div>

      {/* Section 2 : Lignes */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Lignes de commande</h3>
          <button type="button" onClick={addLine} className="btn-secondary btn-sm text-xs">
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-midnight-500 uppercase tracking-wide">
                <th className="pb-2 pr-2 w-[40%]">Désignation</th>
                <th className="pb-2 px-2 w-[10%] text-right">Qté</th>
                <th className="pb-2 px-2 w-[10%]">Unité</th>
                <th className="pb-2 px-2 w-[15%] text-right">Prix U. HT</th>
                <th className="pb-2 px-2 w-[10%] text-right">TVA %</th>
                <th className="pb-2 px-2 w-[12%] text-right">Total HT</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const total = (l.quantity * l.unitPriceHt).toFixed(2);
                // Chaque ligne = 2 tr : la 1re avec les champs numériques,
                // la 2e avec la description sur toute la largeur (colspan).
                // Solution : description systématiquement visible pour éviter
                // le bug d'affichage quand on stackait input+input dans le même td.
                return [
                  <tr key={`${i}-row`} className="border-t border-border align-top">
                    <td className="py-2 pr-2">
                      <input value={l.label} onChange={(e) => updateLine(i, { label: e.target.value })} required className="input text-xs w-full h-9" placeholder="Désignation (ex: Automate S7-1200 CPU 1214C)" />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input type="number" step="0.001" min="0" value={l.quantity} onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })} className="input text-xs text-right w-full h-9" />
                    </td>
                    <td className="py-2 px-2">
                      <input value={l.unit ?? ""} onChange={(e) => updateLine(i, { unit: e.target.value })} className="input text-xs w-full h-9" placeholder="pce" />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input type="number" step="0.01" min="0" value={l.unitPriceHt} onChange={(e) => updateLine(i, { unitPriceHt: parseFloat(e.target.value) || 0 })} className="input text-xs text-right w-full h-9" />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input type="number" step="0.01" min="0" max="100" value={l.vatRate} onChange={(e) => updateLine(i, { vatRate: parseFloat(e.target.value) || 0 })} className="input text-xs text-right w-full h-9" />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{total}</td>
                    <td className="py-2 pl-2">
                      <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 1}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Supprimer la ligne">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>,
                  <tr key={`${i}-desc`} className="border-b border-border/40">
                    <td colSpan={7} className="pb-3 pt-0 pr-2">
                      <textarea
                        value={l.description ?? ""}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        rows={1}
                        className="w-full text-[11px] px-3 py-1.5 rounded-lg border border-border bg-white text-midnight-600 focus:outline-none focus:ring-2 focus:ring-indigoaccent/40 focus:border-indigoaccent resize-y"
                        placeholder="↳ Description / détail (optionnel — visible sur le PDF sous la désignation)"
                      />
                    </td>
                  </tr>
                ];
              })}
            </tbody>
          </table>
        </div>
        {/* Totaux */}
        <div className="mt-3 flex justify-end">
          <div className="w-64 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-midnight-500">Total HT</span><span className="tabular-nums font-semibold">{totals.ht.toFixed(2)} {currency}</span></div>
            <div className="flex justify-between"><span className="text-midnight-500">TVA</span><span className="tabular-nums">{totals.vat.toFixed(2)} {currency}</span></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1 text-sm">
              <span className="font-semibold">Total TTC</span>
              <span className="tabular-nums font-bold text-indigoaccent">{totals.ttc.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 : Livraison & paiement */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-sm">Livraison & paiement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Date de livraison souhaitée</label>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Termes de paiement</label>
            <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="input" placeholder="30 jours net" />
          </div>
        </div>
        <div>
          <label className="label">Adresse de livraison (si différente du siège)</label>
          <textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} className="input" placeholder="Chantier client, adresse du site…" />
        </div>
        <div>
          <label className="label">Notes / conditions particulières</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="Conditions particulières, mention de la mission ou du projet lié, etc." />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button disabled={pending} className="btn-primary">
          {pending ? "Enregistrement…" : (initial.id ? "Enregistrer" : "Créer le PO")}
        </button>
      </div>
    </form>
  );
}
