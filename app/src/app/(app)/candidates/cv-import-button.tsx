"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Sparkles, Loader2, X, Check, Upload, Trash2, Plus } from "lucide-react";
import { parseCvFile, createCandidateFromCv, type ParsedCvCandidate } from "@/server/actions/cv-import";

/**
 * Bouton + modal pour créer un candidat à partir d'un CV (PDF ou image).
 * Flux : upload → parse LLM → preview éditable → création.
 */
export function CvImportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCvCandidate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setParsed(null);
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
    const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast.error("Format non supporté — PDF, PNG, JPEG ou WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 MB)");
      return;
    }
    start(async () => {
      try {
        const dataUri = await fileToDataUri(file);
        const r = await parseCvFile(dataUri);
        if (!r.ok) { toast.error(r.error); return; }
        setParsed(r.data);
        setStep("preview");
        toast.success(`CV analysé (${r.provider}) — vérifie et confirme`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function doCreate() {
    if (!parsed) return;
    start(async () => {
      try {
        const r = await createCandidateFromCv({ parsed });
        if (r.duplicate) toast.info("Candidat déjà existant — ouverture de sa fiche");
        else toast.success("Candidat créé depuis le CV");
        setOpen(false);
        reset();
        router.push(`/candidates/${r.id}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur création");
      }
    });
  }

  function updateParsed<K extends keyof ParsedCvCandidate>(key: K, value: ParsedCvCandidate[K]) {
    setParsed((p) => p ? { ...p, [key]: value } : p);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Sparkles className="w-4 h-4" /> Importer depuis CV
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto"
          onClick={() => { setOpen(false); reset(); }}
        >
          <div
            className="card p-6 w-full max-w-3xl my-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigoaccent" /> Importer un candidat depuis un CV
            </h2>

            {step === "upload" && (
              <div className="space-y-4">
                <p className="text-sm text-midnight-600">
                  Upload un CV (PDF, PNG, JPEG — max 10 MB). L'IA l'analyse pour
                  pré-remplir la fiche candidat : identité, compétences, expériences,
                  formations, centres d'intérêt.
                </p>

                <div
                  onClick={() => inputRef.current?.click()}
                  className={
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors " +
                    (file
                      ? "border-emerald-300 bg-emerald-50/40"
                      : "border-midnight-200 hover:border-midnight-300 hover:bg-midnight-50/40")
                  }
                >
                  {file ? (
                    <div className="flex items-center gap-2 justify-center">
                      <FileUp className="w-5 h-5 text-emerald-600" />
                      <span className="truncate max-w-[280px]">{file.name}</span>
                      <span className="text-xs text-midnight-500">({(file.size / 1024).toFixed(0)} KB)</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-midnight-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-midnight-500">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-midnight-400" />
                      Clique ou dépose un fichier CV
                      <div className="text-xs text-midnight-400 mt-1">PDF, PNG, JPEG, WebP</div>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setOpen(false); reset(); }} className="btn-ghost">Annuler</button>
                  <button type="button" disabled={!file || pending} onClick={doParse} className="btn-primary">
                    {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyse…</> : <><Sparkles className="w-4 h-4" /> Analyser</>}
                  </button>
                </div>
              </div>
            )}

            {step === "preview" && parsed && (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="rounded-md bg-indigoaccent/5 border border-indigoaccent/20 p-3 text-sm text-indigoaccent">
                  Vérifie / corrige les champs ci-dessous puis clique « Créer le candidat ».
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <Field label="Prénom *" cls="col-span-6">
                    <input className="input" value={parsed.firstName} onChange={(e) => updateParsed("firstName", e.target.value)} />
                  </Field>
                  <Field label="Nom *" cls="col-span-6">
                    <input className="input" value={parsed.lastName} onChange={(e) => updateParsed("lastName", e.target.value)} />
                  </Field>
                  <Field label="Email" cls="col-span-6">
                    <input className="input" value={parsed.email ?? ""} onChange={(e) => updateParsed("email", e.target.value || null)} />
                  </Field>
                  <Field label="Téléphone" cls="col-span-6">
                    <input className="input" value={parsed.phone ?? ""} onChange={(e) => updateParsed("phone", e.target.value || null)} />
                  </Field>
                  <Field label="LinkedIn" cls="col-span-6">
                    <input className="input" value={parsed.linkedinUrl ?? ""} onChange={(e) => updateParsed("linkedinUrl", e.target.value || null)} />
                  </Field>
                  <Field label="Ville" cls="col-span-6">
                    <input className="input" value={parsed.city ?? ""} onChange={(e) => updateParsed("city", e.target.value || null)} />
                  </Field>
                  <Field label="Séniorité" cls="col-span-4">
                    <select className="input" value={parsed.seniority ?? ""} onChange={(e) => updateParsed("seniority", (e.target.value || null) as any)}>
                      <option value="">—</option>
                      <option value="JUNIOR">Junior</option>
                      <option value="MEDIOR">Medior</option>
                      <option value="SENIOR">Senior</option>
                      <option value="EXPERT">Expert</option>
                    </select>
                  </Field>
                  <Field label="Années d'XP" cls="col-span-4">
                    <input type="number" className="input" value={parsed.yearsExperience ?? ""} onChange={(e) => updateParsed("yearsExperience", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                  <Field label="Poste actuel" cls="col-span-4">
                    <input className="input" value={parsed.currentTitle ?? ""} onChange={(e) => updateParsed("currentTitle", e.target.value || null)} />
                  </Field>
                  <Field label="Compétences (virgule)" cls="col-span-12">
                    <input className="input" value={parsed.skills.join(", ")} onChange={(e) => updateParsed("skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
                  </Field>
                  <Field label="Langues" cls="col-span-6">
                    <input className="input" value={parsed.spokenLanguages.join(", ")} onChange={(e) => updateParsed("spokenLanguages", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
                  </Field>
                  <Field label="Centres d'intérêt" cls="col-span-6">
                    <input className="input" value={parsed.interests.join(", ")} onChange={(e) => updateParsed("interests", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} />
                  </Field>
                  <Field label="Résumé" cls="col-span-12">
                    <textarea className="input min-h-[60px] py-2" value={parsed.summary ?? ""} onChange={(e) => updateParsed("summary", e.target.value || null)} />
                  </Field>
                </div>

                {/* Expériences — liste simple */}
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-midnight-500 mb-2">
                    Expériences détectées ({parsed.experiences.length})
                  </h3>
                  <div className="space-y-2">
                    {parsed.experiences.map((exp, i) => (
                      <div key={i} className="card p-3 bg-midnight-50/40 border-border/60 grid grid-cols-12 gap-2 items-start text-xs">
                        <input className="input col-span-4 h-8" placeholder="Entreprise" value={exp.companyName} onChange={(e) => {
                          const next = [...parsed.experiences]; next[i] = { ...exp, companyName: e.target.value }; updateParsed("experiences", next);
                        }} />
                        <input className="input col-span-4 h-8" placeholder="Poste" value={exp.jobTitle ?? ""} onChange={(e) => {
                          const next = [...parsed.experiences]; next[i] = { ...exp, jobTitle: e.target.value || null }; updateParsed("experiences", next);
                        }} />
                        <input className="input col-span-2 h-8" placeholder="Début" value={exp.startDate ?? ""} onChange={(e) => {
                          const next = [...parsed.experiences]; next[i] = { ...exp, startDate: e.target.value || null }; updateParsed("experiences", next);
                        }} />
                        <input className="input col-span-1 h-8" placeholder="Fin" value={exp.endDate ?? ""} onChange={(e) => {
                          const next = [...parsed.experiences]; next[i] = { ...exp, endDate: e.target.value || null }; updateParsed("experiences", next);
                        }} />
                        <button type="button" className="btn-ghost btn-sm col-span-1 text-red-600" onClick={() => {
                          const next = parsed.experiences.filter((_, j) => j !== i); updateParsed("experiences", next);
                        }}><Trash2 className="w-3.5 h-3.5" /></button>
                        <textarea className="input col-span-12 min-h-[32px] py-1 text-xs" placeholder="Description" value={exp.description ?? ""} onChange={(e) => {
                          const next = [...parsed.experiences]; next[i] = { ...exp, description: e.target.value || null }; updateParsed("experiences", next);
                        }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formations */}
                <div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-midnight-500 mb-2">
                    Formations détectées ({parsed.trainings.length})
                  </h3>
                  <div className="space-y-2">
                    {parsed.trainings.map((t, i) => (
                      <div key={i} className="card p-3 bg-midnight-50/40 border-border/60 grid grid-cols-12 gap-2 items-start text-xs">
                        <input className="input col-span-5 h-8" placeholder="Diplôme / titre" value={t.title} onChange={(e) => {
                          const next = [...parsed.trainings]; next[i] = { ...t, title: e.target.value }; updateParsed("trainings", next);
                        }} />
                        <input className="input col-span-4 h-8" placeholder="École / organisme" value={t.institution} onChange={(e) => {
                          const next = [...parsed.trainings]; next[i] = { ...t, institution: e.target.value }; updateParsed("trainings", next);
                        }} />
                        <input className="input col-span-2 h-8" placeholder="Période" value={t.period ?? ""} onChange={(e) => {
                          const next = [...parsed.trainings]; next[i] = { ...t, period: e.target.value || null }; updateParsed("trainings", next);
                        }} />
                        <button type="button" className="btn-ghost btn-sm col-span-1 text-red-600" onClick={() => {
                          const next = parsed.trainings.filter((_, j) => j !== i); updateParsed("trainings", next);
                        }}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <button type="button" onClick={() => setStep("upload")} className="btn-ghost">
                    ← Changer de CV
                  </button>
                  <button type="button" disabled={pending} onClick={doCreate} className="btn-primary">
                    {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : <><Check className="w-4 h-4" /> Créer le candidat</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, cls, children }: { label: string; cls: string; children: React.ReactNode }) {
  return (
    <div className={cls}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
