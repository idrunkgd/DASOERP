"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Trash2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import {
  updateContractTemplate,
  addTemplateChapter,
  updateTemplateChapter,
  deleteTemplateChapter,
  deleteContractTemplate,
  reorderTemplateChapters
} from "@/server/actions/contracts";
import { useRouter } from "next/navigation";

type Chapter = { id: string; title: string; bodyMd: string; sortOrder: number };
type Template = { id: string; name: string; description: string | null; active: boolean };

export function TemplateEditor({
  template, chapters: initialChapters
}: {
  template: Template;
  chapters: Chapter[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chapters, setChapters] = useState(initialChapters);

  // ─── Meta template (nom, description, actif)
  function saveMeta(fd: FormData) {
    start(async () => {
      try {
        await updateContractTemplate(template.id, fd);
        toast.success("Template sauvegardé");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function removeTemplate() {
    if (!window.confirm(`Supprimer "${template.name}" ? Les contrats déjà générés seront préservés (perdent juste le lien vers le template).`)) return;
    start(async () => {
      try {
        await deleteContractTemplate(template.id);
        toast.success("Template supprimé");
        router.push("/contracts");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  // ─── Ajouter chapitre
  function addChapter(fd: FormData) {
    start(async () => {
      try {
        await addTemplateChapter(template.id, fd);
        toast.success("Chapitre ajouté");
        router.refresh();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  // ─── Reorder (up/down)
  function move(id: string, dir: -1 | 1) {
    const idx = chapters.findIndex(c => c.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= chapters.length) return;
    const next = chapters.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setChapters(next);
    start(async () => {
      try {
        await reorderTemplateChapters(template.id, next.map(c => c.id));
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Meta */}
      <form action={saveMeta} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Nom *</label>
            <input name="name" required defaultValue={template.name} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm md:mt-6">
            <input name="active" type="checkbox" defaultChecked={template.active} value="true" />
            <span>Actif (disponible pour la génération)</span>
          </label>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" rows={2} defaultValue={template.description ?? ""} className="input" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <button type="button" onClick={removeTemplate} disabled={pending} className="btn-ghost text-red-600 text-sm">
            <Trash2 className="w-4 h-4" /> Supprimer le template
          </button>
          <button disabled={pending} className="btn-primary btn-sm">
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </form>

      {/* Chapitres */}
      <section className="card p-4">
        <h2 className="font-semibold text-midnight-900 mb-3">
          Chapitres ({chapters.length})
        </h2>
        <div className="space-y-3">
          {chapters.map((c, idx) => (
            <ChapterEditor
              key={c.id}
              chapter={c}
              index={idx}
              total={chapters.length}
              onMoveUp={() => move(c.id, -1)}
              onMoveDown={() => move(c.id, +1)}
              disabled={pending}
              onDeleted={() => {
                setChapters((list) => list.filter((x) => x.id !== c.id));
                router.refresh();
              }}
            />
          ))}
        </div>

        {/* Nouveau chapitre */}
        <form action={addChapter} className="border-t border-border mt-4 pt-4 space-y-2 bg-indigoaccent/5 -mx-4 -mb-4 px-4 pb-4 rounded-b">
          <h3 className="font-medium text-sm text-indigoaccent">+ Nouveau chapitre</h3>
          <input name="title" required placeholder="Titre du chapitre (ex: Article 1 - Fonctions)" className="input" />
          <textarea
            name="bodyMd"
            rows={5}
            className="input font-mono text-xs"
            placeholder={`Corps markdown avec variables.\nEx: "Le présent contrat est conclu entre {{fullName}}, né(e) le {{birthDate}} à {{birthPlace}}, domicilié(e) à {{address}}, {{postalCode}} {{city}}..."`}
          />
          <button disabled={pending} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </form>
      </section>
    </div>
  );
}

function ChapterEditor({
  chapter, index, total, onMoveUp, onMoveDown, onDeleted, disabled
}: {
  chapter: Chapter;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleted: () => void;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();

  function save(fd: FormData) {
    start(async () => {
      try {
        await updateTemplateChapter(chapter.id, fd);
        toast.success("Chapitre mis à jour");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove() {
    if (!window.confirm("Supprimer ce chapitre ?")) return;
    start(async () => {
      try {
        await deleteTemplateChapter(chapter.id);
        toast.success("Chapitre supprimé");
        onDeleted();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <form action={save} className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-indigoaccent/10 text-indigoaccent grid place-items-center text-[10px] font-semibold flex-shrink-0">
          {index + 1}
        </span>
        <input
          name="title"
          required
          defaultValue={chapter.title}
          className="input flex-1 text-sm font-medium"
        />
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={onMoveUp} disabled={disabled || index === 0}
            className="btn-ghost btn-sm p-1" title="Monter">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={disabled || index === total - 1}
            className="btn-ghost btn-sm p-1" title="Descendre">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <textarea
        name="bodyMd"
        rows={6}
        defaultValue={chapter.bodyMd}
        className="input font-mono text-xs"
        placeholder="Corps du chapitre — supporte les variables {{key}}"
      />
      <div className="flex justify-between items-center pt-1">
        <button type="button" onClick={remove} disabled={pending} className="text-xs text-red-600 hover:underline">
          <Trash2 className="w-3 h-3 inline mr-1" /> Supprimer
        </button>
        <button disabled={pending} className="btn-primary btn-sm text-xs">
          <Save className="w-3.5 h-3.5" /> Enregistrer
        </button>
      </div>
    </form>
  );
}
