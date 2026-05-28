"use client";
// Formulaire de lancement d'un onboarding pour un user existant.
import { useState, useTransition } from "react";
import { createOnboardingForUser } from "@/server/actions/onboarding";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function NewOnboardingForm({
  users,
  templates
}: {
  users: { id: string; firstName: string; lastName: string; role: string }[];
  templates: { id: string; name: string; role: string | null }[];
}) {
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const selectedUser = users.find((u) => u.id === userId);
  // Si on a sélectionné un user, on suggère le template correspondant à son rôle.
  const suggestedTemplate =
    selectedUser &&
    templates.find((t) => t.role === selectedUser.role);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Sélectionne un utilisateur");
      return;
    }
    setError(null);
    start(async () => {
      try {
        await createOnboardingForUser(userId, startDate, {
          templateId: templateId || suggestedTemplate?.id || undefined
        });
        router.push(`/onboarding/${userId}`);
      } catch (e: any) {
        setError(e?.message || "Erreur lors de la création");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
    >
      <div>
        <label className="text-xs font-medium text-midnight-700">
          Utilisateur
        </label>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="input mt-1"
        >
          <option value="">— Choisir —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName} ({u.role})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-midnight-700">
          Date d'arrivée
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="input mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-midnight-700">
          Template
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="input mt-1"
        >
          <option value="">
            {suggestedTemplate
              ? `Auto (${suggestedTemplate.name})`
              : "Auto (générique)"}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.role ? ` — ${t.role}` : " — générique"}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !userId}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          {pending ? "..." : "Lancer"}
        </button>
      </div>
      {error && (
        <div className="md:col-span-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </form>
  );
}
