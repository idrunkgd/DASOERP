"use client";
/**
 * Bloc "Déclarer un arrêt maladie" sur la page /me.
 * L'utilisateur choisit une période (start/end) + optionnellement une raison
 * + un certificat médical scanné (image ou PDF, base64 inline).
 *
 * Pas d'approbation : la déclaration est factuelle. Un fois postée, elle
 * apparaît directement dans le dashboard et badge le consultant en rouge
 * "Maladie" pendant la période active.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { createSickLeave, deleteSickLeave } from "@/server/actions/sick-leave";

type ExistingLeave = {
  id: string;
  startDate: string;    // ISO
  endDate: string;      // ISO
  reason: string | null;
  certificateUrl: string | null;
  isActive: boolean;
};

export function SickLeaveBlock({
  existingLeaves
}: {
  existingLeaves: ExistingLeave[];
}) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [certificateDataUri, setCertificateDataUri] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    startDate: today,
    endDate: today,
    reason: ""
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 4MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCertificateDataUri(reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit(fd: FormData) {
    if (certificateDataUri) fd.set("certificateUrl", certificateDataUri);
    start(async () => {
      try {
        await createSickLeave(fd);
        toast.success("Arrêt maladie déclaré");
        setShowForm(false);
        setCertificateDataUri(null);
        setForm({ startDate: today, endDate: today, reason: "" });
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Supprimer cet arrêt ?")) return;
    start(async () => {
      try {
        await deleteSickLeave(id);
        toast.success("Supprimé");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  const activeLeave = existingLeaves.find((l) => l.isActive);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Arrêts maladie</h3>
          <p className="text-xs text-midnight-500">
            Déclare une absence avec certificat médical en pièce jointe.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-secondary text-sm"
          >
            Déclarer un arrêt
          </button>
        )}
      </div>

      {activeLeave && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm">
          <span className="font-semibold text-red-700">🩺 Actuellement en arrêt</span>
          <span className="text-red-600 ml-1">
            jusqu'au {new Date(activeLeave.endDate).toLocaleDateString("fr-BE")}
          </span>
        </div>
      )}

      {showForm && (
        <form action={submit} className="space-y-3 mb-4 bg-midnight-50/50 p-3 rounded">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input
                name="startDate" type="date" required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Fin</label>
              <input
                name="endDate" type="date" required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Raison (optionnel)</label>
            <input
              name="reason" type="text" maxLength={200}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="input"
              placeholder="Grippe, RDV médical, etc."
            />
          </div>
          <div>
            <label className="label">Certificat médical</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-midnight-300 rounded p-4 cursor-pointer hover:border-indigoaccent">
              {certificateDataUri ? (
                certificateDataUri.startsWith("data:image/") ? (
                  <img src={certificateDataUri} alt="" className="max-h-32 rounded" />
                ) : (
                  <span className="text-sm text-emerald-700">Fichier chargé ✓</span>
                )
              ) : (
                <span className="text-sm text-midnight-500 flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Photo ou PDF du certif (max 4MB)
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={onFile}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary text-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={pending}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Déclarer"}
            </button>
          </div>
        </form>
      )}

      {/* Historique */}
      {existingLeaves.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-midnight-500 uppercase mb-2">
            Historique
          </div>
          <ul className="space-y-1.5">
            {existingLeaves.map((l) => (
              <li
                key={l.id}
                className={
                  "flex items-center justify-between gap-2 text-sm px-2 py-1.5 rounded border " +
                  (l.isActive
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-midnight-200")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {new Date(l.startDate).toLocaleDateString("fr-BE")}
                      {" → "}
                      {new Date(l.endDate).toLocaleDateString("fr-BE")}
                    </span>
                    {l.isActive && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded uppercase font-semibold">
                        Actif
                      </span>
                    )}
                  </div>
                  {l.reason && (
                    <div className="text-xs text-midnight-500 truncate">{l.reason}</div>
                  )}
                </div>
                {l.certificateUrl && (
                  <a
                    href={l.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigoaccent hover:underline"
                  >
                    certif
                  </a>
                )}
                <button
                  onClick={() => remove(l.id)}
                  className="text-midnight-400 hover:text-red-600 p-1"
                  title="Supprimer"
                  disabled={pending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
