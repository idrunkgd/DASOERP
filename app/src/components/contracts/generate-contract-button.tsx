"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus, X } from "lucide-react";
import { generateContractFromTemplate } from "@/server/actions/contracts";

/**
 * Bouton "Générer un contrat" affiché sur la fiche user / candidate.
 * Ouvre une popover avec sélection du template + dates optionnelles.
 */
export function GenerateContractButton({
  subject,
  templates
}: {
  subject: { kind: "user" | "candidate"; id: string; label: string };
  templates: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (templates.length === 0) {
    return (
      <span className="text-xs text-midnight-500 italic">
        Aucun template actif. Crée-en un dans /contracts d'abord.
      </span>
    );
  }

  function submit(fd: FormData) {
    if (subject.kind === "user") fd.set("userId", subject.id);
    else fd.set("candidateId", subject.id);
    start(async () => {
      try {
        const r = await generateContractFromTemplate(fd);
        toast.success(`Contrat ${r.reference} généré`);
        setOpen(false);
        router.push(`/contracts/${r.id}`);
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm text-xs"
      >
        <FilePlus className="w-3.5 h-3.5" /> Générer un contrat
      </button>
    );
  }

  return (
    <form action={submit} className="border border-indigoaccent/30 rounded-lg p-3 space-y-2 bg-indigoaccent/5 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium text-indigoaccent">
          Générer un contrat pour {subject.label}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-midnight-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div>
        <label className="label">Template *</label>
        <select name="templateId" required className="input text-xs">
          <option value="">— Choisir —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Début</label>
          <input name="startDate" type="date" className="input text-xs" />
        </div>
        <div>
          <label className="label">Fin</label>
          <input name="endDate" type="date" className="input text-xs" />
        </div>
      </div>
      <div>
        <label className="label">Titre personnalisé (optionnel)</label>
        <input name="title" placeholder="Auto si vide (nom du template + nom du sujet)" className="input text-xs" />
      </div>
      <div className="text-[10px] text-midnight-500">
        Les variables {"{{firstName}}"}, {"{{birthDate}}"}, {"{{monthlyNetPay}}"}, etc.
        seront remplacées par les données actuelles de {subject.label}.
      </div>
      <div className="flex justify-end pt-1">
        <button disabled={pending} className="btn-primary btn-sm text-xs">
          {pending ? "Génération…" : "Générer"}
        </button>
      </div>
    </form>
  );
}
