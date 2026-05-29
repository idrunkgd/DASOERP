"use client";
// Bouton de suppression avec confirmation. Client component séparé parce
// qu'on ne peut pas mettre d'onClick inline dans un server component.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "@/server/actions/documents";

export function DeleteDocumentButton({
  documentId,
  title,
  versionCount
}: {
  documentId: string;
  title: string;
  versionCount: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    const msg =
      versionCount > 0
        ? `Supprimer définitivement « ${title} » et ses ${versionCount} version(s) ?`
        : `Supprimer définitivement « ${title} » ?`;
    if (!confirm(msg)) return;
    start(async () => {
      try {
        await deleteDocument(documentId);
        router.push("/documents");
      } catch (e: any) {
        alert(e?.message || "Erreur lors de la suppression");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs text-red-700 hover:text-red-900 w-full text-left"
    >
      {pending
        ? "Suppression…"
        : versionCount > 0
          ? `Supprimer ce document (et ses ${versionCount} version(s))`
          : "Supprimer ce document"}
    </button>
  );
}
