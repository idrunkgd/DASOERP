"use client";
import { useTransition } from "react";
import { deletePlanning } from "@/server/actions/planning";
import { Trash2 } from "lucide-react";

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => { if (window.confirm("Supprimer cette affectation ?")) start(async () => { await deletePlanning(id); }); }}
      className="text-danger hover:text-red-700"
    ><Trash2 className="w-4 h-4" /></button>
  );
}
