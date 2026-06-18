"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/tests/take/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigoaccent hover:underline"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Lien copié !" : "Copier le lien magique"}
    </button>
  );
}
