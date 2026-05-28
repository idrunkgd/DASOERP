"use client";
// Éditeur des items du template : groupés par catégorie, ajout via formulaire
// inline, suppression au survol.
import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  addTemplateItem,
  deleteTemplateItem
} from "@/server/actions/onboarding";
import { ROLE_LABELS } from "@/lib/rbac";

const ROLES = ["ADMIN", "MANAGER", "COMMERCIAL", "CONSULTANT", "FINANCE"] as const;

type Item = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  defaultOwnerRole: string | null;
  daysOffset: number;
  position: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  Administratif: "bg-blue-50 border-blue-200 text-blue-900",
  IT: "bg-violet-50 border-violet-200 text-violet-900",
  Formation: "bg-amber-50 border-amber-200 text-amber-900",
  "Intégration équipe": "bg-emerald-50 border-emerald-200 text-emerald-900"
};

export function TemplateItemsEditor({
  templateId,
  items
}: {
  templateId: string;
  items: Item[];
}) {
  // Groupe par catégorie
  const byCat: { category: string; items: Item[] }[] = [];
  for (const it of items) {
    const last = byCat.find((g) => g.category === it.category);
    if (last) last.items.push(it);
    else byCat.push({ category: it.category, items: [it] });
  }

  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [openNewCat, setOpenNewCat] = useState(false);

  return (
    <div className="space-y-4">
      {byCat.length === 0 && (
        <p className="text-xs text-midnight-500">
          Aucun item pour l'instant. Ajoute la première catégorie ci-dessous.
        </p>
      )}

      {byCat.map((g) => {
        const color =
          CATEGORY_COLORS[g.category] ??
          "bg-midnight-50 border-midnight-200 text-midnight-800";
        return (
          <div key={g.category} className="card overflow-hidden">
            <div
              className={`px-3 py-1.5 border-b flex items-center justify-between ${color}`}
            >
              <div className="font-semibold text-xs">{g.category}</div>
              <div className="text-[10px]">{g.items.length} items</div>
            </div>
            <ul className="divide-y divide-midnight-100">
              {g.items.map((it) => (
                <ItemRow key={it.id} item={it} />
              ))}
              {addingCat === g.category ? (
                <AddItemRow
                  templateId={templateId}
                  category={g.category}
                  onClose={() => setAddingCat(null)}
                />
              ) : (
                <li className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => setAddingCat(g.category)}
                    className="text-xs text-midnight-500 hover:text-indigoaccent flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter dans cette catégorie
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}

      {/* Nouvelle catégorie + premier item */}
      <div className="card p-3">
        {openNewCat ? (
          <AddItemRow
            templateId={templateId}
            category={null}
            onClose={() => setOpenNewCat(false)}
            allowCategoryEdit
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpenNewCat(true)}
            className="text-xs text-midnight-500 hover:text-indigoaccent flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Nouvelle catégorie + premier item
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const [pending, start] = useTransition();
  function onDelete() {
    if (!confirm(`Supprimer « ${item.title} » ?`)) return;
    start(async () => {
      await deleteTemplateItem(item.id);
    });
  }
  return (
    <li className="group px-3 py-2 flex items-start gap-3 hover:bg-midnight-50/50">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-midnight-900 font-medium">{item.title}</div>
        {item.description && (
          <div className="text-[11px] text-midnight-500 mt-0.5">
            {item.description}
          </div>
        )}
        <div className="text-[10px] text-midnight-400 mt-0.5 flex items-center gap-2">
          <span>
            J{item.daysOffset >= 0 ? "+" : ""}
            {item.daysOffset}
          </span>
          {item.defaultOwnerRole && (
            <span>· {ROLE_LABELS[item.defaultOwnerRole as keyof typeof ROLE_LABELS]}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-midnight-400 hover:text-red-600"
        aria-label="Supprimer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function AddItemRow({
  templateId,
  category,
  onClose,
  allowCategoryEdit
}: {
  templateId: string;
  category: string | null;
  onClose: () => void;
  allowCategoryEdit?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <li className="px-3 py-2 bg-midnight-50/40">
      <form
        action={(fd) => {
          if (category && !allowCategoryEdit) fd.set("category", category);
          start(async () => {
            await addTemplateItem(templateId, fd);
            onClose();
          });
        }}
        className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
      >
        {allowCategoryEdit && (
          <div className="md:col-span-3">
            <label className="text-[10px] text-midnight-500">Catégorie</label>
            <input
              name="category"
              required
              maxLength={40}
              placeholder="Administratif"
              className="input h-8 text-xs mt-0.5"
            />
          </div>
        )}
        <div className={allowCategoryEdit ? "md:col-span-4" : "md:col-span-5"}>
          <label className="text-[10px] text-midnight-500">Titre</label>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Signer le contrat"
            className="input h-8 text-xs mt-0.5"
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-midnight-500">J ± jours</label>
          <input
            name="daysOffset"
            type="number"
            defaultValue={0}
            className="input h-8 text-xs mt-0.5 font-mono"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] text-midnight-500">Responsable</label>
          <select
            name="defaultOwnerRole"
            className="input h-8 text-xs mt-0.5"
          >
            <option value="">—</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary text-xs h-8"
          >
            {pending ? "..." : "OK"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-midnight-400 hover:text-midnight-900 p-1"
            aria-label="Annuler"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </form>
    </li>
  );
}
