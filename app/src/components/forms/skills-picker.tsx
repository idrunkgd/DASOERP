"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";

type Skill = { id: string; name: string; category: string | null };

/**
 * Sélecteur de compétences :
 *  - Cases à cocher pour les compétences pré-configurées du catalogue (groupées par catégorie)
 *  - Champ libre pour ajouter des compétences hors catalogue (Enter pour valider)
 *  - Sortie : input hidden `name` avec valeur CSV → compatible Zod existant `String[]`
 *
 * Utilisé sur les formulaires Utilisateur, Candidat, etc.
 */
export function SkillsPicker({
  name = "skills",
  catalog,
  initial = [],
  label = "Compétences"
}: {
  name?: string;
  catalog: Skill[];
  initial?: string[];
  label?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.map(s => s.toLowerCase())));
  const [custom, setCustom] = useState("");

  const catalogByName = new Map(catalog.map(s => [s.name.toLowerCase(), s]));
  // Compétences libres = celles dans `selected` qui ne sont pas dans le catalogue
  const customSkills = Array.from(selected).filter(s => !catalogByName.has(s));

  const groups = catalog.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category ?? "Autres";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  function toggle(skillName: string) {
    const k = skillName.toLowerCase();
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  }

  function addCustom() {
    const v = custom.trim().toLowerCase();
    if (!v) return;
    const next = new Set(selected); next.add(v); setSelected(next);
    setCustom("");
  }

  return (
    <div>
      <input type="hidden" name={name} value={Array.from(selected).join(", ")} />
      <label className="label">{label} <span className="text-midnight-400">({selected.size} sélectionnée(s))</span></label>

      <div className="space-y-3 border border-border rounded-lg p-3 bg-midnight-50/30 max-h-[320px] overflow-y-auto">
        {Object.keys(groups).length === 0 && (
          <p className="text-xs text-midnight-500">Catalogue vide. Ajoutez des compétences via Configuration → Compétences, ou utilisez le champ libre ci-dessous.</p>
        )}
        {Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([cat, list]) => (
          <fieldset key={cat}>
            <legend className="text-[11px] uppercase font-semibold text-midnight-500 tracking-wide mb-1">{cat}</legend>
            <div className="flex flex-wrap gap-1.5">
              {list.map(s => {
                const checked = selected.has(s.name.toLowerCase());
                return (
                  <label key={s.id} className={"text-xs px-2 py-1 rounded-full cursor-pointer border transition-colors " + (checked ? "bg-indigoaccent/20 border-indigoaccent text-indigoaccent" : "bg-white border-border text-midnight-700 hover:border-midnight-300")}>
                    <input type="checkbox" className="hidden" checked={checked} onChange={() => toggle(s.name)} />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        {customSkills.length > 0 && (
          <fieldset>
            <legend className="text-[11px] uppercase font-semibold text-amber-700 tracking-wide mb-1">Hors catalogue</legend>
            <div className="flex flex-wrap gap-1.5">
              {customSkills.map(s => (
                <span key={s} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                  {s}
                  <button type="button" onClick={() => toggle(s)} className="hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Ajouter une compétence libre (Entrée pour valider)..."
          className="input flex-1"
        />
        <button type="button" onClick={addCustom} className="btn-secondary"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
