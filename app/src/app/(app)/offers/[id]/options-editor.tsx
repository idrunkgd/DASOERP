"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  addOfferOption,
  updateOfferOption,
  deleteOfferOption,
  addOptionServiceLine,
  addOptionOtherLine,
  updateServiceLine,
  updateOtherLine,
  deleteLine
} from "@/server/actions/offers";

type Profile = { id: string; name: string; hourlyCost: any; dailyCost: any; hourlySell: any; dailySell: any };
type Line = {
  id: string;
  type: string;
  description: string;
  profileId?: string | null;
  quantity: string | number;
  unit: string;
  unitSellPrice: string | number;
  unitCost: string | number;
  marginPctInput?: string | number | null;
  totalSell: string | number;
  totalCost: string | number;
};

type Option = {
  id: string;
  name: string;
  description: string | null;
  totalSell: number | string;
  totalCost: number | string;
  lines: Line[];
};

export function OptionsEditor({
  offerId,
  options,
  profiles,
  readOnly = false
}: {
  offerId: string;
  options: Option[];
  profiles: Profile[];
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    start(async () => {
      try {
        await addOfferOption(offerId, fd);
        toast.success("Option ajoutée");
        setNewOpen(false);
        setName("");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">Options du devis</h2>
          <p className="text-[11px] text-midnight-500 mt-0.5">
            Blocs proposés en supplément. Affichés en page 2bis du PDF, séparés du total principal.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setNewOpen((o) => !o)}
            className="btn-secondary text-sm"
            disabled={pending}
          >
            <Plus className="w-4 h-4" />
            Nouvelle option
          </button>
        )}
      </div>

      {newOpen && (
        <form onSubmit={handleCreate} className="border-b border-border pb-3 mb-3 flex gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de l'option (ex: Hébergement 1 an)"
            className="input flex-1"
            autoFocus
            required
          />
          <button className="btn-primary btn-sm" disabled={pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
          </button>
          <button
            type="button"
            onClick={() => {
              setNewOpen(false);
              setName("");
            }}
            className="btn-ghost btn-sm"
          >
            ×
          </button>
        </form>
      )}

      {options.length === 0 ? (
        <p className="text-sm text-midnight-500">
          Aucune option pour ce devis.{" "}
          {!readOnly && "Ajoute une option pour proposer un supplément au client."}
        </p>
      ) : (
        <div className="space-y-3">
          {options.map((opt) => (
            <OptionBlock
              key={opt.id}
              option={opt}
              profiles={profiles}
              readOnly={readOnly}
              pending={pending}
              startTransition={start}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OptionBlock({
  option,
  profiles,
  readOnly,
  pending,
  startTransition
}: {
  option: Option;
  profiles: Profile[];
  readOnly: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(option.name);
  const [addType, setAddType] = useState<"service" | "other" | null>(null);

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameValue.trim()) return;
    const fd = new FormData();
    fd.set("name", renameValue);
    startTransition(async () => {
      try {
        await updateOfferOption(option.id, fd);
        toast.success("Option renommée");
        setRenaming(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer l'option « ${option.name} » et toutes ses lignes ?`)) return;
    startTransition(async () => {
      try {
        await deleteOfferOption(option.id);
        toast.success("Option supprimée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function handleDeleteLine(lineId: string) {
    if (!confirm("Supprimer cette ligne ?")) return;
    startTransition(async () => {
      try {
        await deleteLine(lineId);
        toast.success("Ligne supprimée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="border border-midnight-200 rounded-lg">
      {/* Header de l'option */}
      <div className="flex items-center justify-between px-3 py-2 bg-midnight-50 rounded-t-lg">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-midnight-600 hover:text-midnight-900"
            type="button"
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {renaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2 flex-1">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="input h-7 text-sm flex-1"
                autoFocus
                required
              />
              <button className="btn-primary btn-sm">OK</button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setRenameValue(option.name);
                }}
                className="btn-ghost btn-sm"
              >
                ×
              </button>
            </form>
          ) : (
            <span className="font-medium text-sm">{option.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums font-semibold text-indigoaccent">
            {formatCurrency(option.totalSell)}
          </span>
          {!readOnly && !renaming && (
            <>
              <button
                onClick={() => setRenaming(true)}
                className="text-midnight-500 hover:text-midnight-900"
                title="Renommer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                className="text-midnight-400 hover:text-red-600"
                title="Supprimer l'option"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-2">
          {/* Lignes existantes */}
          {option.lines.length === 0 ? (
            <p className="text-xs text-midnight-500 italic">Aucune ligne dans cette option.</p>
          ) : (
            <table className="table-base text-xs">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">PU vente</th>
                  <th className="text-right">Total HT</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {option.lines.map((l) => (
                  <OptionLineRow
                    key={l.id}
                    line={l}
                    profiles={profiles}
                    readOnly={readOnly}
                    pending={pending}
                    startTransition={startTransition}
                    onDelete={() => handleDeleteLine(l.id)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Boutons ajout ligne */}
          {!readOnly && (
            <div className="flex gap-2 pt-2 border-t border-midnight-100">
              <button
                onClick={() => setAddType(addType === "service" ? null : "service")}
                className="btn-ghost btn-sm text-xs"
              >
                <Plus className="w-3 h-3" />
                Service
              </button>
              <button
                onClick={() => setAddType(addType === "other" ? null : "other")}
                className="btn-ghost btn-sm text-xs"
              >
                <Plus className="w-3 h-3" />
                Matériel
              </button>
            </div>
          )}

          {addType === "service" && (
            <NewOptionServiceForm
              optionId={option.id}
              profiles={profiles}
              onDone={() => setAddType(null)}
              startTransition={startTransition}
            />
          )}
          {addType === "other" && (
            <NewOptionOtherForm
              optionId={option.id}
              onDone={() => setAddType(null)}
              startTransition={startTransition}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ligne d'option : affichage en lecture par défaut, double-clic ou bouton "Éditer"
 * pour passer en mode édition inline. Dispatch entre form service ou form matériel
 * selon le type de la ligne.
 */
function OptionLineRow({
  line,
  profiles,
  readOnly,
  pending,
  startTransition,
  onDelete
}: {
  line: Line;
  profiles: Profile[];
  readOnly: boolean;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false);

  if (edit) {
    if (line.type === "SERVICE") {
      return (
        <EditOptionServiceForm
          line={line}
          profiles={profiles}
          onDone={() => setEdit(false)}
          startTransition={startTransition}
        />
      );
    }
    return (
      <EditOptionOtherForm
        line={line}
        onDone={() => setEdit(false)}
        startTransition={startTransition}
      />
    );
  }

  return (
    <tr onDoubleClick={() => !readOnly && setEdit(true)} className={readOnly ? "" : "cursor-pointer"}>
      <td>
        <span className={line.type === "SERVICE" ? "badge-info" : "badge-warning"}>
          {line.type === "SERVICE" ? "Service" : "Matériel"}
        </span>
      </td>
      <td className="font-medium">{line.description}</td>
      <td className="text-right tabular-nums">{Number(line.quantity)} {line.unit}</td>
      <td className="text-right tabular-nums">{formatCurrency(line.unitSellPrice)}</td>
      <td className="text-right tabular-nums font-medium">{formatCurrency(line.totalSell)}</td>
      <td>
        {!readOnly && (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => setEdit(true)}
              className="text-[10px] text-indigoaccent hover:underline"
              disabled={pending}
            >
              Éditer
            </button>
            <button
              onClick={onDelete}
              className="text-midnight-400 hover:text-red-600 p-0.5"
              disabled={pending}
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function EditOptionServiceForm({
  line,
  profiles,
  onDone,
  startTransition
}: {
  line: Line;
  profiles: Profile[];
  onDone: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await updateServiceLine(line.id, fd);
        toast.success("Ligne mise à jour");
        onDone();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <tr className="bg-midnight-50/40">
      <td colSpan={6}>
        <form action={submit} className="grid grid-cols-12 gap-2 items-end p-2">
          <div className="col-span-3">
            <label className="label text-[10px]">Description</label>
            <input name="description" defaultValue={line.description} required className="input text-xs" />
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">Profil</label>
            <select
              name="profileId"
              defaultValue={line.profileId ?? ""}
              required
              className="input text-xs"
            >
              <option value="">—</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Qté</label>
            <input name="quantity" type="number" step="0.5" defaultValue={String(line.quantity)} required className="input text-xs" />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Unité</label>
            <select name="unit" defaultValue={line.unit} className="input text-xs">
              <option value="day">jour</option>
              <option value="hour">heure</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">PU vente</label>
            <input name="unitSellPrice" type="number" step="0.01" defaultValue={String(line.unitSellPrice)} required className="input text-xs" />
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">PU coût</label>
            <input name="unitCost" type="number" step="0.01" defaultValue={String(line.unitCost)} required className="input text-xs" />
          </div>
          <input type="hidden" name="discountPct" value="0" />
          <div className="col-span-1 flex gap-1">
            <button className="btn-primary btn-sm">OK</button>
            <button type="button" onClick={onDone} className="btn-ghost btn-sm">×</button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EditOptionOtherForm({
  line,
  onDone,
  startTransition
}: {
  line: Line;
  onDone: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  const [cost, setCost] = useState(String(line.unitCost));
  const [margin, setMargin] = useState(String(line.marginPctInput ?? 20));
  const sell = (() => {
    const c = Number(cost || 0);
    const m = Number(margin || 0);
    if (c > 0 && m >= 0 && m < 100) return Math.round((c / (1 - m / 100)) * 100) / 100;
    return 0;
  })();
  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await updateOtherLine(line.id, fd);
        toast.success("Ligne mise à jour");
        onDone();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <tr className="bg-midnight-50/40">
      <td colSpan={6}>
        <form action={submit} className="grid grid-cols-12 gap-2 items-end p-2">
          <div className="col-span-4">
            <label className="label text-[10px]">Description</label>
            <input name="description" defaultValue={line.description} required className="input text-xs" />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Qté</label>
            <input name="quantity" type="number" step="0.5" defaultValue={String(line.quantity)} required className="input text-xs" />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Unité</label>
            <input name="unit" defaultValue={line.unit} className="input text-xs" />
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">Prix achat</label>
            <input
              name="unitCost"
              type="number"
              step="0.01"
              required
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="input text-xs"
            />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Marge %</label>
            <input
              name="marginPctInput"
              type="number"
              step="0.5"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="input text-xs"
            />
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">PU vente</label>
            <input
              type="text"
              readOnly
              value={sell > 0 ? sell.toFixed(2) : "—"}
              className="input text-xs bg-emerald-50 text-emerald-800 font-medium"
              tabIndex={-1}
            />
          </div>
          <input type="hidden" name="discountPct" value="0" />
          <div className="col-span-1 flex gap-1">
            <button className="btn-primary btn-sm">OK</button>
            <button type="button" onClick={onDone} className="btn-ghost btn-sm">×</button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function NewOptionServiceForm({
  optionId,
  profiles,
  onDone,
  startTransition
}: {
  optionId: string;
  profiles: Profile[];
  onDone: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await addOptionServiceLine(optionId, fd);
        toast.success("Ligne service ajoutée à l'option");
        onDone();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <form action={submit} className="grid grid-cols-12 gap-2 items-end p-2 bg-midnight-50/40 rounded">
      <div className="col-span-4">
        <label className="label text-[10px]">Description</label>
        <input name="description" required className="input text-xs" />
      </div>
      <div className="col-span-3">
        <label className="label text-[10px]">Profil</label>
        <select
          name="profileId"
          required
          className="input text-xs"
          onChange={(e) => {
            const p = profiles.find((x) => x.id === e.target.value);
            if (!p) return;
            const form = e.currentTarget.form!;
            const unit = (form.elements.namedItem("unit") as HTMLSelectElement).value;
            (form.elements.namedItem("unitSellPrice") as HTMLInputElement).value = String(unit === "hour" ? Number(p.hourlySell) : Number(p.dailySell));
            (form.elements.namedItem("unitCost") as HTMLInputElement).value = String(unit === "hour" ? Number(p.hourlyCost) : Number(p.dailyCost));
          }}
        >
          <option value="">—</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">Qté</label>
        <input name="quantity" type="number" step="0.5" defaultValue="1" required className="input text-xs" />
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">Unité</label>
        <select name="unit" defaultValue="day" className="input text-xs">
          <option value="day">jour</option>
          <option value="hour">heure</option>
        </select>
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">PU vente</label>
        <input name="unitSellPrice" type="number" step="0.01" required className="input text-xs" />
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">PU coût</label>
        <input name="unitCost" type="number" step="0.01" required className="input text-xs" />
      </div>
      <input type="hidden" name="discountPct" value="0" />
      <div className="col-span-1 flex gap-1">
        <button className="btn-primary btn-sm">OK</button>
      </div>
    </form>
  );
}

function NewOptionOtherForm({
  optionId,
  onDone,
  startTransition
}: {
  optionId: string;
  onDone: () => void;
  startTransition: React.TransitionStartFunction;
}) {
  const [cost, setCost] = useState("");
  const [margin, setMargin] = useState("20");
  const sell = (() => {
    const c = Number(cost || 0);
    const m = Number(margin || 0);
    if (c > 0 && m >= 0 && m < 100) return Math.round((c / (1 - m / 100)) * 100) / 100;
    return 0;
  })();
  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await addOptionOtherLine(optionId, fd);
        toast.success("Ligne matériel ajoutée à l'option");
        onDone();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <form action={submit} className="grid grid-cols-12 gap-2 items-end p-2 bg-midnight-50/40 rounded">
      <div className="col-span-4">
        <label className="label text-[10px]">Description</label>
        <input name="description" required className="input text-xs" />
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">Qté</label>
        <input name="quantity" type="number" step="0.5" defaultValue="1" required className="input text-xs" />
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">Unité</label>
        <input name="unit" defaultValue="unit" className="input text-xs" />
      </div>
      <div className="col-span-2">
        <label className="label text-[10px]">Prix achat</label>
        <input
          name="unitCost"
          type="number"
          step="0.01"
          required
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="input text-xs"
        />
      </div>
      <div className="col-span-1">
        <label className="label text-[10px]">Marge %</label>
        <input
          name="marginPctInput"
          type="number"
          step="0.5"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          className="input text-xs"
        />
      </div>
      <div className="col-span-2">
        <label className="label text-[10px]">PU vente</label>
        <input
          type="text"
          readOnly
          value={sell > 0 ? sell.toFixed(2) : "—"}
          className="input text-xs bg-emerald-50 text-emerald-800 font-medium"
          tabIndex={-1}
        />
      </div>
      <input type="hidden" name="discountPct" value="0" />
      <div className="col-span-1 flex gap-1">
        <button className="btn-primary btn-sm">OK</button>
      </div>
    </form>
  );
}
