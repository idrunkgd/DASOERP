"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, Loader2, X } from "lucide-react";
import {
  createExpenseReport,
  updateExpenseReport,
  ocrReceipt
} from "@/server/actions/expense-reports";

type Mission = { id: string; label: string };

/** Note existante à éditer — quand présente, le form passe en mode UPDATE. */
export type ExpenseEditData = {
  id: string;
  date: string;         // yyyy-mm-dd
  category: string;
  description: string;
  amountHt: number;
  vatRate: number;
  missionId: string | null;
  receiptUrl: string | null;
};

export function NewExpenseForm({
  missions,
  editing
}: {
  missions: Mission[];
  editing?: ExpenseEditData | null;
}) {
  const router = useRouter();
  const isEdit = !!editing;
  const [pending, start] = useTransition();
  const [ocrPending, setOcrPending] = useState(false);
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(
    editing?.receiptUrl ?? null
  );
  const [form, setForm] = useState({
    date: editing?.date ?? new Date().toISOString().slice(0, 10),
    category: editing?.category ?? "OTHER",
    description: editing?.description ?? "",
    amountHt: editing ? String(editing.amountHt) : "",
    vatRate: editing ? String(editing.vatRate) : "21",
    missionId: editing?.missionId ?? ""
  });

  const vatAmount =
    Number(form.amountHt || 0) * (Number(form.vatRate || 0) / 100);
  const ttc = Number(form.amountHt || 0) + vatAmount;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image trop lourde (>4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setReceiptDataUri(dataUri);
      // Lancer OCR automatiquement
      setOcrPending(true);
      const result = await ocrReceipt(dataUri);
      setOcrPending(false);
      if (!result.ok) {
        toast.warning(
          `OCR indisponible : ${result.error}. Remplis les champs à la main.`
        );
        return;
      }
      const d = result.data!;
      setForm((f) => ({
        ...f,
        date: d.date ?? f.date,
        amountHt:
          d.amountHt != null
            ? String(d.amountHt)
            : d.amountTtc != null && d.vatRate != null
              ? String((d.amountTtc / (1 + d.vatRate / 100)).toFixed(2))
              : f.amountHt,
        vatRate: d.vatRate != null ? String(d.vatRate) : f.vatRate,
        description: d.description ?? (d.vendor ? `Frais chez ${d.vendor}` : f.description),
        category: d.category ?? f.category
      }));
      toast.success("Ticket scanné — vérifie les champs avant de soumettre");
    };
    reader.readAsDataURL(file);
  }

  function submit(formData: FormData) {
    if (receiptDataUri) formData.set("receiptUrl", receiptDataUri);
    start(async () => {
      try {
        if (isEdit && editing) {
          await updateExpenseReport(editing.id, formData);
          toast.success("Note modifiée");
          // On sort du mode édition en nettoyant l'URL
          router.replace("/expenses");
        } else {
          await createExpenseReport(formData);
          toast.success("Note de frais créée (brouillon)");
          setForm({
            date: new Date().toISOString().slice(0, 10),
            category: "OTHER",
            description: "",
            amountHt: "",
            vatRate: "21",
            missionId: ""
          });
          setReceiptDataUri(null);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function cancelEdit() {
    router.replace("/expenses");
  }

  return (
    <form action={submit} className="grid md:grid-cols-2 gap-4">
      {/* Colonne 1 — Photo + OCR */}
      <div>
        <label className="label">Ticket / facture</label>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-midnight-300 rounded-lg p-6 cursor-pointer hover:border-indigoaccent transition-colors min-h-[200px]">
          {ocrPending ? (
            <div className="flex flex-col items-center gap-2 text-indigoaccent">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Claude lit le ticket...</span>
            </div>
          ) : receiptDataUri ? (
            <img
              src={receiptDataUri}
              alt=""
              className="max-h-48 rounded shadow"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-midnight-500">
              <Upload className="w-8 h-8" />
              <span className="text-sm">Clique pour choisir une photo</span>
              <span className="text-[11px]">
                PNG/JPG/WebP, max 4MB. <Sparkles className="w-3 h-3 inline" /> OCR auto via Claude
              </span>
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* Colonne 2 — Champs */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select
              name="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              <option value="TRANSPORT">Transport</option>
              <option value="MEAL">Repas</option>
              <option value="ACCOMMODATION">Hébergement</option>
              <option value="SUPPLIES">Fournitures</option>
              <option value="SOFTWARE">Logiciel</option>
              <option value="TRAINING">Formation</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <input
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
            placeholder="ex: Repas client chez XYZ"
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">HTVA</label>
            <input
              name="amountHt"
              type="number"
              step="0.01"
              value={form.amountHt}
              onChange={(e) => setForm({ ...form, amountHt: e.target.value })}
              className="input"
              required
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="label">TVA %</label>
            <select
              name="vatRate"
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              className="input"
            >
              <option value="0">0%</option>
              <option value="6">6%</option>
              <option value="12">12%</option>
              <option value="21">21%</option>
            </select>
          </div>
          <div>
            <label className="label">TTC</label>
            <input
              type="text"
              readOnly
              value={ttc.toFixed(2) + " €"}
              className="input bg-midnight-50 text-midnight-700"
            />
          </div>
        </div>
        <div>
          <label className="label">Rattacher à une mission (refacturation)</label>
          <select
            name="missionId"
            value={form.missionId}
            onChange={(e) => setForm({ ...form, missionId: e.target.value })}
            className="input"
          >
            <option value="">— Aucune —</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={cancelEdit}
              className="btn-secondary"
              disabled={pending}
            >
              <X className="w-4 h-4" /> Annuler
            </button>
          )}
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={pending || ocrPending}
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEdit ? "Enregistrer les modifications" : "Créer la note (brouillon)"}
          </button>
        </div>
      </div>
    </form>
  );
}
