"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Sparkles,
  FileText,
  Save,
  RotateCcw
} from "lucide-react";
import {
  parseSupplierInvoice,
  createSupplierInvoice,
  type ParsedSupplierInvoice
} from "@/server/actions/supplier-invoices";
import { SUPPLIER_INVOICE_VAT_RULES } from "@/lib/belgian-vat-rules";

// Ordre d'affichage groupé pour la déclaration TVA — voitures en haut car
// c'est le piège classique (50 % automatique), puis non-déductibles, puis
// le reste.
const CATEGORY_ORDER: { group: string; keys: string[] }[] = [
  { group: "Voiture (50 %)", keys: ["CAR_PURCHASE", "CAR_LEASE", "CAR_FUEL", "CAR_MAINTENANCE", "CAR_INSURANCE"] },
  { group: "Non déductibles (0 %)", keys: ["RESTAURANT", "HOTEL", "GIFT_HIGH", "REPRESENTATION"] },
  { group: "Services (100 %)", keys: ["SOFTWARE_SAAS", "SUBCONTRACTING", "TELECOM", "PROFESSIONAL_SERVICES", "TRAINING", "UTILITIES", "OFFICE_RENT", "GIFT_LOW"] },
  { group: "Biens & matériel (100 %)", keys: ["OFFICE_SUPPLIES", "HARDWARE_SMALL", "HARDWARE_INVESTMENT"] },
  { group: "Autre", keys: ["OTHER"] }
];

type Company = { id: string; name: string };

export function UploadAndCreate({ companies }: { companies: Company[] }) {
  const [pending, start] = useTransition();
  const [ocrPending, setOcrPending] = useState(false);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSupplierInvoice | null>(null);
  const [form, setForm] = useState({
    supplierName: "",
    supplierCompanyId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amountHt: "",
    vatRate: "21",
    vatAmount: "",
    amountTtc: "",
    category: "OTHER",
    vatDeductibleRateOverride: ""
  });

  function reset() {
    setDataUri(null);
    setFilename(null);
    setParsed(null);
    setForm({
      supplierName: "",
      supplierCompanyId: "",
      invoiceNumber: "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      amountHt: "",
      vatRate: "21",
      vatAmount: "",
      amountTtc: "",
      category: "OTHER",
      vatDeductibleRateOverride: ""
    });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop lourd (>10MB)");
      return;
    }
    setFilename(file.name);
    setParsed(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const uri = reader.result as string;
      setDataUri(uri);
      setOcrPending(true);
      const result = await parseSupplierInvoice(uri);
      setOcrPending(false);
      if (!result.ok) {
        toast.warning(`OCR indisponible : ${result.error}. Remplis à la main.`);
        return;
      }
      const d = result.data!;
      setParsed(d);
      // Match auto le fournisseur (lookup côté serveur fait pendant le create,
      // mais on peut suggérer côté UI aussi)
      const matchedCompany = d.supplierName
        ? companies.find((c) =>
            c.name.toLowerCase().includes(d.supplierName!.toLowerCase())
          )
        : undefined;
      setForm({
        supplierName: d.supplierName ?? "",
        supplierCompanyId: matchedCompany?.id ?? "",
        invoiceNumber: d.invoiceNumber ?? "",
        invoiceDate: d.invoiceDate ?? new Date().toISOString().slice(0, 10),
        dueDate: d.dueDate ?? "",
        amountHt:
          d.amountHt != null
            ? String(d.amountHt)
            : d.amountTtc != null && d.vatRate != null
              ? String((d.amountTtc / (1 + d.vatRate / 100)).toFixed(2))
              : "",
        vatRate: d.vatRate != null ? String(d.vatRate) : "21",
        vatAmount: d.vatAmount != null ? String(d.vatAmount) : "",
        amountTtc: d.amountTtc != null ? String(d.amountTtc) : ""
      });
      toast.success(`Facture parsée via ${result.provider} — vérifie les champs avant d'enregistrer`);
    };
    reader.readAsDataURL(file);
  }

  // Calculs auto si HTVA et taux modifiés
  const computedVat =
    Number(form.amountHt || 0) * (Number(form.vatRate || 0) / 100);
  const computedTtc = Number(form.amountHt || 0) + computedVat;

  function submit() {
    if (!form.supplierName.trim()) {
      toast.error("Nom du fournisseur requis");
      return;
    }
    if (!form.amountHt || Number(form.amountHt) <= 0) {
      toast.error("Montant HTVA requis");
      return;
    }
    const fd = new FormData();
    fd.set("supplierName", form.supplierName);
    fd.set("supplierCompanyId", form.supplierCompanyId);
    fd.set("invoiceNumber", form.invoiceNumber);
    fd.set("invoiceDate", form.invoiceDate);
    fd.set("dueDate", form.dueDate);
    fd.set("amountHt", form.amountHt);
    fd.set("vatRate", form.vatRate);
    fd.set("vatAmount", form.vatAmount || String(computedVat.toFixed(2)));
    fd.set("amountTtc", form.amountTtc || String(computedTtc.toFixed(2)));
    fd.set("category", form.category);
    if (form.vatDeductibleRateOverride.trim() !== "") {
      fd.set("vatDeductibleRateOverride", form.vatDeductibleRateOverride);
    }
    if (dataUri) fd.set("pdfUrl", dataUri);
    if (parsed) fd.set("ocrPayload", JSON.stringify(parsed));
    fd.set("source", "manual");
    start(async () => {
      try {
        await createSupplierInvoice(fd);
        toast.success("Facture enregistrée");
        reset();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Zone drop */}
      <div>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-midnight-300 rounded-lg p-6 cursor-pointer hover:border-indigoaccent transition-colors min-h-[220px]">
          {ocrPending ? (
            <div className="flex flex-col items-center gap-2 text-indigoaccent">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">OCR en cours...</span>
              <span className="text-[11px] text-midnight-500">10-30 secondes</span>
            </div>
          ) : filename ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-emerald-600" />
              <span className="text-sm font-medium">{filename}</span>
              <span className="text-[11px] text-midnight-500">Clique pour remplacer</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-midnight-500">
              <Upload className="w-8 h-8" />
              <span className="text-sm">Drop le PDF de la facture</span>
              <span className="text-[11px]">
                <Sparkles className="w-3 h-3 inline" /> OCR auto via Gemini (gratuit)
              </span>
            </div>
          )}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </label>
        {filename && (
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs text-midnight-500 hover:text-midnight-900 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Recommencer
          </button>
        )}
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <label className="label">
            Fournisseur <span className="text-red-600">*</span>
          </label>
          <input
            value={form.supplierName}
            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            className="input"
            placeholder="Nom (tel qu'extrait du PDF)"
          />
          <select
            value={form.supplierCompanyId}
            onChange={(e) => setForm({ ...form, supplierCompanyId: e.target.value })}
            className="input mt-1 text-xs"
          >
            <option value="">— Pas de Company liée (créer plus tard) —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-midnight-400 mt-0.5">
            Le matching auto fait au save si tu sélectionnes pas.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">N° facture</label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">
              Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              value={form.invoiceDate}
              onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Échéance</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">TVA %</label>
            <select
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
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">
              HTVA <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.amountHt}
              onChange={(e) => setForm({ ...form, amountHt: e.target.value, vatAmount: "", amountTtc: "" })}
              className="input"
            />
          </div>
          <div>
            <label className="label">TVA</label>
            <input
              type="number"
              step="0.01"
              value={form.vatAmount || computedVat.toFixed(2)}
              onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}
              className="input text-midnight-600"
            />
          </div>
          <div>
            <label className="label">TTC</label>
            <input
              type="number"
              step="0.01"
              value={form.amountTtc || computedTtc.toFixed(2)}
              onChange={(e) => setForm({ ...form, amountTtc: e.target.value })}
              className="input font-medium"
            />
          </div>
        </div>

        {/* Catégorie TVA belge : pilote la déduction (voiture = 50 %, restau = 0 %, etc.)
            et la case de la grille (81 biens, 82 services, 83 investissements). */}
        <div>
          <label className="label">Catégorie TVA</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value, vatDeductibleRateOverride: "" })}
            className="input"
          >
            {CATEGORY_ORDER.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.keys.map((k) => (
                  <option key={k} value={k}>
                    {SUPPLIER_INVOICE_VAT_RULES[k].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {(() => {
            const rule = SUPPLIER_INVOICE_VAT_RULES[form.category] ?? SUPPLIER_INVOICE_VAT_RULES.OTHER;
            const override = form.vatDeductibleRateOverride.trim() !== ""
              ? Math.max(0, Math.min(1, Number(form.vatDeductibleRateOverride) || 0))
              : null;
            const effective = override !== null ? override : rule.deductibleRate;
            const vatNum = Number(form.vatAmount || computedVat.toFixed(2));
            const deductible = vatNum * effective;
            return (
              <div className="mt-1.5 text-[11px] text-midnight-500 flex items-center gap-2">
                <span>
                  Case <strong>{rule.vatBox}</strong> · Déduction par défaut{" "}
                  <strong>{Math.round(rule.deductibleRate * 100)} %</strong>
                </span>
                {override !== null && (
                  <span className="text-amber-700">
                    · Override : <strong>{Math.round(override * 100)} %</strong>
                  </span>
                )}
                <span className="ml-auto font-medium text-midnight-700">
                  TVA déductible effective : {deductible.toFixed(2)} €
                </span>
              </div>
            );
          })()}
        </div>

        {/* Override manuel : champ avancé, vide par défaut → on applique la règle.
            Mets 1 sur une voiture 100 % pro (carnet de bord), 0 sur un truc atypique. */}
        <details className="text-xs">
          <summary className="cursor-pointer text-midnight-500 hover:text-midnight-900">
            Override du taux de déduction (cas particuliers)
          </summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              placeholder="Ex. 1 pour voiture 100 % pro"
              value={form.vatDeductibleRateOverride}
              onChange={(e) => setForm({ ...form, vatDeductibleRateOverride: e.target.value })}
              className="input max-w-[180px]"
            />
            <span className="text-midnight-400">de 0 à 1 — laisse vide pour appliquer la règle</span>
          </div>
        </details>

        <button
          onClick={submit}
          className="btn-primary w-full"
          disabled={pending || ocrPending}
        >
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer la facture
        </button>
      </div>
    </div>
  );
}
