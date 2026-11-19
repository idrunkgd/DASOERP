"use client";
/**
 * Bouton + modal pour renommer un test (titre, description, domaine, actif).
 * Permission requise côté serveur : tests.manage.
 */
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X, Loader2 } from "lucide-react";
import { renameTest } from "@/server/actions/tests";
import { domainLabel } from "@/lib/test-display";

const DOMAINS = ["ELEC_INDUSTRIAL", "PLC", "DATA_MANAGER", "IT_INDUSTRIAL", "CYBERSEC_INDUSTRIAL", "OTHER"] as const;

export function RenameTestButton({
  testId,
  initial
}: {
  testId: string;
  initial: { title: string; description: string | null; domain: string; isActive: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setMounted(true); }, []);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [domain, setDomain] = useState(initial.domain);
  const [isActive, setIsActive] = useState(initial.isActive);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await renameTest(testId, {
          title,
          description: description || null,
          domain: domain as any,
          isActive
        });
        toast.success("Test modifié");
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  const modal = open && mounted ? createPortal((
    <div className="fixed inset-0 z-[9999] bg-black/50 grid place-items-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
      <form onSubmit={submit} className="card p-6 w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg mb-1">Modifier le test</h2>
        <p className="text-xs text-midnight-500 mb-4">Titre, description, domaine, visibilité.</p>
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" maxLength={200} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input min-h-[60px] py-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Domaine</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className="input">
                {DOMAINS.map((d) => <option key={d} value={d}>{domainLabel(d)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <label className="inline-flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Actif (assignable)
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={pending || !title.trim()} className="btn-primary">
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  ), document.body) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm inline-flex items-center gap-1">
        <Pencil className="w-3 h-3" /> Renommer
      </button>
      {modal}
    </>
  );
}
