"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Linkedin, Sparkles, Loader2, X, Check, AlertTriangle } from "lucide-react";
import {
  parseLinkedInText,
  createCandidateFromLinkedIn,
  type ParsedLinkedInCandidate
} from "@/server/actions/linkedin-import";

export function LinkedInImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [step, setStep] = useState<"input" | "preview">("input");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedLinkedInCandidate | null>(null);

  function reset() {
    setStep("input");
    setUrl("");
    setText("");
    setParsed(null);
  }

  function doParse() {
    if (text.trim().length < 100) {
      toast.error("Colle au moins 100 caractères du profil LinkedIn");
      return;
    }
    start(async () => {
      const r = await parseLinkedInText(text);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setParsed(r.data);
      setStep("preview");
      toast.success("Profil analysé — vérifie et confirme");
    });
  }

  function doCreate() {
    if (!parsed) return;
    start(async () => {
      try {
        const r = await createCandidateFromLinkedIn({
          linkedinUrl: url.trim() || null,
          parsed
        });
        if (r.duplicate) {
          toast.info("Candidat déjà existant — ouverture de sa fiche");
        } else {
          toast.success("Candidat créé depuis LinkedIn");
        }
        setOpen(false);
        reset();
        router.push(`/candidates/${r.id}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary"
      >
        <Linkedin className="w-4 h-4" /> Importer LinkedIn
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto"
          onClick={() => { setOpen(false); reset(); }}
        >
          <div
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-midnight-900 flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" /> Importer depuis LinkedIn
              </h2>
              <button onClick={() => { setOpen(false); reset(); }} className="text-midnight-500 hover:text-midnight-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === "input" && (
              <>
                <div className="mb-4 p-3 rounded-lg bg-indigoaccent/5 border border-indigoaccent/20 text-xs text-midnight-700">
                  <strong className="text-midnight-900">Mode d'emploi</strong>
                  <ol className="list-decimal ml-5 mt-1 space-y-0.5">
                    <li>Ouvre le profil LinkedIn du candidat dans un autre onglet</li>
                    <li>Sélectionne tout le contenu de la page (<kbd className="kbd">⌘A</kbd> puis <kbd className="kbd">⌘C</kbd>)</li>
                    <li>Colle-le dans le champ ci-dessous</li>
                    <li>Claude Haiku analyse le profil (≈ 1 ct/analyse) et te propose un candidat à créer</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label">URL LinkedIn (optionnel)</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/in/jean-dupont/"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">
                      Contenu du profil <span className="text-red-600">*</span>
                      <span className="text-[10px] font-normal text-midnight-400 ml-2">
                        ({text.length.toLocaleString("fr-BE")} caractères)
                      </span>
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Colle ici l'intégralité du contenu du profil LinkedIn..."
                      rows={12}
                      className="input min-h-[280px] font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
                  <button onClick={() => { setOpen(false); reset(); }} className="btn-ghost" disabled={pending}>
                    Annuler
                  </button>
                  <button onClick={doParse} className="btn-primary" disabled={pending}>
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Analyser avec Claude
                  </button>
                </div>
              </>
            )}

            {step === "preview" && parsed && (
              <>
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Profil analysé. Vérifie le résumé ci-dessous puis confirme la création. Tu pourras éditer en détail après dans la fiche candidat.
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <Row label="Nom complet" value={`${parsed.firstName} ${parsed.lastName}`} />
                  <Row label="Email" value={parsed.email || "—"} highlight={!parsed.email} />
                  <Row label="Téléphone" value={parsed.phone || "—"} />
                  <Row label="Ville" value={parsed.city || "—"} />
                  <Row label="Poste actuel" value={parsed.currentTitle || "—"} />
                  <Row label="Expérience" value={parsed.yearsExperience != null ? `${parsed.yearsExperience} ans` : "—"} />
                  <Row label="Séniorité estimée" value={parsed.seniority || "—"} />
                  <Row label="Langues" value={parsed.spokenLanguages.length ? parsed.spokenLanguages.join(", ") : "—"} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-midnight-500 font-semibold mb-1">
                      Compétences détectées ({parsed.skills.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsed.skills.length === 0 ? (
                        <span className="text-midnight-500 text-xs">Aucune</span>
                      ) : (
                        parsed.skills.map((s) => (
                          <span key={s} className="badge-info">{s}</span>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-midnight-500 font-semibold mb-1">
                      Expériences ({parsed.experiences.length})
                    </div>
                    {parsed.experiences.length === 0 ? (
                      <p className="text-midnight-500 text-xs">Aucune expérience extraite</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                        {parsed.experiences.map((e, i) => (
                          <li key={i} className="text-xs p-2 rounded bg-midnight-50">
                            <div className="font-medium text-midnight-900">
                              {e.jobTitle || "—"} <span className="text-midnight-500 font-normal">chez {e.companyName}</span>
                            </div>
                            <div className="text-[11px] text-midnight-500">
                              {e.startDate ?? "?"} → {e.endDate ?? "présent"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {parsed.summary && (
                    <Row label="Résumé" value={parsed.summary} />
                  )}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Si l'email est déjà présent dans la base, l'import sera détecté comme doublon et tu seras redirigé vers la fiche existante (pas de duplication).
                  </span>
                </div>

                <div className="flex justify-between gap-2 mt-5 pt-4 border-t border-border">
                  <button
                    onClick={() => { setStep("input"); setParsed(null); }}
                    className="btn-ghost"
                    disabled={pending}
                  >
                    ← Modifier le texte
                  </button>
                  <button
                    onClick={doCreate}
                    className="btn-primary"
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Créer le candidat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-[11px] uppercase tracking-wider text-midnight-500 font-semibold">{label}</span>
      <span className={"col-span-2 " + (highlight ? "text-amber-700" : "text-midnight-900")}>
        {value}
      </span>
    </div>
  );
}
