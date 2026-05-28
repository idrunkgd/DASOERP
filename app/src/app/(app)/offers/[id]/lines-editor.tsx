"use client";
import { useState, useTransition } from "react";
import { addServiceLine, addOtherLine, updateServiceLine, updateOtherLine, deleteLine } from "@/server/actions/offers";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { computeOfferLineTotals } from "@/lib/calc";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

type Line = {
  id: string; type: string; description: string;
  profileId?: string | null;
  quantity: string | number; unit: string;
  unitSellPrice: string | number; unitCost: string | number;
  discountPct: string | number; marginPctInput?: string | number | null;
  totalSell: string | number; totalCost: string | number; marginAmount: string | number; marginPct: string | number;
};

type Profile = { id: string; name: string; hourlyCost: any; dailyCost: any; hourlySell: any; dailySell: any };

export function OfferLinesEditor({ offerId, lines, profiles, readOnly = false }: { offerId: string; lines: Line[]; profiles: Profile[]; readOnly?: boolean }) {
  const services = lines.filter(l => l.type === "SERVICE");
  const others = lines.filter(l => l.type !== "SERVICE");
  return (
    <>
      <ServicesTable offerId={offerId} lines={services} profiles={profiles} readOnly={readOnly} />
      <OthersTable offerId={offerId} lines={others} readOnly={readOnly} />
    </>
  );
}

// =============================================================
// SERVICES — basé sur ServiceProfile, pas de marge à saisir
// =============================================================
function ServicesTable({ offerId, lines, profiles, readOnly }: { offerId: string; lines: Line[]; profiles: Profile[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Services</h2>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Description</th>
            <th>Profil</th>
            <th className="text-right">Qté</th>
            <th>Unité</th>
            <th className="text-right">PU vente</th>
            <th className="text-right">PU coût</th>
            <th className="text-right">Total HT</th>
            <th className="text-right">Coût total</th>
            <th className="text-right">Marge %</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {lines.map(l => <ServiceRow key={l.id} line={l} profiles={profiles} readOnly={readOnly} />)}
            {!readOnly && <NewServiceRow offerId={offerId} profiles={profiles} pending={pending} start={start} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceRow({ line, profiles, readOnly }: { line: Line; profiles: Profile[]; readOnly?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Supprimer la prestation « ${line.description} » ?`)) return;
    start(async () => {
      try {
        await deleteLine(line.id);
        toast.success("Prestation supprimée — tranches en % recalculées");
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  }
  if (!edit) {
    return (
      <tr onDoubleClick={() => !readOnly && setEdit(true)} className={readOnly ? "" : "cursor-pointer"}>
        <td className="font-medium">{line.description}</td>
        <td className="text-xs text-midnight-700">{profiles.find(p => p.id === line.profileId)?.name ?? "—"}</td>
        <td className="text-right tabular-nums">{Number(line.quantity)}</td>
        <td>{line.unit}</td>
        <td className="text-right tabular-nums">{formatCurrency(line.unitSellPrice)}</td>
        <td className="text-right tabular-nums">{formatCurrency(line.unitCost)}</td>
        <td className="text-right tabular-nums font-medium">{formatCurrency(line.totalSell)}</td>
        <td className="text-right tabular-nums text-midnight-500">{formatCurrency(line.totalCost)}</td>
        <td className="text-right tabular-nums">{formatPercent(line.marginPct)}</td>
        <td className="text-right">
          {!readOnly && (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEdit(true)} className="text-xs text-indigoaccent hover:underline">Éditer</button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="text-midnight-400 hover:text-red-600 disabled:opacity-50"
                title="Supprimer la ligne"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }
  return (
    <ServiceEditRow
      line={line}
      profiles={profiles}
      onCancel={() => setEdit(false)}
      onSubmit={(fd) => start(async () => {
        try { await updateServiceLine(line.id, fd); setEdit(false); toast.success("Ligne mise à jour"); }
        catch (e: any) { toast.error(e.message); }
      })}
      onDelete={() => { if (window.confirm("Supprimer ?")) start(async () => { await deleteLine(line.id); }); }}
      pending={pending}
    />
  );
}

function ServiceEditRow({ line, profiles, onSubmit, onCancel, onDelete, pending }: any) {
  const initialProfile = profiles.find((p: any) => p.id === line?.profileId);
  return (
    <tr className="bg-midnight-50/40">
      <td colSpan={10}>
        <form action={onSubmit} className="grid grid-cols-12 gap-2 items-end">
          <input name="description" defaultValue={line?.description ?? ""} placeholder="Description" required className="input col-span-3" />
          <select
            name="profileId" defaultValue={line?.profileId ?? ""} required
            className="input col-span-3"
            onChange={(e) => {
              const p = profiles.find((x: any) => x.id === e.target.value);
              if (!p) return;
              const form = e.currentTarget.form!;
              const unit = (form.elements.namedItem("unit") as HTMLSelectElement).value;
              (form.elements.namedItem("unitSellPrice") as HTMLInputElement).value = String(unit === "hour" ? Number(p.hourlySell) : Number(p.dailySell));
              (form.elements.namedItem("unitCost") as HTMLInputElement).value = String(unit === "hour" ? Number(p.hourlyCost) : Number(p.dailyCost));
            }}
          >
            <option value="">— Choisir un profil —</option>
            {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="quantity" type="number" step="0.5" defaultValue={String(line?.quantity ?? 1)} className="input col-span-1" required />
          <select name="unit" defaultValue={line?.unit ?? "day"} className="input col-span-1">
            <option value="day">jour</option><option value="hour">heure</option>
          </select>
          <input name="unitSellPrice" type="number" step="0.01" defaultValue={String(line?.unitSellPrice ?? initialProfile?.dailySell ?? 0)} className="input col-span-1" required />
          <input name="unitCost" type="number" step="0.01" defaultValue={String(line?.unitCost ?? initialProfile?.dailyCost ?? 0)} className="input col-span-1" required />
          <input name="discountPct" type="number" step="0.5" defaultValue={String(line?.discountPct ?? 0)} placeholder="Rem%" className="input col-span-1" />
          <div className="col-span-1 flex gap-1">
            <button disabled={pending} className="btn-primary btn-sm">OK</button>
            {onCancel && <button type="button" onClick={onCancel} className="btn-ghost btn-sm">×</button>}
            {onDelete && <button type="button" onClick={onDelete} className="btn-danger btn-sm"><Trash2 className="w-3 h-3" /></button>}
          </div>
        </form>
      </td>
    </tr>
  );
}

function NewServiceRow({ offerId, profiles, pending, start }: { offerId: string; profiles: Profile[]; pending: boolean; start: React.TransitionStartFunction }) {
  return (
    <ServiceEditRow
      profiles={profiles}
      onSubmit={(fd: FormData) => start(async () => {
        try { await addServiceLine(offerId, fd); document.querySelectorAll('form').forEach(f => (f as HTMLFormElement).reset()); toast.success("Ligne ajoutée"); }
        catch (e: any) { toast.error(e.message); }
      })}
      pending={pending}
    />
  );
}

// =============================================================
// AUTRES — pas de type prédéfini, marge directe en %
// =============================================================
function OthersTable({ offerId, lines, readOnly }: { offerId: string; lines: Line[]; readOnly: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Autres postes (matériel, licences, sous-traitance, frais…)</h2>
      <p className="text-[11px] text-midnight-500 mb-3">
        Saisis le <b>prix d'achat</b> et la <b>marge attendue (%)</b>. Le prix de vente client est calculé automatiquement.
      </p>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr>
            <th>Description</th>
            <th className="text-right">Qté</th><th>Unité</th>
            <th className="text-right">Prix achat</th>
            <th className="text-right">Marge %</th>
            <th className="text-right">PU vente</th>
            <th className="text-right">Total HT</th>
            <th className="text-right">Coût total</th>
            <th className="text-right">Marge €</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {lines.map(l => <OtherRow key={l.id} line={l} readOnly={readOnly} />)}
            {!readOnly && <NewOtherRow offerId={offerId} pending={pending} start={start} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OtherRow({ line, readOnly }: { line: Line; readOnly?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Supprimer le poste « ${line.description} » ?`)) return;
    start(async () => {
      try {
        await deleteLine(line.id);
        toast.success("Ligne supprimée — tranches en % recalculées");
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  }
  if (!edit) {
    return (
      <tr onDoubleClick={() => !readOnly && setEdit(true)} className={readOnly ? "" : "cursor-pointer"}>
        <td className="font-medium">{line.description}</td>
        <td className="text-right tabular-nums">{Number(line.quantity)}</td>
        <td>{line.unit}</td>
        <td className="text-right tabular-nums text-midnight-700">{formatCurrency(line.unitCost)}</td>
        <td className="text-right tabular-nums">{Number(line.marginPctInput ?? 0).toFixed(1)}%</td>
        <td className="text-right tabular-nums">{formatCurrency(line.unitSellPrice)}</td>
        <td className="text-right tabular-nums font-medium">{formatCurrency(line.totalSell)}</td>
        <td className="text-right tabular-nums text-midnight-500">{formatCurrency(line.totalCost)}</td>
        <td className="text-right tabular-nums">{formatCurrency(line.marginAmount)}</td>
        <td className="text-right">
          {!readOnly && (
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEdit(true)} className="text-xs text-indigoaccent hover:underline">Éditer</button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="text-midnight-400 hover:text-red-600 disabled:opacity-50"
                title="Supprimer la ligne"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  }
  return (
    <OtherEditRow
      line={line}
      onCancel={() => setEdit(false)}
      onSubmit={(fd: FormData) => start(async () => {
        try { await updateOtherLine(line.id, fd); setEdit(false); toast.success("Ligne mise à jour"); }
        catch (e: any) { toast.error(e.message); }
      })}
      onDelete={() => { if (window.confirm("Supprimer ?")) start(async () => { await deleteLine(line.id); }); }}
      pending={pending}
    />
  );
}

function OtherEditRow({ line, onSubmit, onCancel, onDelete, pending }: any) {
  const [cost, setCost] = useState<string>(String(line?.unitCost ?? ""));
  const [margin, setMargin] = useState<string>(String(line?.marginPctInput ?? 20));
  const sell = (() => {
    const c = Number(cost || 0);
    const m = Number(margin || 0);
    if (c > 0 && m >= 0 && m < 100) {
      return Math.round((c / (1 - m / 100)) * 100) / 100;
    }
    return 0;
  })();
  return (
    <tr className="bg-midnight-50/40">
      <td colSpan={10}>
        <form action={onSubmit} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="label text-[10px]">Description</label>
            <input name="description" defaultValue={line?.description ?? ""} placeholder="ex: Licence Office 365" required className="input" />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Qté</label>
            <input name="quantity" type="number" step="0.5" defaultValue={String(line?.quantity ?? 1)} required className="input" />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Unité</label>
            <input name="unit" defaultValue={line?.unit ?? "unit"} className="input" />
          </div>
          <div className="col-span-2">
            <label className="label text-[10px]">Prix achat HT</label>
            <input
              name="unitCost" type="number" step="0.01"
              value={cost} onChange={(e) => setCost(e.target.value)}
              required className="input" placeholder="0,00"
            />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">Marge %</label>
            <input
              name="marginPctInput" type="number" step="0.5"
              value={margin} onChange={(e) => setMargin(e.target.value)}
              className="input" placeholder="20"
            />
          </div>
          <div className="col-span-1">
            <label className="label text-[10px]">PU vente</label>
            <input
              type="text" readOnly value={sell > 0 ? sell.toFixed(2) : "—"}
              className="input bg-emerald-50 text-emerald-800 font-medium"
              tabIndex={-1}
            />
          </div>
          {/* Hidden discountPct (rarement utilisé sur OTHER) */}
          <input type="hidden" name="discountPct" value={String(line?.discountPct ?? 0)} />
          <div className="col-span-2 flex gap-1 justify-end">
            <button disabled={pending} className="btn-primary btn-sm">OK</button>
            {onCancel && <button type="button" onClick={onCancel} className="btn-ghost btn-sm">×</button>}
            {onDelete && <button type="button" onClick={onDelete} className="btn-danger btn-sm"><Trash2 className="w-3 h-3" /></button>}
          </div>
        </form>
      </td>
    </tr>
  );
}

function NewOtherRow({ offerId, pending, start }: { offerId: string; pending: boolean; start: React.TransitionStartFunction }) {
  return (
    <OtherEditRow
      onSubmit={(fd: FormData) => start(async () => {
        try { await addOtherLine(offerId, fd); document.querySelectorAll('form').forEach(f => (f as HTMLFormElement).reset()); toast.success("Ligne ajoutée"); }
        catch (e: any) { toast.error(e.message); }
      })}
      pending={pending}
    />
  );
}
