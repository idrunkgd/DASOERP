"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, X } from "lucide-react";
import { createTest } from "@/server/actions/tests";

const DOMAINS = [
  { value: "ELEC_INDUSTRIAL",     label: "Électricité industrielle" },
  { value: "PLC",                 label: "PLC (Siemens / Schneider)" },
  { value: "DATA_MANAGER",        label: "Data Manager (SCADA, Historian)" },
  { value: "IT_INDUSTRIAL",       label: "IT industriel (OpenShift, MQTT)" },
  { value: "CYBERSEC_INDUSTRIAL", label: "Cybersécurité OT" },
  { value: "OTHER",               label: "Autre (libre)" }
] as const;

export function CreateTestButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    domain: "OTHER" as (typeof DOMAINS)[number]["value"],
    title: "",
    description: ""
  });

  function submit() {
    if (form.title.trim().length < 3) {
      toast.error("Le titre doit faire au moins 3 caractères");
      return;
    }
    start(async () => {
      try {
        const r = await createTest({
          domain: form.domain,
          title: form.title.trim(),
          description: form.description.trim() || null
        });
        toast.success("Test créé");
        setOpen(false);
        // Direction immédiate vers l'éditeur pour ajouter les questions
        router.push(`/tests/${r.id}/edit`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" /> Nouveau test
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-midnight-900">Créer un nouveau test</h2>
              <button onClick={() => setOpen(false)} className="text-midnight-500 hover:text-midnight-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Domaine</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value as typeof form.domain })}
                  className="input"
                >
                  {DOMAINS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Titre du test</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Évaluation cybersec niveau senior"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Description (optionnel)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brève description du contenu et de la cible..."
                  rows={3}
                  className="input min-h-[80px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
              <button onClick={() => setOpen(false)} disabled={pending} className="btn-ghost">
                Annuler
              </button>
              <button onClick={submit} disabled={pending} className="btn-primary">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer le test
              </button>
            </div>
            <p className="text-[11px] text-midnight-500 mt-3">
              Après création, tu seras redirigé vers l'éditeur pour ajouter les questions.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
