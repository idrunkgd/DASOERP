"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updatePolicyMeta } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

/**
 * Formulaire d'édition inline des métadonnées d'une charte. NE touche pas
 * au PDF ni aux signatures — juste titre/description/catégorie/flags.
 */
export function EditMetaForm({
  documentId,
  initial
}: {
  documentId: string;
  initial: {
    title: string;
    description: string | null;
    category: string | null;
    mandatory: boolean;
    active: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    start(async () => {
      try {
        await updatePolicyMeta(documentId, fd);
        toast.success("Charte mise à jour");
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm w-full text-xs"
      >
        <Pencil className="w-3.5 h-3.5" /> Modifier les infos
      </button>
    );
  }

  return (
    <form action={submit} className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-indigoaccent">Modifier les infos</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-midnight-400 hover:text-midnight-700"
          aria-label="Annuler"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div>
        <label className="label text-[10px]">Titre</label>
        <input
          name="title"
          defaultValue={initial.title}
          required
          maxLength={200}
          className="input text-xs"
        />
      </div>
      <div>
        <label className="label text-[10px]">Catégorie</label>
        <input
          name="category"
          defaultValue={initial.category ?? ""}
          list="policy-categories-edit"
          placeholder="RH, IT, EPI, Sécurité…"
          className="input text-xs"
        />
        <datalist id="policy-categories-edit">
          <option value="RH" />
          <option value="IT" />
          <option value="Sécurité" />
          <option value="EPI" />
          <option value="Voiture" />
          <option value="Télétravail" />
        </datalist>
      </div>
      <div>
        <label className="label text-[10px]">Description</label>
        <textarea
          name="description"
          defaultValue={initial.description ?? ""}
          rows={3}
          className="input text-xs"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="mandatory" defaultChecked={initial.mandatory} />
        <span>Obligatoire</span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="active" defaultChecked={initial.active} />
        <span>Active (visible dans les listes)</span>
      </label>
      <button disabled={pending} className="btn-primary btn-sm w-full text-xs">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
