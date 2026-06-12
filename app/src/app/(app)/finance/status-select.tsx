"use client";
import { useTransition } from "react";
import { setMilestoneStatus } from "@/server/actions/offers";
import { toast } from "sonner";

const STATUSES = [
  { value: "PLANNED", label: "Prévue" },
  { value: "READY", label: "Prête" },
  { value: "INVOICED", label: "Facturée" },
  { value: "TRANSMITTED", label: "Transmise Peppol" },
  { value: "PAID", label: "Payée" },
  { value: "CANCELLED", label: "Annulée" }
];

export function MilestoneStatusSelect({ id, value }: { id: string; value: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value}
      disabled={pending}
      onChange={(e) => start(async () => {
        try { await setMilestoneStatus(id, e.target.value as any); toast.success("Statut mis à jour"); }
        catch (err: any) { toast.error(err.message); }
      })}
      className="input h-7 text-xs py-0"
    >
      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
    </select>
  );
}
