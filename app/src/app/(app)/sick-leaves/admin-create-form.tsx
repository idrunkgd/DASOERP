"use client";
/**
 * Formulaire "Déclarer un arrêt pour quelqu'un d'autre" — réservé à users.manage.
 * Affiché sur /sick-leaves. Un admin choisit le consultant cible, la période,
 * une raison optionnelle et peut joindre un certificat scanné.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Plus, X } from "lucide-react";
import { createSickLeave } from "@/server/actions/sick-leave";

type UserOption = { id: string; firstName: string; lastName: string; email: string };

export function AdminCreateSickLeaveForm({ users }: { users: UserOption[] }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    userId: "",
    startDate: today,
    endDate: today,
    reason: "",
    notes: ""
  });
  const [certificateDataUri, setCertificateDataUri] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 4 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCertificateDataUri(reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit(fd: FormData) {
    if (!form.userId) {
      toast.error("Choisis un utilisateur");
      return;
    }
    fd.set("userId", form.userId);
    if (certificateDataUri) fd.set("certificateUrl", certificateDataUri);
    start(async () => {
      try {
        await createSickLeave(fd);
        toast.success("Arrêt maladie déclaré");
        setOpen(false);
        setForm({ userId: "", startDate: today, endDate: today, reason: "", notes: "" });
        setCertificateDataUri(null);
      } catch (err: any) {
        toast.error(err.message || "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button className="btn-primary text-sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4" /> Déclarer pour un consultant
      </button>
    );
  }

  return (
    <div className="card p-5 mb-4 border-l-4 border-red-500">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-midnight-900">Déclarer un arrêt maladie pour un consultant</h3>
        <button
          type="button"
          className="text-midnight-400 hover:text-midnight-700"
          onClick={() => setOpen(false)}
          aria-label="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <form action={submit} className="space-y-3">
        <div>
          <label className="text-xs text-midnight-500 block mb-1">Consultant</label>
          <select
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            className="input"
            required
          >
            <option value="">— Choisir —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} · {u.email}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-midnight-500 block mb-1">Début</label>
            <input
              name="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="text-xs text-midnight-500 block mb-1">Fin</label>
            <input
              name="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="input"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-midnight-500 block mb-1">Raison (optionnel)</label>
          <input
            name="reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="input"
            placeholder="Ex : grippe, arrêt post-op…"
            maxLength={500}
          />
        </div>
        <div>
          <label className="text-xs text-midnight-500 block mb-1">Notes internes (optionnel)</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input"
            rows={2}
            maxLength={1000}
            placeholder="Notes RH internes, non visibles par le consultant."
          />
        </div>
        <div>
          <label className="text-xs text-midnight-500 block mb-1">Certificat médical (image ou PDF, max 4 Mo)</label>
          {certificateDataUri ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <span>Certificat prêt à envoyer.</span>
              <button
                type="button"
                onClick={() => setCertificateDataUri(null)}
                className="text-red-600 hover:underline text-xs inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> retirer
              </button>
            </div>
          ) : (
            <label className="btn-secondary cursor-pointer inline-flex text-sm">
              <Upload className="w-4 h-4" />
              Charger un fichier
              <input type="file" accept="image/*,application/pdf" onChange={onFile} className="hidden" />
            </label>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Annuler
          </button>
          <button className="btn-primary text-sm" disabled={pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Déclarer l'arrêt
          </button>
        </div>
      </form>
    </div>
  );
}
