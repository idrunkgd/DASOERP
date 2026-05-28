"use client";
// Checklist interactive : on coche/décoche chaque item, on peut ajouter
// des items libres. Chaque toggle déclenche l'action serveur + revalidation.
import { useState, useTransition } from "react";
import { Plus, Trash2, X, ChevronDown } from "lucide-react";
import {
  toggleOnboardingItem,
  addOnboardingItem,
  deleteOnboardingItem
} from "@/server/actions/onboarding";

type Item = {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  dueDate: string | null;
  ownerName: string | null;
};

type GroupedItems = { category: string; items: Item[] };

const CATEGORY_COLORS: Record<string, string> = {
  Administratif: "bg-blue-50 border-blue-200 text-blue-900",
  IT: "bg-violet-50 border-violet-200 text-violet-900",
  Formation: "bg-amber-50 border-amber-200 text-amber-900",
  "Intégration équipe": "bg-emerald-50 border-emerald-200 text-emerald-900"
};

export function OnboardingChecklist({
  onboardingId,
  grouped,
  users
}: {
  onboardingId: string;
  grouped: GroupedItems[];
  users: { id: string; firstName: string; lastName: string }[];
}) {
  const [adding, setAdding] = useState<string | null>(null); // catégorie en cours d'ajout

  return (
    <div className="space-y-4">
      {grouped.map((g) => {
        const cat = g.category;
        const color = CATEGORY_COLORS[cat] ?? "bg-midnight-50 border-midnight-200 text-midnight-800";
        const total = g.items.length;
        const done = g.items.filter((i) => i.done).length;
        return (
          <div key={cat} className="card overflow-hidden">
            <div className={`px-4 py-2 border-b flex items-center justify-between ${color}`}>
              <div className="font-semibold text-sm">{cat}</div>
              <div className="text-[11px]">{done}/{total}</div>
            </div>
            <ul className="divide-y divide-midnight-100">
              {g.items.map((item) => (
                <ChecklistRow key={item.id} item={item} />
              ))}
              {adding === cat ? (
                <AddItemRow
                  category={cat}
                  onboardingId={onboardingId}
                  users={users}
                  onClose={() => setAdding(null)}
                />
              ) : (
                <li className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setAdding(cat)}
                    className="text-xs text-midnight-500 hover:text-indigoaccent flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un item
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}

      {/* Possibilité d'ajouter une catégorie complètement nouvelle */}
      <div className="card p-3">
        <NewCategoryAdder onboardingId={onboardingId} users={users} />
      </div>
    </div>
  );
}

function ChecklistRow({ item }: { item: Item }) {
  const [pending, start] = useTransition();
  const [optimisticDone, setOptimisticDone] = useState(item.done);

  function toggle() {
    const next = !optimisticDone;
    setOptimisticDone(next);
    start(async () => {
      try {
        await toggleOnboardingItem(item.id, next);
      } catch {
        setOptimisticDone(!next);
      }
    });
  }

  function onDelete() {
    if (!confirm(`Supprimer « ${item.title} » ?`)) return;
    start(async () => {
      try {
        await deleteOnboardingItem(item.id);
      } catch {
        // no-op
      }
    });
  }

  return (
    <li className="group px-4 py-2 flex items-start gap-3 hover:bg-midnight-50/50">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 grid place-items-center transition-colors ${
          optimisticDone
            ? "bg-emerald-500 border-emerald-500"
            : "border-midnight-300 hover:border-indigoaccent"
        }`}
        aria-label={optimisticDone ? "Décocher" : "Cocher"}
      >
        {optimisticDone && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm ${
            optimisticDone
              ? "text-midnight-400 line-through"
              : "text-midnight-900"
          }`}
        >
          {item.title}
        </div>
        {item.description && (
          <div className="text-[11px] text-midnight-500 mt-0.5">
            {item.description}
          </div>
        )}
        <div className="text-[10px] text-midnight-400 flex items-center gap-2 mt-0.5">
          {item.dueDate && <span>Échéance : {item.dueDate}</span>}
          {item.ownerName && <span>· {item.ownerName}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-midnight-400 hover:text-red-600"
        aria-label="Supprimer"
        disabled={pending}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function AddItemRow({
  category,
  onboardingId,
  users,
  onClose
}: {
  category: string;
  onboardingId: string;
  users: { id: string; firstName: string; lastName: string }[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <li className="px-4 py-2 bg-midnight-50/40">
      <form
        action={(fd) => {
          fd.set("category", category);
          start(async () => {
            await addOnboardingItem(onboardingId, fd);
            onClose();
          });
        }}
        className="flex items-center gap-2"
      >
        <input
          name="title"
          required
          placeholder="Nouvel item..."
          className="input flex-1 h-8 text-xs"
          autoFocus
        />
        <input
          name="dueDate"
          type="date"
          className="input w-32 h-8 text-xs"
          aria-label="Échéance"
        />
        <select name="ownerId" className="input w-36 h-8 text-xs">
          <option value="">— Responsable —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="btn-primary text-xs h-8"
          disabled={pending}
        >
          {pending ? "..." : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-midnight-400 hover:text-midnight-900 p-1"
          aria-label="Annuler"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    </li>
  );
}

function NewCategoryAdder({
  onboardingId,
  users
}: {
  onboardingId: string;
  users: { id: string; firstName: string; lastName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-midnight-500 hover:text-indigoaccent flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Nouvelle catégorie + item
      </button>
    );
  }
  return (
    <form
      action={(fd) => {
        start(async () => {
          await addOnboardingItem(onboardingId, fd);
          setOpen(false);
        });
      }}
      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
    >
      <div className="md:col-span-3">
        <label className="text-[10px] text-midnight-500">Catégorie</label>
        <input name="category" required className="input h-8 text-xs mt-0.5" />
      </div>
      <div className="md:col-span-4">
        <label className="text-[10px] text-midnight-500">Item</label>
        <input name="title" required className="input h-8 text-xs mt-0.5" />
      </div>
      <div className="md:col-span-2">
        <label className="text-[10px] text-midnight-500">Échéance</label>
        <input name="dueDate" type="date" className="input h-8 text-xs mt-0.5" />
      </div>
      <div className="md:col-span-2">
        <label className="text-[10px] text-midnight-500">Responsable</label>
        <select name="ownerId" className="input h-8 text-xs mt-0.5">
          <option value="">—</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-1">
        <button type="submit" className="btn-primary text-xs h-8" disabled={pending}>
          {pending ? "..." : "OK"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-midnight-400 hover:text-midnight-900 p-1"
          aria-label="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
