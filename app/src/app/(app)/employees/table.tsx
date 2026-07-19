"use client";
/**
 * Table des employés avec édition inline. Le formulaire d'ajout se déplie
 * en cliquant sur "+ Ajouter", et chaque ligne peut passer en mode édition
 * via l'icône crayon. Suppression via poubelle.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createEmployee, updateEmployee, deleteEmployee
} from "@/server/actions/payroll-employees";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Loader2, Save, Trash2, Edit3, X } from "lucide-react";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  startDate: string;
  endDate: string | null;
  monthlyNetPay: number;
  monthlyWithholdingTax: number;
  monthlyOnss: number;
  monthlyGrossReference: number | null;
  monthsPerYear: number;
  notes: string | null;
};

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3">
          <Plus className="w-4 h-4" /> Ajouter un employé
        </button>
      ) : (
        <EmployeeForm onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      )}

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th><th>Rôle</th>
              <th>Entrée</th><th>Sortie</th>
              <th className="text-right">Net / mois</th>
              <th className="text-right">Précompte</th>
              <th className="text-right">ONSS</th>
              <th className="text-right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-midnight-500 py-6">
                  Aucun employé enregistré. Utilise « Ajouter » ci-dessus.
                </td>
              </tr>
            )}
            {employees.map((e) => editingId === e.id ? (
              <tr key={e.id}>
                <td colSpan={9} className="p-0">
                  <EmployeeForm employee={e} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
                </td>
              </tr>
            ) : (
              <Row key={e.id} e={e} onEdit={() => setEditingId(e.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ e, onEdit }: { e: Employee; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const total = e.monthlyNetPay + e.monthlyWithholdingTax + e.monthlyOnss;
  const isGone = e.endDate && new Date(e.endDate) < new Date();
  return (
    <tr className={isGone ? "opacity-50" : ""}>
      <td>
        <div className="font-medium">{e.firstName} {e.lastName}</div>
        {e.notes && <div className="text-xs text-midnight-500 truncate max-w-[200px]">{e.notes}</div>}
      </td>
      <td className="text-sm">{e.role ?? "—"}</td>
      <td className="text-xs">{formatDate(e.startDate)}</td>
      <td className="text-xs">{e.endDate ? formatDate(e.endDate) : <span className="text-emerald-700">en poste</span>}</td>
      <td className="text-right tabular-nums">{formatCurrency(e.monthlyNetPay)}</td>
      <td className="text-right tabular-nums">{formatCurrency(e.monthlyWithholdingTax)}</td>
      <td className="text-right tabular-nums">{formatCurrency(e.monthlyOnss)}</td>
      <td className="text-right tabular-nums font-semibold">{formatCurrency(total)}</td>
      <td className="text-right">
        <div className="flex gap-1 justify-end">
          <button onClick={onEdit} className="text-midnight-500 hover:text-midnight-900">
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm(`Supprimer ${e.firstName} ${e.lastName} ?`)) return;
              start(async () => {
                try { await deleteEmployee(e.id); toast.success("Supprimé"); }
                catch (e: any) { toast.error(e?.message ?? "Erreur"); }
              });
            }}
            className="text-midnight-500 hover:text-red-600"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

function EmployeeForm({
  employee, onDone, onCancel
}: {
  employee?: Employee;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        if (employee) await updateEmployee(employee.id, fd);
        else await createEmployee(fd);
        toast.success(employee ? "Modifié" : "Ajouté");
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  return (
    <form onSubmit={submit} className="card p-4 border-2 border-indigoaccent mb-3 space-y-3">
      <h3 className="font-semibold">{employee ? "Modifier l'employé" : "Nouvel employé"}</h3>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="label">Prénom *</label>
          <input name="firstName" required defaultValue={employee?.firstName ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Nom *</label>
          <input name="lastName" required defaultValue={employee?.lastName ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Rôle</label>
          <input name="role" defaultValue={employee?.role ?? ""} className="input" placeholder="ex. Sourceuse, Consultant Data" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Date d'entrée *</label>
          <input type="date" name="startDate" required defaultValue={employee?.startDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Date de sortie (facultatif)</label>
          <input type="date" name="endDate" defaultValue={employee?.endDate ?? ""} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label">Salaire net / mois (€)</label>
          <input type="number" step="0.01" name="monthlyNetPay" required defaultValue={employee?.monthlyNetPay ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Précompte / mois (€)</label>
          <input type="number" step="0.01" name="monthlyWithholdingTax" required defaultValue={employee?.monthlyWithholdingTax ?? ""} className="input" />
        </div>
        <div>
          <label className="label">ONSS / mois (€)</label>
          <input type="number" step="0.01" name="monthlyOnss" required defaultValue={employee?.monthlyOnss ?? ""} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Brut de référence (facultatif)</label>
          <input type="number" step="0.01" name="monthlyGrossReference" defaultValue={employee?.monthlyGrossReference ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Mois versés / an</label>
          <input type="number" step="0.01" name="monthsPerYear" defaultValue={employee?.monthsPerYear ?? 13.92} className="input" />
        </div>
      </div>

      <textarea name="notes" rows={2} defaultValue={employee?.notes ?? ""} className="input" placeholder="Notes (voiture, avantages...)" />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          <X className="w-4 h-4" /> Annuler
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {employee ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
