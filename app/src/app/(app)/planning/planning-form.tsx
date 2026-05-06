"use client";
import { useTransition } from "react";
import { createPlanning } from "@/server/actions/planning";
import { toast } from "sonner";

const ACTIVITIES = [
  { value: "DEVELOPMENT", label: "Développement" },
  { value: "ANALYSIS", label: "Analyse" },
  { value: "PROJECT_MANAGEMENT", label: "Gestion projet" },
  { value: "MEETING", label: "Réunion" },
  { value: "SUPPORT", label: "Support" },
  { value: "TRAINING", label: "Formation" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "ADMINISTRATIVE", label: "Administratif" },
  { value: "OTHER", label: "Autre" }
];

export function PlanningForm({
  users, projects
}: { users: { id: string; firstName: string; lastName: string }[]; projects: { id: string; name: string; reference: string; company: { name: string } }[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        try { await createPlanning(fd); toast.success("Affectation créée"); (document.getElementById("plan-form") as HTMLFormElement)?.reset(); }
        catch (e: any) { toast.error(e.message); }
      })}
      id="plan-form"
      className="grid grid-cols-12 gap-3 items-end"
    >
      <div className="col-span-3">
        <label className="label">Utilisateur</label>
        <select name="userId" required className="input">
          <option value="">— Choisir —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
      </div>
      <div className="col-span-3">
        <label className="label">Projet</label>
        <select name="projectId" required className="input">
          <option value="">— Choisir —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="label">Du</label>
        <input name="startDate" type="date" required className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Au</label>
        <input name="endDate" type="date" required className="input" />
      </div>
      <div className="col-span-1">
        <label className="label">h/jour</label>
        <input name="hoursPerDay" type="number" step="0.5" placeholder="ex: 6" className="input" />
      </div>
      <div className="col-span-1">
        <label className="label">% charge</label>
        <input name="loadPct" type="number" step="1" placeholder="ex: 80" className="input" />
      </div>
      <div className="col-span-2">
        <label className="label">Type</label>
        <select name="activityType" defaultValue="DEVELOPMENT" className="input">
          {ACTIVITIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <div className="col-span-9">
        <label className="label">Commentaire</label>
        <input name="comment" className="input" />
      </div>
      <div className="col-span-1">
        <button disabled={pending} className="btn-primary w-full">{pending ? "..." : "Ajouter"}</button>
      </div>
    </form>
  );
}
