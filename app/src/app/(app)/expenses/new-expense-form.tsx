"use client";
/**
 * Formulaire de note de frais — version simplifiée.
 *
 * Ce que ça change vs. l'ancienne version :
 *  - Un seul champ montant : "Montant TVAC" (le HT/TVA est déduit côté
 *    serveur via lib/expense-vat.ts avec le taux par catégorie).
 *  - Rattachement unifié : radio Mission / Projet / Centre de coût
 *    (mutuellement exclusifs) au lieu du dropdown mission-only.
 *  - Si catégorie = MEAL, section dynamique pour lister les participants,
 *    en autocomplétant sur les Users internes + saisie libre pour les
 *    invités externes. Sérialisé en JSON via un champ hidden 'attendees'.
 *
 * L'OCR ticket auto-remplit toujours date/description/catégorie/montant.
 */
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, Loader2, X, UserPlus, Trash2 } from "lucide-react";
import {
  createExpenseReport,
  updateExpenseReport,
  ocrReceipt
} from "@/server/actions/expense-reports";
import { defaultVatRate } from "@/lib/expense-vat";

type Mission = { id: string; label: string };
type CostCenter = { id: string; label: string };
type InternalUser = { id: string; name: string };
type Attendee = { userId: string | null; name: string };

export type ExpenseEditData = {
  id: string;
  date: string;
  category: string;
  description: string;
  amountTtc: number;
  vatRate: number;
  missionId: string | null;
  projectId: string | null;
  costCenterId: string | null;
  attendees: Attendee[] | null;
  receiptUrl: string | null;
  notes: string | null;
};

type Attachment =
  | { type: "none" }
  | { type: "mission"; id: string }
  | { type: "project"; id: string }
  | { type: "costCenter"; id: string };

type Project = { id: string; label: string };

export function NewExpenseForm({
  missions,
  projects,
  costCenters,
  internalUsers,
  editing
}: {
  missions: Mission[];
  projects: Project[];
  costCenters: CostCenter[];
  internalUsers: InternalUser[];
  editing?: ExpenseEditData | null;
}) {
  const router = useRouter();
  const isEdit = !!editing;
  const [pending, start] = useTransition();
  const [ocrPending, setOcrPending] = useState(false);
  const [receiptDataUri, setReceiptDataUri] = useState<string | null>(
    editing?.receiptUrl ?? null
  );

  // Rattachement initial : on reconstitue depuis les 3 IDs possibles.
  const initialAttachment: Attachment =
    editing?.missionId
      ? { type: "mission", id: editing.missionId }
      : editing?.projectId
        ? { type: "project", id: editing.projectId }
        : editing?.costCenterId
          ? { type: "costCenter", id: editing.costCenterId }
          : { type: "none" };
  const [attachment, setAttachment] = useState<Attachment>(initialAttachment);

  const [form, setForm] = useState({
    date: editing?.date ?? new Date().toISOString().slice(0, 10),
    category: editing?.category ?? "OTHER",
    description: editing?.description ?? "",
    amountTtc: editing ? String(editing.amountTtc) : "",
    vatRate: editing ? String(editing.vatRate) : "",
    // Si vatRate vide → le serveur applique le taux par catégorie
    notes: editing?.notes ?? ""
  });

  const [attendees, setAttendees] = useState<Attendee[]>(
    editing?.attendees ?? []
  );

  const isMeal = form.category === "MEAL";
  const effectiveVatRate = form.vatRate
    ? Number(form.vatRate)
    : defaultVatRate(form.category);
  const previewHt = Number(form.amountTtc || 0) / (1 + effectiveVatRate / 100);
  const previewVat = Number(form.amountTtc || 0) - previewHt;

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
      setOcrPending(true);
      const result = await ocrReceipt(dataUri);
      setOcrPending(false);
      if (!result.ok) {
        toast.warning(`OCR indisponible : ${result.error}. Remplis à la main.`);
        return;
      }
      const d = result.data!;
      setForm((f) => ({
        ...f,
        date: d.date ?? f.date,
        // On priorise TTC ; si l'OCR n'a que le HT, on additionne la TVA.
        amountTtc:
          d.amountTtc != null
            ? String(d.amountTtc.toFixed(2))
            : d.amountHt != null && d.vatRate != null
              ? String((d.amountHt * (1 + d.vatRate / 100)).toFixed(2))
              : f.amountTtc,
        vatRate: d.vatRate != null ? String(d.vatRate) : f.vatRate,
        description: d.description ?? (d.vendor ? `Frais chez ${d.vendor}` : f.description),
        category: d.category ?? f.category
      }));
      toast.success("Ticket scanné — vérifie les champs avant de soumettre");
    };
    reader.readAsDataURL(file);
  }

  function addAttendee(a: Attendee) {
    // Évite doublons : par userId ou par nom insensible casse
    const exists = attendees.some((x) =>
      a.userId ? x.userId === a.userId : x.name.toLowerCase() === a.name.toLowerCase()
    );
    if (exists) return;
    setAttendees([...attendees, a]);
  }

  function removeAttendee(idx: number) {
    setAttendees(attendees.filter((_, i) => i !== idx));
  }

  function submit(fd: FormData) {
    // Validation client — on rejette localement AVANT d'envoyer pour donner
    // un feedback immédiat. Le serveur revalidera de toute façon.
    if (!receiptDataUri) {
      toast.error("Ticket / justificatif obligatoire — uploade une photo ou un PDF.");
      return;
    }
    if (attachment.type === "none") {
      toast.error("Rattachement obligatoire : choisis une mission, un projet ou un centre de coût.");
      return;
    }
    if (isMeal && attendees.length === 0) {
      toast.error("Repas : ajoute au moins un participant (interne ou externe).");
      return;
    }
    if (!form.notes.trim()) {
      toast.error("Notes / commentaire obligatoires.");
      return;
    }
    // Sérialise attendees en JSON pour le server action
    if (isMeal && attendees.length > 0) {
      fd.set("attendees", JSON.stringify(attendees));
    } else {
      fd.delete("attendees");
    }
    // Rattachement — on n'envoie QUE l'ID correspondant au type choisi
    fd.delete("missionId");
    fd.delete("projectId");
    fd.delete("costCenterId");
    if (attachment.type === "mission")    fd.set("missionId", attachment.id);
    if (attachment.type === "project")    fd.set("projectId", attachment.id);
    if (attachment.type === "costCenter") fd.set("costCenterId", attachment.id);
    if (receiptDataUri) fd.set("receiptUrl", receiptDataUri);
    // Si l'utilisateur n'a rien saisi comme override, on n'envoie pas
    // vatRate → le serveur appliquera le taux par catégorie.
    if (!form.vatRate) fd.delete("vatRate");

    start(async () => {
      try {
        if (isEdit && editing) {
          await updateExpenseReport(editing.id, fd);
          toast.success("Note modifiée");
          router.replace("/expenses");
        } else {
          await createExpenseReport(fd);
          toast.success("Note de frais créée (brouillon)");
          setForm({
            date: new Date().toISOString().slice(0, 10),
            category: "OTHER",
            description: "",
            amountTtc: "",
            vatRate: "",
            notes: ""
          });
          setReceiptDataUri(null);
          setAttachment({ type: "none" });
          setAttendees([]);
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
      {/* ── Colonne 1 — Photo + OCR ── */}
      <div>
        <label className="label">
          Ticket / facture <span className="text-red-600">*</span>
        </label>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-midnight-300 rounded-lg p-6 cursor-pointer hover:border-indigoaccent transition-colors min-h-[220px]">
          {ocrPending ? (
            <div className="flex flex-col items-center gap-2 text-indigoaccent">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Claude lit le ticket...</span>
            </div>
          ) : receiptDataUri ? (
            <img src={receiptDataUri} alt="" className="max-h-56 rounded shadow" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-midnight-500">
              <Upload className="w-8 h-8" />
              <span className="text-sm">Clique pour choisir une photo</span>
              <span className="text-[11px]">
                PNG/JPG/WebP, max 4MB. <Sparkles className="w-3 h-3 inline" /> OCR auto
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

      {/* ── Colonne 2 — Champs ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date <span className="text-red-600">*</span></label>
            <input
              name="date" type="date" required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Catégorie <span className="text-red-600">*</span></label>
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
          <label className="label">Description <span className="text-red-600">*</span></label>
          <input
            name="description" required maxLength={500}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
            placeholder="ex: Repas client chez XYZ"
          />
        </div>

        {/* Montant TTC — champ unique. HT et TVA calculés en dessous. */}
        <div>
          <label className="label">Montant TVAC (€) <span className="text-red-600">*</span></label>
          <input
            name="amountTtc" type="number" step="0.01" required
            value={form.amountTtc}
            onChange={(e) => setForm({ ...form, amountTtc: e.target.value })}
            className="input text-lg font-semibold"
            placeholder="0.00"
          />
          <div className="mt-1 text-[11px] text-midnight-500 flex items-center justify-between">
            <span>
              TVA {effectiveVatRate}% par défaut ({categoryLabel(form.category)})
            </span>
            {Number(form.amountTtc) > 0 && (
              <span className="tabular-nums">
                HT : {previewHt.toFixed(2)} € · TVA : {previewVat.toFixed(2)} €
              </span>
            )}
          </div>
        </div>

        <details className="text-xs">
          <summary className="text-midnight-500 cursor-pointer select-none">
            Override du taux TVA
          </summary>
          <div className="mt-2">
            <input
              name="vatRate" type="number" step="0.01" min="0" max="50"
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
              className="input text-sm"
              placeholder={`Défaut : ${defaultVatRate(form.category)}%`}
            />
          </div>
        </details>

        {/* ── Rattachement — 3 options mutuellement exclusives ── */}
        <div>
          <label className="label">Rattacher à <span className="text-red-600">*</span></label>
          <select
            value={
              attachment.type === "none"
                ? ""
                : `${attachment.type}:${attachment.id}`
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) { setAttachment({ type: "none" }); return; }
              const [type, ...rest] = v.split(":");
              const id = rest.join(":");
              if (type === "mission")    setAttachment({ type: "mission", id });
              if (type === "project")    setAttachment({ type: "project", id });
              if (type === "costCenter") setAttachment({ type: "costCenter", id });
            }}
            className="input"
          >
            <option value="">— Aucun rattachement —</option>
            {missions.length > 0 && (
              <optgroup label="Missions">
                {missions.map((m) => (
                  <option key={m.id} value={`mission:${m.id}`}>{m.label}</option>
                ))}
              </optgroup>
            )}
            {projects.length > 0 && (
              <optgroup label="Projets">
                {projects.map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>{p.label}</option>
                ))}
              </optgroup>
            )}
            {costCenters.length > 0 && (
              <optgroup label="Centres de coût">
                {costCenters.map((c) => (
                  <option key={c.id} value={`costCenter:${c.id}`}>{c.label}</option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="text-[11px] text-midnight-500 mt-1">
            Un seul rattachement à la fois — mission (refacturable client),
            projet, ou centre de coût interne (SALES, LEAVE, MTG…).
          </p>
        </div>

        {/* ── Participants (uniquement si repas) ── */}
        {isMeal && (
          <AttendeesBlock
            attendees={attendees}
            internalUsers={internalUsers}
            onAdd={addAttendee}
            onRemove={removeAttendee}
          />
        )}

        {/* ── Notes / commentaire (obligatoire) ── */}
        <div>
          <label className="label">
            Notes / commentaire <span className="text-red-600">*</span>
          </label>
          <textarea
            name="notes"
            required
            maxLength={1000}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input"
            placeholder="Contexte de la dépense pour le comptable (ex: déjeuner de négociation avec X, formation technique Y…)"
          />
        </div>

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <button
              type="button" onClick={cancelEdit}
              className="btn-secondary" disabled={pending}
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

// ─────────────────────────────────────────────────────────────
// Bloc participants — autocomplete sur users internes + saisie libre externe

function AttendeesBlock({
  attendees, internalUsers, onAdd, onRemove
}: {
  attendees: Attendee[];
  internalUsers: InternalUser[];
  onAdd: (a: Attendee) => void;
  onRemove: (idx: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const q = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!q) return [];
    return internalUsers
      .filter((u) => u.name.toLowerCase().includes(q))
      .filter((u) => !attendees.some((a) => a.userId === u.id))
      .slice(0, 6);
  }, [q, internalUsers, attendees]);

  function pickInternal(u: InternalUser) {
    onAdd({ userId: u.id, name: u.name });
    setQuery("");
    setShowSuggestions(false);
  }

  function addExternal() {
    const name = query.trim();
    if (!name) return;
    onAdd({ userId: null, name });
    setQuery("");
    setShowSuggestions(false);
  }

  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <UserPlus className="w-4 h-4" /> Participants du repas
      </div>
      <p className="text-[11px] text-amber-800">
        Indique qui était présent (collègue ou externe). Utile pour justifier
        les frais de représentation à la comptabilité.
      </p>

      {/* Liste courante */}
      {attendees.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {attendees.map((a, i) => (
            <li
              key={i}
              className={
                "text-xs px-2 py-1 rounded flex items-center gap-1 " +
                (a.userId
                  ? "bg-indigoaccent/15 text-indigoaccent"
                  : "bg-midnight-100 text-midnight-700")
              }
            >
              {a.userId && <span className="text-[9px] opacity-70">interne</span>}
              <span>{a.name}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="hover:text-red-600"
                aria-label="Retirer"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Saisie */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addExternal(); }
          }}
          placeholder="Ajouter un participant (interne ou externe)…"
          className="input text-sm"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-midnight-200 rounded shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => pickInternal(u)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-midnight-50 flex items-center justify-between"
                >
                  <span>{u.name}</span>
                  <span className="text-[10px] text-indigoaccent">interne</span>
                </button>
              </li>
            ))}
            {q && (
              <li>
                <button
                  type="button"
                  onClick={addExternal}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-midnight-50 text-midnight-500 italic border-t border-midnight-100"
                >
                  Ajouter « {query.trim()} » comme externe
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function categoryLabel(cat: string): string {
  const m: Record<string, string> = {
    TRANSPORT: "transport", MEAL: "repas", ACCOMMODATION: "hébergement",
    SUPPLIES: "fournitures", SOFTWARE: "logiciel", TRAINING: "formation",
    OTHER: "autre"
  };
  return m[cat] ?? cat.toLowerCase();
}
