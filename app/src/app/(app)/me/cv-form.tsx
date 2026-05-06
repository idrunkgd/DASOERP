"use client";
import { useState, useTransition } from "react";
import { updateMyCv } from "@/server/actions/candidate-self";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { SkillsPicker } from "@/components/forms/skills-picker";
import { Upload, X } from "lucide-react";

type Initial = {
  id: string; firstName: string; lastName: string;
  photoUrl: string | null; phone: string | null; linkedinUrl: string | null;
  city: string | null; seniority: string | null; yearsExperience: number | null;
  spokenLanguages: string[]; skills: string[];
  availableFrom: Date | string | null;
};

export function CandidateCvForm({
  candidateId, initial, skillCatalog
}: {
  candidateId: string;
  initial: Initial;
  skillCatalog: { id: string; name: string; category: string | null }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string>(initial.photoUrl ?? "");

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 800 * 1024) { toast.error("Image trop lourde — max 800 KB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Sélectionnez une image"); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <form
      action={(fd) => start(async () => {
        try { await updateMyCv(fd); toast.success("CV mis à jour — merci !"); router.refresh(); }
        catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-5"
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="photoUrl" value={photoUrl} />

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Photo de profil</h2>
        <div className="flex items-center gap-4">
          <PersonAvatar firstName={initial.firstName} lastName={initial.lastName} photoUrl={photoUrl || null} size={88} className="rounded-xl" />
          <div>
            <div className="flex items-center gap-2">
              <label className="btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3 h-3" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </label>
              {photoUrl && <button type="button" onClick={() => setPhotoUrl("")} className="btn-ghost btn-sm"><X className="w-3 h-3" /></button>}
            </div>
            <input type="url" value={photoUrl.startsWith("data:") ? "" : photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="ou URL https://..." className="input mt-2 text-xs h-8 max-w-[280px]" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Coordonnées</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className="label">Téléphone</label><input name="phone" defaultValue={initial.phone ?? ""} className="input" /></div>
          <div className="col-span-6"><label className="label">LinkedIn</label><input name="linkedinUrl" defaultValue={initial.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/..." className="input" /></div>
          <div className="col-span-6"><label className="label">Ville</label><input name="city" defaultValue={initial.city ?? ""} className="input" /></div>
          <div className="col-span-6"><label className="label">Disponible à partir du</label><input name="availableFrom" type="date" defaultValue={initial.availableFrom ? new Date(initial.availableFrom).toISOString().slice(0,10) : ""} className="input" /></div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Expérience</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className="label">Niveau / séniorité</label><input name="seniority" defaultValue={initial.seniority ?? ""} placeholder="Junior / Confirmé / Senior / Lead..." className="input" /></div>
          <div className="col-span-6"><label className="label">Années d'expérience</label><input name="yearsExperience" type="number" min="0" defaultValue={initial.yearsExperience ?? ""} className="input" /></div>
          <div className="col-span-12"><label className="label">Langues parlées (séparées par virgule)</label><input name="spokenLanguages" defaultValue={(initial.spokenLanguages ?? []).join(", ")} className="input" placeholder="FR, EN, NL..." /></div>
          <div className="col-span-12">
            <SkillsPicker name="skills" catalog={skillCatalog} initial={initial.skills ?? []} label="Compétences techniques et fonctionnelles" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Mot de passe</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className="label">Mot de passe actuel</label><input name="currentPassword" type="password" autoComplete="current-password" className="input" /></div>
          <div className="col-span-6"><label className="label">Nouveau mot de passe (8 car. min)</label><input name="newPassword" type="password" autoComplete="new-password" className="input" /></div>
          <p className="col-span-12 text-xs text-midnight-500">Laissez vide pour conserver le mot de passe actuel.</p>
        </div>
      </section>

      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "Enregistrement..." : "Enregistrer mon CV"}</button>
      </div>
    </form>
  );
}
