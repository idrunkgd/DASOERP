"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Loader2, FileText, UserPlus, Sparkles } from "lucide-react";
import { parseCv, createCandidateFromParsedCv, type ParsedCv } from "@/server/actions/cv-parser";
import { useRouter } from "next/navigation";

export function CvParserClient() {
  const [pending, start] = useTransition();
  const [parsing, setParsing] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCv | null>(null);
  const router = useRouter();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop lourd (>10MB)");
      return;
    }
    setFilename(file.name);
    setParsed(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setParsing(true);
      const result = await parseCv(dataUri);
      setParsing(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setParsed(result.data!);
      toast.success(
        `CV parsé via ${result.provider ?? "LLM"} — vérifie les champs avant de créer le candidat`
      );
    };
    reader.readAsDataURL(file);
  }

  function createCandidate() {
    if (!parsed) return;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("payload", JSON.stringify(parsed));
        const { id } = await createCandidateFromParsedCv(fd);
        toast.success("Candidat créé");
        router.push(`/candidates/${id}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-midnight-300 rounded-lg p-8 cursor-pointer hover:border-indigoaccent transition-colors min-h-[280px]">
          {parsing ? (
            <div className="flex flex-col items-center gap-2 text-indigoaccent">
              <Loader2 className="w-10 h-10 animate-spin" />
              <span className="text-sm">Claude lit le CV...</span>
              <span className="text-[11px] text-midnight-500">15-30 secondes</span>
            </div>
          ) : filename ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-emerald-600" />
              <span className="text-sm font-medium">{filename}</span>
              <span className="text-[11px] text-midnight-500">Clique pour remplacer</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-midnight-500">
              <Upload className="w-10 h-10" />
              <span className="text-sm">Dépose un CV (PDF ou image)</span>
              <span className="text-[11px]">
                <Sparkles className="w-3 h-3 inline" /> Extraction auto via Claude Sonnet
              </span>
            </div>
          )}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
        </label>

        <div className="mt-4 text-[11px] text-midnight-500 space-y-1">
          <div>Ce qui est extrait :</div>
          <ul className="list-disc list-inside ml-2">
            <li>Nom / Prénom / Email / Téléphone / Ville</li>
            <li>LinkedIn / Années d'expérience / Séniorité</li>
            <li>Compétences techniques (catalogue libre)</li>
            <li>Langues parlées</li>
            <li>Expériences professionnelles (avec dates)</li>
          </ul>
        </div>
      </div>

      {/* Aperçu */}
      <div>
        {parsed ? (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="font-semibold">Données extraites</div>
              <button
                onClick={createCandidate}
                className="btn-primary text-sm"
                disabled={pending}
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Créer le candidat
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Field
                label="Nom complet"
                value={[parsed.firstName, parsed.lastName].filter(Boolean).join(" ") || "—"}
                onChange={(v) => {
                  const [f, ...rest] = v.split(" ");
                  setParsed({ ...parsed, firstName: f ?? null, lastName: rest.join(" ") || null });
                }}
              />
              <Field
                label="Email"
                value={parsed.email ?? ""}
                onChange={(v) => setParsed({ ...parsed, email: v || null })}
              />
              <Field
                label="Téléphone"
                value={parsed.phone ?? ""}
                onChange={(v) => setParsed({ ...parsed, phone: v || null })}
              />
              <Field
                label="Ville"
                value={parsed.city ?? ""}
                onChange={(v) => setParsed({ ...parsed, city: v || null })}
              />
              <Field
                label="LinkedIn"
                value={parsed.linkedinUrl ?? ""}
                onChange={(v) => setParsed({ ...parsed, linkedinUrl: v || null })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-midnight-500">Années d'expé.</div>
                  <input
                    type="number"
                    value={parsed.yearsExperience ?? ""}
                    onChange={(e) =>
                      setParsed({
                        ...parsed,
                        yearsExperience: e.target.value === "" ? null : Number(e.target.value)
                      })
                    }
                    className="input text-sm"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-midnight-500">Séniorité</div>
                  <input
                    type="text"
                    value={parsed.seniority ?? ""}
                    onChange={(e) =>
                      setParsed({ ...parsed, seniority: e.target.value || null })
                    }
                    className="input text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="text-[11px] text-midnight-500 mb-1">
                  Compétences ({parsed.skills.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {parsed.skills.map((s, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-indigoaccent/10 text-indigoaccent rounded px-1.5 py-0.5"
                    >
                      {s}
                      <button
                        onClick={() =>
                          setParsed({
                            ...parsed,
                            skills: parsed.skills.filter((_, j) => j !== i)
                          })
                        }
                        className="ml-1 text-midnight-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-midnight-500 mb-1">
                  Langues : {parsed.spokenLanguages.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-midnight-500 mb-1">
                  Expériences ({parsed.experiences.length})
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {parsed.experiences.map((exp, i) => (
                    <div
                      key={i}
                      className="text-xs bg-midnight-50 rounded p-2 border border-midnight-100"
                    >
                      <div className="font-medium text-midnight-900">{exp.jobTitle ?? "—"}</div>
                      <div className="text-midnight-600">{exp.companyName}</div>
                      <div className="text-[10px] text-midnight-400">
                        {exp.startDate ?? "?"} → {exp.endDate ?? "en cours"}
                      </div>
                      {exp.description && (
                        <div className="text-[11px] text-midnight-600 mt-1 line-clamp-2">
                          {exp.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-midnight-200 rounded-lg p-8 min-h-[280px] flex items-center justify-center text-sm text-midnight-400">
            L'aperçu apparaîtra ici après parsing
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] text-midnight-500">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-sm"
      />
    </div>
  );
}
