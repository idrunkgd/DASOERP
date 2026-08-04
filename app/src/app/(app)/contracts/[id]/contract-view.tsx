"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Trash2, Eye, Pencil, Plus, ChevronUp, ChevronDown } from "lucide-react";
import {
  updateContractMeta,
  updateContractChapters,
  deleteContract
} from "@/server/actions/contracts";

type Chapter = { title: string; bodyMd: string; sortOrder: number };
type Contract = {
  id: string;
  reference: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  signedAt: string;
  terminatedAt: string;
  notes: string;
  chapters: Chapter[];
};

/**
 * Vue + édition d'un contrat déjà généré. Onglets Aperçu / Édition.
 * L'aperçu affiche les chapitres résolus (les variables ont été remplacées à
 * la génération). L'édition permet d'ajuster manuellement les chapitres pour
 * les cas particuliers (avenant, correction de dernière minute).
 */
export function ContractView({
  contract, subject
}: {
  contract: Contract;
  subject: { name: string; href: string } | null;
}) {
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [chapters, setChapters] = useState<Chapter[]>(contract.chapters);
  const router = useRouter();
  const [pending, start] = useTransition();

  function saveMeta(fd: FormData) {
    start(async () => {
      try {
        await updateContractMeta(contract.id, fd);
        toast.success("Contrat mis à jour");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function saveChapters() {
    start(async () => {
      try {
        await updateContractChapters(contract.id, chapters);
        toast.success("Chapitres sauvegardés");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove() {
    if (!window.confirm(`Supprimer le contrat ${contract.reference} ? Action irréversible.`)) return;
    start(async () => {
      try {
        await deleteContract(contract.id);
        toast.success("Contrat supprimé");
        router.push("/contracts");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function updateChapter(idx: number, patch: Partial<Chapter>) {
    setChapters((list) => list.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function moveChapter(idx: number, dir: -1 | 1) {
    const swap = idx + dir;
    if (swap < 0 || swap >= chapters.length) return;
    const next = chapters.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((c, i) => (c.sortOrder = i));
    setChapters(next);
  }
  function addChapter() {
    setChapters((list) => [...list, { title: "Nouveau chapitre", bodyMd: "", sortOrder: list.length }]);
  }
  function deleteChapter(idx: number) {
    if (!window.confirm("Retirer ce chapitre du contrat ?")) return;
    setChapters((list) => list.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sortOrder: i })));
  }

  return (
    <div className="space-y-4">
      {/* Meta */}
      <form action={saveMeta} className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="label">Titre *</label>
            <input name="title" required defaultValue={contract.title} className="input" />
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" defaultValue={contract.status} className="input">
              <option value="DRAFT">Brouillon</option>
              <option value="ACTIVE">Actif (signé)</option>
              <option value="TERMINATED">Clôturé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>
          <div>
            <label className="label">Début</label>
            <input name="startDate" type="date" defaultValue={contract.startDate} className="input" />
          </div>
          <div>
            <label className="label">Fin</label>
            <input name="endDate" type="date" defaultValue={contract.endDate} className="input" />
          </div>
          <div>
            <label className="label">Signé le</label>
            <input name="signedAt" type="datetime-local" defaultValue={contract.signedAt} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes internes</label>
          <textarea name="notes" rows={2} defaultValue={contract.notes} className="input" />
        </div>
        <input type="hidden" name="terminatedAt" defaultValue={contract.terminatedAt} />
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <div className="flex items-center gap-3 text-sm text-midnight-600">
            {subject && (
              <>
                <span>Lié à :</span>
                <Link href={subject.href} className="text-indigoaccent hover:underline font-medium">
                  {subject.name}
                </Link>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={remove} disabled={pending} className="btn-ghost text-red-600 text-sm">
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
            <button disabled={pending} className="btn-primary btn-sm">
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </div>
      </form>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("preview")}
          className={
            "px-4 py-2 text-sm border-b-2 -mb-px " +
            (tab === "preview"
              ? "border-indigoaccent text-indigoaccent font-medium"
              : "border-transparent text-midnight-500 hover:text-midnight-700")
          }
        >
          <Eye className="w-3.5 h-3.5 inline mr-1" /> Aperçu
        </button>
        <button
          onClick={() => setTab("edit")}
          className={
            "px-4 py-2 text-sm border-b-2 -mb-px " +
            (tab === "edit"
              ? "border-indigoaccent text-indigoaccent font-medium"
              : "border-transparent text-midnight-500 hover:text-midnight-700")
          }
        >
          <Pencil className="w-3.5 h-3.5 inline mr-1" /> Éditer les chapitres
        </button>
      </div>

      {tab === "preview" ? (
        <article className="card p-8 max-w-3xl mx-auto space-y-6">
          {chapters.length === 0 ? (
            <p className="text-sm text-midnight-500 italic">Aucun chapitre.</p>
          ) : (
            chapters.map((c, i) => (
              <section key={i}>
                <h2 className="font-semibold text-midnight-900 text-lg mb-2">
                  {i + 1}. {c.title}
                </h2>
                <div className="text-sm text-midnight-800 whitespace-pre-wrap leading-relaxed">
                  {c.bodyMd}
                </div>
              </section>
            ))
          )}
        </article>
      ) : (
        <section className="card p-4 space-y-3">
          {chapters.map((c, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigoaccent/10 text-indigoaccent grid place-items-center text-[10px] font-semibold flex-shrink-0">
                  {idx + 1}
                </span>
                <input
                  value={c.title}
                  onChange={(e) => updateChapter(idx, { title: e.target.value })}
                  className="input flex-1 text-sm font-medium"
                />
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => moveChapter(idx, -1)} disabled={idx === 0}
                    className="btn-ghost btn-sm p-1"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => moveChapter(idx, +1)} disabled={idx === chapters.length - 1}
                    className="btn-ghost btn-sm p-1"><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => deleteChapter(idx)}
                    className="btn-ghost btn-sm p-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <textarea
                value={c.bodyMd}
                onChange={(e) => updateChapter(idx, { bodyMd: e.target.value })}
                rows={6}
                className="input text-xs whitespace-pre-wrap"
              />
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <button type="button" onClick={addChapter} className="btn-ghost text-sm">
              <Plus className="w-4 h-4" /> Ajouter un chapitre
            </button>
            <button type="button" onClick={saveChapters} disabled={pending} className="btn-primary btn-sm">
              <Save className="w-4 h-4" /> Sauvegarder les chapitres
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
