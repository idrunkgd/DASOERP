"use client";
/**
 * Bouton pour ré-importer un CV sur un candidat EXISTANT.
 * Même IA que la création depuis CV, mais fusion non destructive :
 *  - Expériences et formations : AJOUTÉES (dédup sur companyName + startDate)
 *  - Compétences / langues / centres d'intérêt : UNION avec existant
 *  - Champs identité : conservés par défaut, override possible via case à cocher
 */
import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Sparkles, Loader2, X, Check, Upload } from "lucide-react";
import { parseCvFile, updateCandidateFromCv, type ParsedCvCandidate } from "@/server/actions/cv-import";

export function CvReimportButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCvCandidate | null>(null);
  const [overwriteBasics, setOverwriteBasics] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  function reset() {
    setStep("upload"); setFile(null); setParsed(null); setOverwriteBasics(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fileToDataUri(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  function doParse() {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10 MB"); return; }
    start(async () => {
      try {
        const dataUri = await fileToDataUri(file);
        const r = await parseCvFile(dataUri);
        if (!r.ok) { toast.error(r.error); return; }
        setParsed(r.data);
        setStep("preview");
        toast.success(`CV analysé (${r.provider})`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function doApply() {
    if (!parsed) return;
    start(async () => {
      try {
        const r = await updateCandidateFromCv({ candidateId, parsed, overwriteBasics });
        toast.success(`+${r.experiencesAdded} expériences · +${r.trainingsAdded} formations`);
        setOpen(false);
        reset();
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur mise à jour");
      }
    });
  }

  const modal = open && mounted ? createPortal(
    (
      <div
        className="fixed inset-0 z-[9999] bg-black/50 grid place-items-center p-4 overflow-y-auto"
        onClick={() => { setOpen(false); reset(); }}
      >
        <div className="card p-6 w-full max-w-3xl my-8 relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setOpen(false); reset(); }} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigoaccent" /> Importer un CV sur ce candidat
          </h2>
          <p className="text-xs text-midnight-500 mb-5">
            Fusion non destructive : les expériences, formations, compétences, langues et centres d'intérêt sont <strong>ajoutés</strong> à l'existant. Les champs identité (email, téléphone, LinkedIn…) sont conservés sauf si tu actives l'écrasement.
          </p>

          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => inputRef.current?.click()}
                className={"border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors " + (file ? "border-emerald-300 bg-emerald-50/40" : "border-midnight-200 hover:bg-midnight-50/40")}
              >
                {file ? (
                  <div className="flex items-center gap-2 justify-center">
                    <FileUp className="w-5 h-5 text-emerald-600" />
                    <span className="truncate max-w-[280px]">{file.name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="text-midnight-500">
                    <Upload className="w-6 h-6 mx-auto mb-2 text-midnight-400" />
                    Clique ou dépose un fichier CV
                    <div className="text-xs text-midnight-400 mt-1">PDF, PNG, JPEG, WebP</div>
                  </div>
                )}
                <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setOpen(false); reset(); }} className="btn-ghost">Annuler</button>
                <button disabled={!file || pending} onClick={doParse} className="btn-primary">
                  {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse…</> : <><Sparkles className="w-4 h-4" /> Analyser</>}
                </button>
              </div>
            </div>
          )}

          {step === "preview" && parsed && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="rounded-md bg-indigoaccent/5 border border-indigoaccent/20 p-3 text-sm text-indigoaccent">
                Analyse OK. Clique <strong>Appliquer</strong> pour fusionner.
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <KV lbl="Prénom extrait" val={parsed.firstName} />
                <KV lbl="Nom extrait" val={parsed.lastName} />
                <KV lbl="Email" val={parsed.email ?? "—"} />
                <KV lbl="Téléphone" val={parsed.phone ?? "—"} />
                <KV lbl="LinkedIn" val={parsed.linkedinUrl ?? "—"} />
                <KV lbl="Ville" val={parsed.city ?? "—"} />
                <KV lbl="Séniorité" val={parsed.seniority ?? "—"} />
                <KV lbl="Années XP" val={parsed.yearsExperience?.toString() ?? "—"} />
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-midnight-500 mb-1">Expériences détectées ({parsed.experiences.length})</div>
                <ul className="text-xs text-midnight-600 pl-4 list-disc">
                  {parsed.experiences.slice(0, 6).map((e, i) => (
                    <li key={i}>{e.companyName} — {e.jobTitle ?? "—"} ({e.startDate ?? "?"} → {e.endDate ?? "en cours"})</li>
                  ))}
                  {parsed.experiences.length > 6 && <li className="italic">… +{parsed.experiences.length - 6} autres</li>}
                </ul>
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-midnight-500 mb-1">Formations ({parsed.trainings.length})</div>
                <ul className="text-xs text-midnight-600 pl-4 list-disc">
                  {parsed.trainings.map((t, i) => <li key={i}>{t.title} · {t.institution} {t.period ? `(${t.period})` : ""}</li>)}
                </ul>
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-midnight-500 mb-1">Compétences ({parsed.skills.length})</div>
                <div className="flex flex-wrap gap-1">
                  {parsed.skills.map((s) => <span key={s} className="badge-info text-[10px]">{s}</span>)}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-midnight-700 border-t pt-3">
                <input type="checkbox" checked={overwriteBasics} onChange={(e) => setOverwriteBasics(e.target.checked)} />
                <span>Écraser les champs identité existants (email, téléphone, ville, LinkedIn, séniorité, années XP) par ceux du CV</span>
              </label>

              <div className="flex justify-between pt-3 border-t">
                <button onClick={() => setStep("upload")} className="btn-ghost">← Changer de CV</button>
                <button onClick={doApply} disabled={pending} className="btn-primary">
                  {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Application…</> : <><Check className="w-4 h-4" /> Appliquer la fusion</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    document.body
  ) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <Sparkles className="w-4 h-4" /> Importer un CV
      </button>
      {modal}
    </>
  );
}

function KV({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-midnight-500">{lbl}</div>
      <div className="text-sm text-midnight-900 truncate">{val}</div>
    </div>
  );
}
