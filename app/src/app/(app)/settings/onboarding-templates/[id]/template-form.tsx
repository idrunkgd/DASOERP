"use client";
// Édition des champs principaux du template + suppression.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  updateOnboardingTemplate,
  deleteOnboardingTemplate
} from "@/server/actions/onboarding";
import { ROLE_LABELS } from "@/lib/rbac";

const ROLES = ["ADMIN", "MANAGER", "COMMERCIAL", "CONSULTANT", "FINANCE"] as const;

type Tpl = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  active: boolean;
  reviewOffsets: number[];
};

export function TemplateForm({ template }: { template: Tpl }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onDelete() {
    if (
      !confirm(
        `Supprimer le template « ${template.name} » ?\nLes onboardings déjà créés ne seront pas affectés (le lien sera mis à null).`
      )
    )
      return;
    start(async () => {
      try {
        await deleteOnboardingTemplate(template.id);
        router.push("/settings/onboarding-templates");
      } catch (e: any) {
        setError(e?.message || "Erreur");
      }
    });
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            await updateOnboardingTemplate(template.id, fd);
            router.refresh();
          } catch (e: any) {
            setError(e?.message || "Erreur");
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-medium text-midnight-700">
          Nom <span className="text-red-600">*</span>
        </label>
        <input
          name="name"
          defaultValue={template.name}
          required
          maxLength={60}
          className="input mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-midnight-700">Rôle ciblé</label>
        <select
          name="role"
          defaultValue={template.role ?? ""}
          className="input mt-1"
        >
          <option value="">Générique (tout rôle)</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-midnight-700">
          Entretiens (jours après arrivée)
        </label>
        <input
          name="reviewOffsets"
          defaultValue={template.reviewOffsets.join(", ")}
          placeholder="1, 30, 90, 180"
          className="input mt-1 font-mono"
        />
        <p className="text-[10px] text-midnight-400 mt-1">
          CSV de jours. Le 1er = ONBOARDING, les suivants = CHECK_IN.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium text-midnight-700">Description</label>
        <textarea
          name="description"
          defaultValue={template.description ?? ""}
          rows={3}
          className="input mt-1 resize-y"
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={template.active}
        />
        Actif
      </label>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-midnight-100">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="text-xs text-red-700 hover:text-red-900 flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Supprimer
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
