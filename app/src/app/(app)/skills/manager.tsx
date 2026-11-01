"use client";
import { useMemo, useState, useTransition } from "react";
import { createSkill, updateSkill, deleteSkill, mergeSkills, mergeOrphanSkill } from "@/server/actions/skills";
import { toast } from "sonner";
import { Trash2, Plus, Edit3, GitMerge, AlertTriangle, Ghost } from "lucide-react";
import { CategoryInput } from "@/components/forms/category-input";

type Skill = { id: string; name: string; category: string | null; active: boolean };
type Orphan = { name: string; users: number; candidates: number; missions: number; total: number };

export function SkillsManager({ skills, orphans = [] }: { skills: Skill[]; orphans?: Orphan[] }) {
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

  // Groupes de doublons : skills dont le nom lowercase est identique à un autre.
  // Ex: "TIA Portal" et "TIA PORTAL" → 1 groupe de 2 entrées.
  const duplicates = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of skills) {
      const key = s.name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.values()).filter((grp) => grp.length > 1);
  }, [skills]);

  return (
    <div className="space-y-4">
      {orphans.length > 0 && (
        <section className="card p-4 border-rose-300 bg-rose-50/50">
          <h2 className="font-semibold mb-2 flex items-center gap-2 text-rose-900">
            <Ghost className="w-4 h-4" />
            Compétences utilisées dans les CV, absentes du catalogue ({orphans.length})
          </h2>
          <p className="text-xs text-rose-800 mb-3">
            Ces chaînes viennent d'imports CV ou de saisies libres mais n'existent pas comme <em>Skill</em>.
            Fusionne-les vers une entrée du catalogue : la skill est remplacée directement dans
            la fiche candidat/consultant (donc dans le CV généré) et dans les demandes de mission.
          </p>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {orphans.map((o) => (
              <OrphanRow key={o.name} orphan={o} catalog={skills} />
            ))}
          </div>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="card p-4 border-amber-300 bg-amber-50/50">
          <h2 className="font-semibold mb-2 flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4" />
            Doublons détectés ({duplicates.length})
          </h2>
          <p className="text-xs text-amber-800 mb-3">
            Ces compétences ont le même nom à la casse près.
            Fusionne-les pour n'en garder qu'une — toutes les affectations candidat/consultant/mission
            sont automatiquement mises à jour, sans perte.
          </p>
          <div className="space-y-2">
            {duplicates.map((grp) => (
              <DuplicateGroup key={grp[0].name.toLowerCase()} group={grp} />
            ))}
          </div>
        </section>
      )}

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
              {list.map(s => <SkillRow key={s.id} skill={s} categories={categories} allSkills={skills} />)}
            </div>
          </section>
        )
      ))}
    </div>
  );
}

function OrphanRow({ orphan, catalog }: { orphan: Orphan; catalog: Skill[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run(target: Skill) {
    if (!window.confirm(`Remplacer « ${orphan.name} » par « ${target.name} » dans tous les CV / fiches candidat / consultants / missions ?`)) return;
    start(async () => {
      try {
        const r = await mergeOrphanSkill(orphan.name, target.id);
        toast.success(`Fusionné — ${r.candidatesUpdated} candidat, ${r.usersUpdated} user, ${r.missionsUpdated} mission mis à jour`);
        setOpen(false);
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-rose-200 rounded px-3 py-2 text-xs">
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate">« {orphan.name} »</span>
        <span className="text-rose-700/80 ml-2 text-[10px]">
          {orphan.candidates > 0 && `${orphan.candidates} candidat${orphan.candidates > 1 ? "s" : ""}`}
          {orphan.users > 0 && `${orphan.candidates > 0 ? " · " : ""}${orphan.users} user${orphan.users > 1 ? "s" : ""}`}
          {orphan.missions > 0 && `${orphan.users > 0 || orphan.candidates > 0 ? " · " : ""}${orphan.missions} mission${orphan.missions > 1 ? "s" : ""}`}
        </span>
      </div>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm flex items-center gap-1">
        <GitMerge className="w-3 h-3" /> Fusionner dans…
      </button>
      {open && (
        <OrphanMergeModal
          orphan={orphan}
          catalog={catalog}
          onClose={() => setOpen(false)}
          onPick={run}
          pending={pending}
        />
      )}
    </div>
  );
}

function OrphanMergeModal({
  orphan, catalog, onClose, onPick, pending
}: {
  orphan: Orphan; catalog: Skill[];
  onClose: () => void; onPick: (s: Skill) => void; pending: boolean;
}) {
  const [search, setSearch] = useState(orphan.name);
  const list = catalog
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 50);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div className="card max-w-md w-full p-5 m-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <GitMerge className="w-4 h-4" /> Remplacer « {orphan.name} » par…
        </h3>
        <p className="text-xs text-midnight-500 mb-3">
          La chaîne « {orphan.name} » sera remplacée par la compétence choisie dans les skills
          des candidats, consultants et demandes de mission qui l'utilisent.
        </p>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher la compétence cible…"
          className="input mb-3"
        />
        <div className="max-h-72 overflow-y-auto border border-border rounded">
          {list.length === 0 ? (
            <p className="text-xs text-midnight-500 p-3 text-center">Aucune compétence du catalogue ne matche</p>
          ) : list.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              disabled={pending}
              className="w-full text-left px-3 py-2 hover:bg-indigoaccent/10 flex items-center justify-between text-sm border-b last:border-b-0"
            >
              <span>
                <span className="font-medium">{s.name}</span>
                {s.category && <span className="text-midnight-500 text-xs"> · {s.category}</span>}
              </span>
              <GitMerge className="w-3 h-3 text-midnight-400" />
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function DuplicateGroup({ group }: { group: Skill[] }) {
  const [pending, start] = useTransition();
  const [targetId, setTargetId] = useState(group[0].id);

  function doMerge(sourceId: string) {
    const sourceName = group.find((s) => s.id === sourceId)?.name;
    const targetName = group.find((s) => s.id === targetId)?.name;
    if (!window.confirm(`Fusionner « ${sourceName} » dans « ${targetName} » ?\nToutes les affectations seront mises à jour.`)) return;
    start(async () => {
      try {
        const res = await mergeSkills(sourceId, targetId);
        toast.success(`Fusionné — ${res.usersUpdated} user, ${res.candidatesUpdated} candidat, ${res.missionsUpdated} mission mis à jour`);
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap bg-white border border-amber-200 rounded px-3 py-2 text-xs">
      <span className="font-semibold">Garder :</span>
      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="border border-border rounded px-2 py-1 text-xs"
      >
        {group.map((s) => <option key={s.id} value={s.id}>« {s.name} » {s.category ? `(${s.category})` : ""}</option>)}
      </select>
      <span className="text-midnight-500">et fusionner :</span>
      {group.filter((s) => s.id !== targetId).map((s) => (
        <button
          key={s.id}
          onClick={() => doMerge(s.id)}
          disabled={pending}
          className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-full px-2 py-1"
        >
          <GitMerge className="w-3 h-3" /> « {s.name} »
        </button>
      ))}
    </div>
  );
}

function SkillRow({ skill, categories, allSkills }: { skill: Skill; categories: string[]; allSkills: Skill[] }) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
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
    <>
      <span className="inline-flex items-center gap-1 bg-midnight-100 text-midnight-800 rounded-full px-2 py-1 text-xs">
        <span className="font-medium">{skill.name}</span>
        <button onClick={() => setEdit(true)} className="text-midnight-500 hover:text-midnight-900 ml-1" title="Éditer"><Edit3 className="w-3 h-3" /></button>
        <button onClick={() => setMergeOpen(true)} className="text-midnight-500 hover:text-indigoaccent" title="Fusionner dans une autre compétence"><GitMerge className="w-3 h-3" /></button>
        <button
          onClick={() => { if (window.confirm(`Supprimer « ${skill.name} » ?`)) start(async () => { await deleteSkill(skill.id); }); }}
          className="text-midnight-500 hover:text-danger" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
      </span>
      {mergeOpen && (
        <MergeModal
          source={skill}
          others={allSkills.filter((s) => s.id !== skill.id)}
          onClose={() => setMergeOpen(false)}
        />
      )}
    </>
  );
}

function MergeModal({ source, others, onClose }: { source: Skill; others: Skill[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const list = others
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 30);

  function run(targetId: string, targetName: string) {
    if (!window.confirm(`Remplacer « ${source.name} » par « ${targetName} » partout ?\nToutes les affectations candidat/consultant/mission seront mises à jour, et « ${source.name} » sera supprimée du catalogue.`)) return;
    start(async () => {
      try {
        const res = await mergeSkills(source.id, targetId);
        toast.success(`Fusionné — ${res.usersUpdated} user, ${res.candidatesUpdated} candidat, ${res.missionsUpdated} mission mis à jour`);
        onClose();
      } catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div className="card max-w-md w-full p-5 m-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-1 flex items-center gap-2"><GitMerge className="w-4 h-4" /> Fusionner « {source.name} » dans…</h3>
        <p className="text-xs text-midnight-500 mb-3">
          Choisis la compétence qui doit remplacer « {source.name} » partout.
          Les affectations existantes sont mises à jour, aucun candidat ni consultant ne perd son skill.
        </p>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher la compétence cible…"
          className="input mb-3"
        />
        <div className="max-h-72 overflow-y-auto border border-border rounded">
          {list.length === 0 ? (
            <p className="text-xs text-midnight-500 p-3 text-center">Aucune compétence</p>
          ) : list.map((s) => (
            <button
              key={s.id}
              onClick={() => run(s.id, s.name)}
              disabled={pending}
              className="w-full text-left px-3 py-2 hover:bg-indigoaccent/10 flex items-center justify-between text-sm border-b last:border-b-0"
            >
              <span>
                <span className="font-medium">{s.name}</span>
                {s.category && <span className="text-midnight-500 text-xs"> · {s.category}</span>}
              </span>
              <GitMerge className="w-3 h-3 text-midnight-400" />
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="btn-ghost">Annuler</button>
        </div>
      </div>
    </div>
  );
}
