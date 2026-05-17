"use client";
import { useMemo, useState, useTransition } from "react";
import { createSkill, updateSkill, deleteSkill } from "@/server/actions/skills";
import { toast } from "sonner";
import { Trash2, Plus, Edit3 } from "lucide-react";
import { CategoryInput } from "./category-input";

type Skill = { id: string; name: string; category: string | null; active: boolean };

export function SkillsManager({ skills }: { skills: Skill[] }) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  // Liste unique des catégories existantes (triée)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const groups = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category ?? "(sans catégorie)";
    if (!acc[cat]) acc[cat] = [];
    if (!filter || s.name.toLowerCase().includes(filter.toLowerCase())) acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold mb-3">Ajouter une compétence</h2>
        <form
          action={(fd) => start(async () => {
            try { await createSkill(fd); toast.success("Compétence ajoutée"); (document.getElementById("new-skill") as HTMLFormElement)?.reset(); }
            catch (e: any) { toast.error(e.message); }
          })}
          id="new-skill"
          className="grid grid-cols-12 gap-2 items-end"
        >
          <div className="col-span-5">
            <label className="label">Nom *</label>
            <input name="name" required className="input" placeholder="ex: React, Kubernetes, Leadership..." />
          </div>
          <div className="col-span-5">
            <label className="label">Catégorie</label>
            <CategoryInput categories={categories} />
          </div>
          <div className="col-span-2">
            <button disabled={pending} className="btn-primary w-full">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
        </form>
      </section>

      <div className="flex items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer..." className="input max-w-xs" />
      </div>

      {Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([cat, list]) => (
        list.length > 0 && (
          <section key={cat} className="card p-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-midnight-500 mb-2">{cat} ({list.length})</h3>
            <div className="flex flex-wrap gap-2">
              {list.map(s => <SkillRow key={s.id} skill={s} categories={categories} />)}
            </div>
          </section>
        )
      ))}
    </div>
  );
}

function SkillRow({ skill, categories }: { skill: Skill; categories: string[] }) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  if (edit) {
    return (
      <form
        action={(fd) => start(async () => {
          try { await updateSkill(skill.id, fd); setEdit(false); toast.success("Mis à jour"); }
          catch (e: any) { toast.error(e.message); }
        })}
        className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5 bg-midnight-50/50 min-w-[280px]"
      >
        <input
          name="name"
          defaultValue={skill.name}
          required
          className="bg-white text-xs border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigoaccent/40 flex-1 min-w-0"
        />
        <div className="flex-1 min-w-0 [&_input]:!text-xs [&_input]:!py-1">
          <CategoryInput
            categories={categories}
            initial={skill.category ?? ""}
            placeholder="Catégorie"
          />
        </div>
        <button disabled={pending} className="text-[10px] text-indigoaccent font-semibold px-1">OK</button>
        <button type="button" onClick={() => setEdit(false)} className="text-[10px] text-midnight-500 px-1">×</button>
      </form>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-midnight-100 text-midnight-800 rounded-full px-2 py-1 text-xs">
      <span className="font-medium">{skill.name}</span>
      <button onClick={() => setEdit(true)} className="text-midnight-500 hover:text-midnight-900 ml-1"><Edit3 className="w-3 h-3" /></button>
      <button
        onClick={() => { if (window.confirm(`Supprimer « ${skill.name} » ?`)) start(async () => { await deleteSkill(skill.id); }); }}
        className="text-midnight-500 hover:text-danger"><Trash2 className="w-3 h-3" /></button>
    </span>
  );
}
