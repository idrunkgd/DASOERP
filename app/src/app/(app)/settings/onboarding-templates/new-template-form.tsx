"use client";
// Création rapide d'un template (nom + rôle facultatif). L'édition fine se
// fait sur la page détail [id] : items, offsets entretiens, description.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createOnboardingTemplate } from "@/server/actions/onboarding";
import { ROLE_LABELS } from "@/lib/rbac";

const ROLES = ["ADMIN", "MANAGER", "COMMERCIAL", "CONSULTANT", "FINANCE"] as const;

export function NewTemplateForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            await createOnboardingTemplate(fd);
            router.refresh();
            (document.getElementById("tpl-name") as HTMLInputElement)?.focus();
          } catch (e: any) {
            setError(e?.message || "Erreur");
          }
        });
      }}
      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
    >
      <div className="md:col-span-4">
        <label className="text-xs font-medium text-midnight-700">
          Nom <span className="text-red-600">*</span>
        </label>
        <input
          id="tpl-name"
          name="name"
          required
          maxLength={60}
          placeholder="Onboarding Consultant Senior"
          className="input mt-1"
        />
      </div>
      <div className="md:col-span-3">
        <label className="text-xs font-medium text-midnight-700">Rôle ciblé</label>
        <select name="role" className="input mt-1">
          <option value="">Générique (tout rôle)</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <label className="text-xs font-medium text-midnight-700">
          Entretiens J+ (CSV)
        </label>
        <input
          name="reviewOffsets"
          placeholder="1, 30, 90, 180"
          className="input mt-1 font-mono"
        />
      </div>
      <div className="md:col-span-2 flex gap-1">
        <button type="submit" disabled={pending} className="btn-primary">
          <Plus className="w-4 h-4" />
          {pending ? "..." : "Créer"}
        </button>
      </div>
      {error && (
        <div className="md:col-span-12 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </form>
  );
}
