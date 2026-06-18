"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { assignTest } from "@/server/actions/tests";

type Option = { id: string; label: string };

export function AssignForm({
  testId,
  users,
  candidates
}: {
  testId: string;
  users: Option[];
  candidates: Option[];
}) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"user" | "candidate">("candidate");
  const [targetId, setTargetId] = useState<string>("");
  const [days, setDays] = useState<string>("14");
  const [magicUrl, setMagicUrl] = useState<string | null>(null);

  function go() {
    if (!targetId) {
      toast.error("Sélectionne une personne");
      return;
    }
    const fd = new FormData();
    fd.set("testId", testId);
    if (mode === "user") fd.set("userId", targetId);
    else fd.set("candidateId", targetId);
    fd.set("expiresInDays", days);
    start(async () => {
      try {
        const r = await assignTest(fd);
        toast.success("Assignation créée");
        if (mode === "candidate") {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setMagicUrl(`${origin}/tests/take/${r.magicToken}`);
        } else {
          setMagicUrl(null);
        }
        setTargetId("");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  const options = mode === "user" ? users : candidates;

  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="label">Cible</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setMode("candidate"); setTargetId(""); }}
            className={
              "flex-1 py-1.5 rounded-md text-xs font-medium border " +
              (mode === "candidate"
                ? "bg-indigoaccent text-white border-indigoaccent"
                : "bg-white text-midnight-700 border-border hover:bg-midnight-50")
            }
          >
            Candidat externe
          </button>
          <button
            type="button"
            onClick={() => { setMode("user"); setTargetId(""); }}
            className={
              "flex-1 py-1.5 rounded-md text-xs font-medium border " +
              (mode === "user"
                ? "bg-indigoaccent text-white border-indigoaccent"
                : "bg-white text-midnight-700 border-border hover:bg-midnight-50")
            }
          >
            Consultant interne
          </button>
        </div>
        <p className="text-[11px] text-midnight-500 mt-1">
          {mode === "candidate"
            ? "Le candidat reçoit un lien magique unique, sans création de compte."
            : "Le consultant accède au test depuis Mon profil → Mes tests."}
        </p>
      </div>

      <div>
        <label className="label">Personne</label>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="input"
        >
          <option value="">— Sélectionner —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Validité (jours)</label>
        <input
          type="number"
          min={1}
          max={180}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="input"
        />
      </div>

      <button onClick={go} disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Assigner le test
      </button>

      {magicUrl && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
          <div className="font-medium text-emerald-900 mb-1">
            Lien magique généré
          </div>
          <p className="text-emerald-800 mb-2">
            Copie ce lien et envoie-le au candidat (pas de compte requis). Il est valide pendant {days} jour{Number(days) > 1 ? "s" : ""}.
          </p>
          <input
            readOnly
            value={magicUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="input text-[11px] font-mono"
          />
        </div>
      )}
    </div>
  );
}
