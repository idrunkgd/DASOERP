"use client";
import { useState, useTransition } from "react";
import { createUserAction, updateUserAction, setUserActive } from "@/server/actions/users";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { SkillsPicker } from "@/components/forms/skills-picker";
import { Upload, X } from "lucide-react";

type SkillCatalogEntry = { id: string; name: string; category: string | null };

export function UserForm({ initial, skillCatalog = [] }: { initial?: any; skillCatalog?: SkillCatalogEntry[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string>(initial?.photoUrl ?? "");

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
        try {
          if (initial?.id) { await updateUserAction(initial.id, fd); toast.success("Utilisateur mis à jour"); router.refresh(); }
          else { await createUserAction(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 max-w-3xl space-y-4"
    >
      <input type="hidden" name="photoUrl" value={photoUrl} />
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <PersonAvatar firstName={initial?.firstName ?? ""} lastName={initial?.lastName ?? ""} photoUrl={photoUrl || null} size={120} className="rounded-xl" />
          <div className="mt-2 flex items-center gap-2">
            <label className="btn-secondary btn-sm cursor-pointer">
              <Upload className="w-3 h-3" /> <span>Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </label>
            {photoUrl && <button type="button" onClick={() => setPhotoUrl("")} className="btn-ghost btn-sm"><X className="w-3 h-3" /></button>}
          </div>
          <input
            type="url"
            value={photoUrl.startsWith("data:") ? "" : photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="URL externe..."
            className="input mt-2 text-xs h-8 max-w-[120px]"
          />
        </div>
        <div className="grid grid-cols-12 gap-4 flex-1">
          <div className="col-span-6"><label className="label">Prénom *</label><input name="firstName" defaultValue={initial?.firstName ?? ""} required className="input" /></div>
          <div className="col-span-6"><label className="label">Nom *</label><input name="lastName" defaultValue={initial?.lastName ?? ""} required className="input" /></div>
          <div className="col-span-6"><label className="label">Email *</label><input name="email" type="email" defaultValue={initial?.email ?? ""} required className="input" /></div>
          <div className="col-span-6">
            <label className="label">Rôle (fonction métier)</label>
            <select name="role" defaultValue={initial?.role ?? "CONSULTANT"} className="input">
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="CONSULTANT">Consultant</option>
              <option value="FINANCE">Finance</option>
            </select>
            <p className="text-[11px] text-midnight-500 mt-1">Indication métier seulement. Les <a href="/access" className="text-indigoaccent hover:underline">droits d'accès</a> sont gérés via les groupes.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6"><label className="label">Téléphone</label><input name="phone" defaultValue={initial?.phone ?? ""} className="input" /></div>
        <div className="col-span-6"><label className="label">LinkedIn</label><input name="linkedinUrl" defaultValue={initial?.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/..." className="input" /></div>
        <div className="col-span-3"><label className="label">Ville</label><input name="city" defaultValue={initial?.city ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Séniorité</label><input name="seniority" defaultValue={initial?.seniority ?? ""} placeholder="Junior / Senior / Lead" className="input" /></div>
        <div className="col-span-3"><label className="label">Années d'XP</label><input name="yearsExperience" type="number" defaultValue={initial?.yearsExperience ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Capacité hebdo (h)</label><input name="weeklyCapacityH" type="number" step="0.5" defaultValue={initial?.weeklyCapacityH ?? 38} className="input" /></div>
        <div className="col-span-12">
          <SkillsPicker name="skills" catalog={skillCatalog} initial={initial?.skills ?? []} />
        </div>
        <div className="col-span-12"><label className="label">Langues parlées (séparées par virgule)</label><input name="spokenLanguages" defaultValue={(initial?.spokenLanguages ?? []).join(", ")} className="input" placeholder="FR, EN, NL..." /></div>
        <div className="col-span-3"><label className="label">Cout / h (€)</label><input name="hourlyCost" type="number" step="0.01" defaultValue={initial?.hourlyCost ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Cout / j (€)</label><input name="dailyCost" type="number" step="0.01" defaultValue={initial?.dailyCost ?? ""} className="input" /></div>
        <div className="col-span-3"><label className="label" title="Taux vendu au client, affiché sur le CV">Taux facturable / j (€)</label><input name="dailyRate" type="number" step="0.01" defaultValue={initial?.dailyRate ?? ""} className="input" placeholder="Affiché sur le CV" /></div>
        <div className="col-span-3"><label className="label">Date d'entrée</label><input name="joinedAt" type="date" defaultValue={initial?.joinedAt ? new Date(initial.joinedAt).toISOString().slice(0,10) : ""} className="input" /></div>
        <div className="col-span-3"><label className="label">Date de sortie</label><input name="leftAt" type="date" defaultValue={initial?.leftAt ? new Date(initial.leftAt).toISOString().slice(0,10) : ""} className="input" /></div>
        <div className="col-span-6">
          <label className="label">{initial?.id ? "Nouveau mot de passe (optionnel)" : "Mot de passe initial *"}</label>
          <input name="password" type="password" {...(!initial?.id ? { required: true } : {})} placeholder="8 caractères min." className="input" />
        </div>
        <div className="col-span-6">
          <label className="label">Statut</label>
          <select name="active" defaultValue={initial?.active === false ? "false" : "true"} className="input">
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between">
        {initial?.id && (
          <button type="button"
            onClick={() => start(async () => { await setUserActive(initial.id, !initial.active); toast.success("Statut mis à jour"); router.refresh(); })}
            className="btn-secondary btn-sm">{initial.active ? "Désactiver" : "Réactiver"}</button>
        )}
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
