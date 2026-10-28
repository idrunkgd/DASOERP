"use client";
import { useTransition, useState } from "react";
import { createCandidate, updateCandidate, deleteCandidate } from "@/server/actions/candidates";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CandidateAvatar } from "./avatar";
import { SkillsPicker } from "@/components/forms/skills-picker";
import { Upload, X } from "lucide-react";

type SkillCatalogEntry = { id: string; name: string; category: string | null };

export function CandidateForm({ initial, skillCatalog = [] }: { initial?: any; skillCatalog?: SkillCatalogEntry[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string>(initial?.photoUrl ?? "");

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 800 * 1024) {
      toast.error("Image trop lourde — max 800 KB. Compressez-la d'abord.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) { await updateCandidate(initial.id, fd); toast.success("Candidat mis à jour"); router.refresh(); }
          else { await createCandidate(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 max-w-3xl space-y-4"
    >
      <input type="hidden" name="photoUrl" value={photoUrl} />
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <CandidateAvatar
            firstName={initial?.firstName ?? ""}
            lastName={initial?.lastName ?? ""}
            photoUrl={photoUrl || null}
            size={120}
            className="rounded-xl"
          />
          <div className="mt-2 flex items-center gap-2">
            <label className="btn-secondary btn-sm cursor-pointer">
              <Upload className="w-3 h-3" />
              <span>Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </label>
            {photoUrl && (
              <button type="button" onClick={() => setPhotoUrl("")} className="btn-ghost btn-sm" title="Retirer la photo">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-midnight-500 mt-1 max-w-[120px]">URL externe ou upload (≤ 800 KB)</p>
          <input
            type="url"
            value={photoUrl.startsWith("data:") ? "" : photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="input mt-2 text-xs h-8 max-w-[120px]"
          />
        </div>
        <div className="grid grid-cols-12 gap-4 flex-1">
          <div className="col-span-6"><label className="label">Prénom *</label><input name="firstName" defaultValue={initial?.firstName ?? ""} required className="input" /></div>
          <div className="col-span-6"><label className="label">Nom *</label><input name="lastName" defaultValue={initial?.lastName ?? ""} required className="input" /></div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6"><label className="label">Email</label><input name="email" type="email" defaultValue={initial?.email ?? ""} className="input" /></div>
        <div className="col-span-6"><label className="label">Téléphone</label><input name="phone" defaultValue={initial?.phone ?? ""} className="input" /></div>
        <div className="col-span-6"><label className="label">LinkedIn</label><input name="linkedinUrl" defaultValue={initial?.linkedinUrl ?? ""} className="input" placeholder="https://linkedin.com/in/..." /></div>
        <div className="col-span-3"><label className="label">Ville</label><input name="city" defaultValue={initial?.city ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Source</label><input name="source" defaultValue={initial?.source ?? ""} className="input" placeholder="LinkedIn, recommandation..." /></div>
        <div className="col-span-3"><label className="label">Séniorité</label><input name="seniority" defaultValue={initial?.seniority ?? ""} className="input" placeholder="Junior / Senior / Lead" /></div>
        <div className="col-span-3"><label className="label">Années d'expérience</label><input name="yearsExperience" type="number" defaultValue={initial?.yearsExperience ?? ""} className="input" /></div>
        <div className="col-span-12">
          <SkillsPicker name="skills" catalog={skillCatalog} initial={initial?.skills ?? []} />
        </div>
        <div className="col-span-12"><label className="label">Langues parlées (séparées par virgule)</label><input name="spokenLanguages" defaultValue={(initial?.spokenLanguages ?? []).join(", ")} className="input" placeholder="FR, EN, NL..." /></div>
        <div className="col-span-3"><label className="label">Cout / j (€)</label><input name="dailyCost" type="number" step="0.01" defaultValue={initial?.dailyCost ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Cout / h (€)</label><input name="hourlyCost" type="number" step="0.01" defaultValue={initial?.hourlyCost ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Tarif min souhaité / j</label><input name="minDailyRate" type="number" step="0.01" defaultValue={initial?.minDailyRate ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label" title="Taux vendu au client, affiché sur le CV">Taux facturable / j (€)</label><input name="dailyRate" type="number" step="0.01" defaultValue={initial?.dailyRate ?? ""} className="input" placeholder="Affiché sur le CV" /></div>
        <div className="col-span-3">
          <label className="label">Type de contrat</label>
          <select name="contractType" defaultValue={initial?.contractType ?? ""} className="input">
            <option value="">— Non défini —</option>
            <option value="EMPLOYEE">Employé Dasolabs</option>
            <option value="FREELANCE">Freelance / sous-traitant</option>
          </select>
        </div>
        <div className="col-span-3">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "ACTIVE"} className="input">
            <option value="ACTIVE">Actif</option>
            <option value="ENGAGED">En mission</option>
            <option value="UNAVAILABLE">Indisponible</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
        <div className="col-span-6"><label className="label">Disponible à partir du</label><input name="availableFrom" type="date" defaultValue={initial?.availableFrom ? new Date(initial.availableFrom).toISOString().slice(0,10) : ""} className="input" /></div>
        <div className="col-span-12"><label className="label">Notes</label><textarea name="notes" defaultValue={initial?.notes ?? ""} className="input min-h-[80px] py-2" /></div>
      </div>
      <div className="flex justify-between">
        {initial?.id ? (
          <button type="button"
            onClick={() => { if (window.confirm("Supprimer ce candidat ?")) start(async () => { await deleteCandidate(initial.id); }); }}
            className="btn-danger btn-sm"
          >Supprimer</button>
        ) : <span />}
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
