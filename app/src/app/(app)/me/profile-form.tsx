"use client";
import { useState, useTransition } from "react";
import { updateMyProfile } from "@/server/actions/profile";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { SkillsPicker } from "@/components/forms/skills-picker";
import { Upload, X, Plus, Trash2 } from "lucide-react";

type Training = {
  institution: string;
  title: string;
  period: string | null;
  description: string | null;
};

function TrainingsEditor({ initial }: { initial: Training[] }) {
  const [list, setList] = useState<Training[]>(initial);
  function add() {
    setList((l) => [...l, { institution: "", title: "", period: "", description: "" }]);
  }
  function update(i: number, patch: Partial<Training>) {
    setList((l) => l.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    setList((l) => l.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {/* Serializé en JSON dans un seul champ caché pour envoi via FormData */}
      <input type="hidden" name="trainings" value={JSON.stringify(list)} />
      {list.length === 0 && (
        <p className="text-xs text-midnight-500 italic">Aucune formation. Clique "+ Ajouter" pour commencer.</p>
      )}
      {list.map((t, i) => (
        <div key={i} className="card p-3 bg-midnight-50/40 border-border/60 grid grid-cols-12 gap-2 items-start">
          <input value={t.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Intitulé (ex: Bachelier info industrielle)" className="input col-span-5 text-xs h-8" />
          <input value={t.institution} onChange={(e) => update(i, { institution: e.target.value })} placeholder="École / organisme" className="input col-span-4 text-xs h-8" />
          <input value={t.period ?? ""} onChange={(e) => update(i, { period: e.target.value })} placeholder="2010-2013" className="input col-span-2 text-xs h-8" />
          <button type="button" onClick={() => remove(i)} className="btn-ghost btn-sm col-span-1 text-red-600" aria-label="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
          <input value={t.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} placeholder="Détails (optionnel)" className="input col-span-11 text-xs h-8" />
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Ajouter une formation</button>
    </div>
  );
}

export function ProfileForm({ initial, skillCatalog }: { initial: any; skillCatalog: { id: string; name: string; category: string | null }[] }) {
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
        try { await updateMyProfile(fd); toast.success("Profil mis à jour"); router.refresh(); }
        catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-5"
    >
      <input type="hidden" name="photoUrl" value={photoUrl} />

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Photo</h2>
        <div className="flex items-center gap-4">
          <PersonAvatar firstName={initial.firstName} lastName={initial.lastName} photoUrl={photoUrl || null} size={88} className="rounded-xl" />
          <div>
            <div className="flex items-center gap-2">
              <label className="btn-secondary btn-sm cursor-pointer">
                <Upload className="w-3 h-3" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              </label>
              {photoUrl && <button type="button" onClick={() => setPhotoUrl("")} className="btn-ghost btn-sm"><X className="w-3 h-3" /> Retirer</button>}
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
          <div className="col-span-6"><label className="label">Langues parlées (virgule)</label><input name="spokenLanguages" defaultValue={(initial.spokenLanguages ?? []).join(", ")} className="input" placeholder="FR, EN, NL..." /></div>
          <div className="col-span-12">
            <SkillsPicker name="skills" catalog={skillCatalog} initial={initial.skills ?? []} />
          </div>
          <div className="col-span-12">
            <label className="label">Centres d'intérêt (virgule)</label>
            <input name="interests" defaultValue={(initial.interests ?? []).join(", ")} className="input" placeholder="Course à pied, lecture, drone, ..." />
            <p className="text-[11px] text-midnight-500 mt-1">Affichés sur le CV, en bas.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">
          Point de contact pour le CV
        </h2>
        <p className="text-xs text-midnight-500 mb-3">
          Si renseigné, le CV affichera ces coordonnées au lieu des tiennes.
          Laisse vide pour exposer tes propres coordonnées.
        </p>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className="label">Nom du contact</label><input name="cvContactName" defaultValue={initial.cvContactName ?? ""} className="input" placeholder="Louise Dupont" /></div>
          <div className="col-span-6"><label className="label">Fonction</label><input name="cvContactRole" defaultValue={initial.cvContactRole ?? ""} className="input" placeholder="Operations Manager" /></div>
          <div className="col-span-6"><label className="label">Email</label><input name="cvContactEmail" type="email" defaultValue={initial.cvContactEmail ?? ""} className="input" placeholder="louise@dasolabs.be" /></div>
          <div className="col-span-6"><label className="label">Téléphone</label><input name="cvContactPhone" defaultValue={initial.cvContactPhone ?? ""} className="input" placeholder="+32 ..." /></div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">
          Formations & certifications
        </h2>
        <p className="text-xs text-midnight-500 mb-3">
          Diplômes, écoles, certifications (ex: AVEVA, Siemens TIA). Affichés sur le CV.
        </p>
        <TrainingsEditor initial={initial.trainings ?? []} />
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-midnight-500">Mot de passe</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6"><label className="label">Mot de passe actuel</label><input name="currentPassword" type="password" autoComplete="current-password" className="input" /></div>
          <div className="col-span-6"><label className="label">Nouveau mot de passe (8 car. min)</label><input name="newPassword" type="password" autoComplete="new-password" className="input" /></div>
          <p className="col-span-12 text-xs text-midnight-500">Laissez vide pour ne pas changer.</p>
        </div>
      </section>

      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "..." : "Enregistrer"}</button>
      </div>
    </form>
  );
}
