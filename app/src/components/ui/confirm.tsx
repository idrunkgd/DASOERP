"use client";
import { useState } from "react";

export function ConfirmButton({
  children, onConfirm, message = "Confirmer cette action ?", className
}: {
  children: React.ReactNode;
  onConfirm: () => Promise<void> | void;
  message?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className ?? "btn-danger btn-sm"}
      onClick={async () => {
        if (!window.confirm(message)) return;
        try { setBusy(true); await onConfirm(); } finally { setBusy(false); }
      }}
    >
      {children}
    </button>
  );
}
