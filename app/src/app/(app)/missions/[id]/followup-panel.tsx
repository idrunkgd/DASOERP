"use client";
/**
 * Suivi de mission avec 2 onglets (CLIENT / CONSULTANT).
 * Chaque onglet contient :
 *   - un encadré "Note rapide" (saisie + liste)
 *   - une zone upload fichier + liste des documents attachés
 */
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, UserRound, Upload, X, FileIcon, Trash2, Plus, Loader2, Pencil, Check, Download } from "lucide-react";
import { addMissionNote, updateMissionNote, deleteMissionNote } from "@/server/actions/mission-notes";
import { uploadDocument, deleteDocument } from "@/server/actions/documents";

type Note = {
  id: string;
  content: string;
  audience: "CLIENT" | "CONSULTANT";
  createdAt: string;
  author: { firstName: string; lastName: string } | null;
};
type Doc = {
  id: string;
  title: string;
  originalName: string;
  size: number;
  audience: "CLIENT" | "CONSULTANT" | null;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
};

export function MissionFollowUpPanel({
  missionId, consultantLabel, clientLabel, notes, documents, canManage
}: {
  missionId: string;
  consultantLabel: string | null;
  clientLabel: string;
  notes: Note[];
  documents: Doc[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState<"CLIENT" | "CONSULTANT">("CLIENT");

  const filteredNotes = notes.filter(n => n.audience === tab);
  const filteredDocs = documents.filter(d => d.audience === tab);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">Suivi mission</h2>
        <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-white">
          <button
            onClick={() => setTab("CLIENT")}
            className={"px-3 py-1.5 text-xs flex items-center gap-1.5 " + (tab === "CLIENT" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50")}
          >
            <Building2 className="w-3.5 h-3.5" /> Client · {clientLabel}
          </button>
          <button
            onClick={() => setTab("CONSULTANT")}
            className={"px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-border " + (tab === "CONSULTANT" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50")}
          >
            <UserRound className="w-3.5 h-3.5" /> Consultant{consultantLabel ? ` · ${consultantLabel}` : ""}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <QuickNotes missionId={missionId} audience={tab} notes={filteredNotes} canManage={canManage} />
        <DocumentsSection missionId={missionId} audience={tab} documents={filteredDocs} canManage={canManage} />
      </div>
    </section>
  );
}

/* ─── NOTES ───────────────────────────────────────────────────────── */
function QuickNotes({ missionId, audience, notes, canManage }: { missionId: string; audience: "CLIENT" | "CONSULTANT"; notes: Note[]; canManage: boolean }) {
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const fd = new FormData();
    fd.set("missionId", missionId);
    fd.set("audience", audience);
    fd.set("content", content);
    start(async () => {
      try { await addMissionNote(fd); setContent(""); toast.success("Note ajoutée"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-midnight-50/30">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-midnight-500 mb-3">
        Notes rapides {audience === "CLIENT" ? "client" : "consultant"} ({notes.length})
      </h3>
      {canManage && (
        <form onSubmit={submit} className="mb-3 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={audience === "CLIENT" ? "Point d'étape, feedback client, décision prise…" : "Note interne consultant, blocage, besoin, contact RH…"}
            className="input min-h-[70px] py-2 text-sm w-full"
            maxLength={5000}
          />
          <div className="flex justify-end">
            <button disabled={pending || !content.trim()} className="btn-primary btn-sm">
              {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Ajouter
            </button>
          </div>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="text-xs text-midnight-500 italic">Aucune note.</p>
      ) : (
        <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {notes.map((n) => <NoteItem key={n.id} note={n} canManage={canManage} />)}
        </ul>
      )}
    </div>
  );
}

function NoteItem({ note, canManage }: { note: Note; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const fd = new FormData();
    fd.set("content", content);
    start(async () => {
      try { await updateMissionNote(note.id, fd); setEditing(false); toast.success("Note mise à jour"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove() {
    if (!window.confirm("Supprimer cette note ?")) return;
    start(async () => {
      try { await deleteMissionNote(note.id); toast.success("Note supprimée"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  if (editing) {
    return (
      <li className="bg-white rounded border border-indigoaccent/40 p-2 space-y-2">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input min-h-[60px] py-1 text-sm w-full" />
        <div className="flex justify-end gap-1">
          <button onClick={() => { setEditing(false); setContent(note.content); }} className="btn-ghost btn-sm" disabled={pending}><X className="w-3 h-3" /></button>
          <button onClick={save} className="btn-primary btn-sm" disabled={pending}>{pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</button>
        </div>
      </li>
    );
  }
  return (
    <li className="bg-white rounded border border-border/60 p-2 text-sm group">
      <div className="whitespace-pre-wrap text-midnight-900">{note.content}</div>
      <div className="flex justify-between items-center mt-1.5 text-[10px] text-midnight-500">
        <span>{note.author ? `${note.author.firstName} ${note.author.lastName}` : "—"} · {new Date(note.createdAt).toLocaleString("fr-BE")}</span>
        {canManage && (
          <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={() => setEditing(true)} className="hover:text-indigoaccent" title="Modifier"><Pencil className="w-3 h-3" /></button>
            <button onClick={remove} disabled={pending} className="hover:text-red-600" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
          </span>
        )}
      </div>
    </li>
  );
}

/* ─── DOCUMENTS ───────────────────────────────────────────────────── */
function DocumentsSection({ missionId, audience, documents, canManage }: { missionId: string; audience: "CLIENT" | "CONSULTANT"; documents: Doc[]; canManage: boolean }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-midnight-50/30">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-midnight-500 mb-3">
        Fichiers {audience === "CLIENT" ? "client" : "consultant"} ({documents.length})
      </h3>
      {canManage && <DocUpload missionId={missionId} audience={audience} />}
      {documents.length === 0 ? (
        <p className="text-xs text-midnight-500 italic mt-3">Aucun fichier.</p>
      ) : (
        <ul className="space-y-2 mt-3 max-h-[350px] overflow-y-auto pr-1">
          {documents.map((d) => <DocItem key={d.id} doc={d} canManage={canManage} />)}
        </ul>
      )}
    </div>
  );
}

function DocItem({ doc, canManage }: { doc: Doc; canManage: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function remove() {
    if (!window.confirm(`Supprimer « ${doc.title} » ?`)) return;
    start(async () => {
      try { await deleteDocument(doc.id); toast.success("Fichier supprimé"); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  return (
    <li className="bg-white rounded border border-border/60 p-2 flex items-center gap-2 text-sm group">
      <FileIcon className="w-4 h-4 text-midnight-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-midnight-900 truncate">{doc.title}</div>
        <div className="text-[10px] text-midnight-500">
          {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : "—"} · {humanSize(doc.size)} · {new Date(doc.createdAt).toLocaleDateString("fr-BE")}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <a href={`/api/documents/${doc.id}/download`} className="text-midnight-400 hover:text-indigoaccent p-1" title="Télécharger" target="_blank" rel="noopener noreferrer">
          <Download className="w-3.5 h-3.5" />
        </a>
        {canManage && (
          <button onClick={remove} disabled={pending} className="text-midnight-400 hover:text-red-600 p-1" title="Supprimer">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </li>
  );
}

function DocUpload({ missionId, audience }: { missionId: string; audience: "CLIENT" | "CONSULTANT" }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pickFile(f: File | null) { setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }
  function reset() { setFile(null); setTitle(""); if (inputRef.current) inputRef.current.value = ""; }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", title || file.name);
    fd.set("missionId", missionId);
    fd.set("audience", audience);
    start(async () => {
      try { await uploadDocument(fd); toast.success("Fichier ajouté"); reset(); setOpen(false); router.refresh(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur upload"); }
    });
  }

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm w-full text-xs">
      <Plus className="w-3 h-3" /> Uploader un fichier {audience === "CLIENT" ? "client" : "consultant"}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-2 border border-border rounded p-2 bg-white">
      <div
        onClick={() => inputRef.current?.click()}
        className={"border-2 border-dashed rounded p-2 text-center cursor-pointer text-xs " + (file ? "border-emerald-300 bg-emerald-50/40" : "border-midnight-200 hover:bg-midnight-50/40")}
      >
        {file ? (
          <div className="flex items-center gap-2 justify-center">
            <FileIcon className="w-4 h-4 text-emerald-600" />
            <span className="truncate max-w-[180px]">{file.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); pickFile(null); }} className="hover:text-red-600"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <div className="text-midnight-500"><Upload className="w-4 h-4 mx-auto mb-1" /> Cliquer pour choisir</div>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Titre" className="input text-xs" />
      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="btn-ghost btn-sm">Annuler</button>
        <button type="submit" disabled={pending || !file} className="btn-primary btn-sm">{pending ? "…" : "Uploader"}</button>
      </div>
    </form>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
