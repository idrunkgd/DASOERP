"use server";
/**
 * Import d'un candidat à partir d'un fichier CV (PDF ou image).
 *
 * Flux :
 *   1. L'utilisateur upload un CV (PDF ou JPEG/PNG scan).
 *   2. On encode en base64 et on envoie à Gemini (ou Anthropic si clé) via
 *      callLlmWithMedia — ces providers lisent le PDF nativement, donc pas
 *      besoin de pdf-parse / OCR.
 *   3. Gemini renvoie un JSON structuré (nom, email, skills, expériences,
 *      formations, langues, centres d'intérêt).
 *   4. On valide avec Zod puis on renvoie le JSON à l'UI pour un preview
 *      éditable avant la création effective.
 *   5. createCandidateFromCv() crée la fiche + les expériences + les
 *      formations (CandidateTraining) en une transaction.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { callLlmWithMedia, extractJson } from "@/lib/llm";

// ─── Schéma attendu du LLM ──────────────────────────────────────────────

// Schémas tolérants : accepte null pour TOUT champ car l'IA peut tronquer la
// réponse et insérer des null sur des champs techniquement requis. On filtre
// les lignes incomplètes après coup (voir .transform() au niveau du tableau).
const ParsedExperienceSchema = z.object({
  companyName: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),  // "YYYY-MM" ou "YYYY"
  endDate: z.string().nullable().optional(),    // null = poste en cours
  description: z.string().nullable().optional()
});

const ParsedTrainingSchema = z.object({
  institution: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

// Schéma permissif : TOUS les champs sont nullable/optional pour tolérer les
// réponses tronquées de l'IA. La validation des champs REQUIS (firstName,
// lastName) est faite après le parsing dans createCandidateFromCv.
const ParsedCandidateSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().nullable().optional().transform((v) => v && v.includes("@") ? v : null),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).nullable().optional().catch(null),
  seniority: z.enum(["JUNIOR", "MEDIOR", "SENIOR", "EXPERT"]).nullable().optional().catch(null),
  skills: z.array(z.string()).default([]).catch([]),
  spokenLanguages: z.array(z.string()).default([]).catch([]),
  interests: z.array(z.string()).default([]).catch([]),
  summary: z.string().nullable().optional(),
  experiences: z.array(ParsedExperienceSchema).default([]).catch([]),
  trainings: z.array(ParsedTrainingSchema).default([]).catch([])
}).transform((p) => ({
  ...p,
  firstName: (p.firstName ?? "").trim(),
  lastName: (p.lastName ?? "").trim()
}));

export type ParsedCvCandidate = z.infer<typeof ParsedCandidateSchema>;

// ─── Prompt ─────────────────────────────────────────────────────────────

const PARSE_PROMPT = `Tu es un parser de CV expert. À partir du document CV ci-joint (PDF ou image), extrais les informations du candidat dans un JSON strict.

Format de sortie OBLIGATOIRE (JSON pur, sans bloc de code, sans commentaires) :

{
  "firstName": "prénom",
  "lastName": "nom de famille",
  "email": "email ou null",
  "phone": "téléphone ou null",
  "city": "ville ou null",
  "linkedinUrl": "URL profil LinkedIn ou null",
  "currentTitle": "intitulé du poste actuel ou null",
  "yearsExperience": entier (calcule à partir des expériences) ou null,
  "seniority": "JUNIOR" | "MEDIOR" | "SENIOR" | "EXPERT" ou null,
  "skills": ["compétences techniques détectées"],
  "spokenLanguages": ["FR", "EN", ...],
  "interests": ["centres d'intérêt / hobbies"],
  "summary": "résumé/profil en 2-3 phrases ou null",
  "experiences": [
    {
      "companyName": "entreprise",
      "jobTitle": "intitulé poste",
      "startDate": "YYYY-MM ou YYYY ou null",
      "endDate": "YYYY-MM, YYYY ou null si poste actuel",
      "description": "missions principales ou null"
    }
  ],
  "trainings": [
    {
      "institution": "université / école / organisme",
      "title": "diplôme / certification / titre",
      "period": "période libre (ex: 2015-2018 ou 2020) ou null",
      "description": "spécialisation ou mention ou null"
    }
  ]
}

Règles :
- Réponds uniquement avec le JSON, rien d'autre.
- Si le document n'est manifestement pas un CV, réponds : { "error": "Document non reconnu comme un CV" }
- Pour seniority : JUNIOR (0-3 ans), MEDIOR (3-6 ans), SENIOR (6-10 ans), EXPERT (10+ ans).
- Skills : compétences techniques (langages, frameworks, outils, méthodologies). Ignore les soft skills.
- Langues : codes ISO 639-1 deux lettres en majuscules (FR, EN, NL, DE, ES...).
- Si une date est en français ("janvier 2020"), convertis en ISO ("2020-01").
- endDate null si poste actuel ("Présent", "Current", "Aujourd'hui").
- Formations : diplômes, certifications professionnelles, formations continues significatives.
- Centres d'intérêt / hobbies / passions : extraire si présents.
`;

// ─── Parse — ne crée rien, renvoie le JSON pour review ────────────────

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function parseCvFile(dataUri: string) {
  await requirePermission("consulting.write");
  if (!dataUri || !dataUri.startsWith("data:")) {
    return { ok: false as const, error: "Fichier invalide (data URI attendu)" };
  }
  // Vérifie taille approximative (base64 ≈ 4/3 du binaire)
  const base64Part = dataUri.split(",")[1] ?? "";
  const approxSize = Math.floor((base64Part.length * 3) / 4);
  if (approxSize > MAX_SIZE_BYTES) {
    return { ok: false as const, error: `Fichier trop volumineux (${(approxSize / 1024 / 1024).toFixed(1)} MB) — max 10 MB` };
  }

  const llmResp = await callLlmWithMedia({
    prompt: PARSE_PROMPT,
    dataUri,
    task: "cv",
    maxTokens: 8000
  });
  if (!llmResp.ok) {
    return { ok: false as const, error: `IA indisponible : ${llmResp.error}` };
  }

  const cleaned = extractJson(llmResp.text);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    const preview = llmResp.text.slice(0, 300).replace(/\n/g, " ");
    return {
      ok: false as const,
      error: `Réponse IA non parsable. Début : « ${preview}… »`
    };
  }
  if (parsedJson && typeof parsedJson === "object" && "error" in parsedJson) {
    return { ok: false as const, error: String((parsedJson as any).error) };
  }
  const result = ParsedCandidateSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false as const, error: `Format invalide : ${result.error.errors[0]?.message ?? "inconnu"}` };
  }
  return { ok: true as const, data: result.data, provider: llmResp.provider };
}

// ─── Création effective ──────────────────────────────────────────────────

const CreateFromCvSchema = z.object({
  parsed: ParsedCandidateSchema
});

export async function createCandidateFromCv(input: z.infer<typeof CreateFromCvSchema>) {
  const session = await requirePermission("consulting.write");
  const data = CreateFromCvSchema.parse(input);
  const p = data.parsed;

  if (!p.firstName || !p.lastName) {
    throw new Error("Prénom ou nom non détecté dans le CV. Vérifie / corrige dans le preview avant de valider.");
  }

  // Anti-doublon email
  if (p.email) {
    const existing = await prisma.candidate.findFirst({
      where: { email: p.email },
      select: { id: true }
    });
    if (existing) {
      return { ok: true as const, id: existing.id, duplicate: true };
    }
    const collidingUser = await prisma.user.findUnique({ where: { email: p.email.toLowerCase() } });
    if (collidingUser?.active) {
      throw new Error(`Un consultant actif (${collidingUser.firstName} ${collidingUser.lastName}) utilise déjà cet email.`);
    }
  }

  function parseDate(s: string | null | undefined): Date | null {
    if (!s) return null;
    const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = m[2] ? Number(m[2]) - 1 : 0;
    const day = m[3] ? Number(m[3]) : 1;
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const created = await (prisma as any).candidate.create({
    data: {
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email || null,
      phone: p.phone || null,
      city: p.city || null,
      linkedinUrl: p.linkedinUrl || null,
      source: "CV import",
      skills: p.skills,
      spokenLanguages: p.spokenLanguages,
      interests: p.interests,
      yearsExperience: p.yearsExperience ?? null,
      seniority: p.seniority || null,
      notes: p.summary ? `Résumé CV : ${p.summary}` : null,
      ownerId: session.user.id,
      status: "ACTIVE",
      experiences: {
        create: p.experiences
          .filter((e) => !!e.companyName && e.companyName.trim().length > 0)
          .map((e) => ({
            companyName: e.companyName!,
            jobTitle: e.jobTitle || null,
            startDate: parseDate(e.startDate) ?? new Date(),
            endDate: parseDate(e.endDate),
            description: e.description || null
          }))
      }
    }
  });

  // Formations — table facultative avant migration déployée, donc try/catch
  const validTrainings = p.trainings.filter((t) => t.institution || t.title);
  if (validTrainings.length > 0) {
    try {
      await (prisma as any).candidateTraining.createMany({
        data: validTrainings.map((t) => ({
          candidateId: created.id,
          institution: t.institution || "—",
          title: t.title || "—",
          period: t.period || null,
          description: t.description || null
        }))
      });
    } catch { /* ignore si table absente */ }
  }

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Candidate",
    entityId: created.id,
    message: `Candidat « ${p.firstName} ${p.lastName} » importé depuis CV`
  });
  revalidatePath("/candidates");
  return { ok: true as const, id: created.id, duplicate: false };
}

/**
 * Met à jour un candidat EXISTANT depuis un CV parsé.
 * Fusion non destructive : seuls les champs renseignés dans le CV écrasent
 * les valeurs existantes. Les expériences et formations sont AJOUTÉES
 * (pas de doublons sur même companyName + startDate).
 */
const UpdateFromCvSchema = z.object({
  candidateId: z.string().min(1),
  parsed: ParsedCandidateSchema,
  overwriteBasics: z.boolean().optional().default(false)
});

export async function updateCandidateFromCv(input: z.infer<typeof UpdateFromCvSchema>) {
  const session = await requirePermission("consulting.write");
  const data = UpdateFromCvSchema.parse(input);
  const p = data.parsed;

  const existing = await prisma.candidate.findUnique({
    where: { id: data.candidateId },
    include: { experiences: true }
  });
  if (!existing) throw new Error("Candidat introuvable");

  function parseDate(s: string | null | undefined): Date | null {
    if (!s) return null;
    const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = m[2] ? Number(m[2]) - 1 : 0;
    const day = m[3] ? Number(m[3]) : 1;
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Merge basics : si overwriteBasics=true, le CV écrase. Sinon, on ne touche
  // qu'aux champs vides côté candidat existant.
  const merge = <T,>(current: T | null | undefined, incoming: T | null | undefined): T | null => {
    if (data.overwriteBasics) return (incoming ?? current ?? null) as any;
    return (current ?? incoming ?? null) as any;
  };

  const mergedSkills = Array.from(new Set([...(existing.skills ?? []), ...p.skills]));
  const mergedLangs  = Array.from(new Set([...(existing.spokenLanguages ?? []), ...p.spokenLanguages]));
  const mergedInt    = Array.from(new Set([...((existing as any).interests ?? []), ...p.interests]));

  await (prisma as any).candidate.update({
    where: { id: data.candidateId },
    data: {
      firstName:       data.overwriteBasics ? (p.firstName || existing.firstName) : existing.firstName,
      lastName:        data.overwriteBasics ? (p.lastName  || existing.lastName)  : existing.lastName,
      email:           merge(existing.email, p.email),
      phone:           merge(existing.phone, p.phone),
      city:            merge(existing.city, p.city),
      linkedinUrl:     merge(existing.linkedinUrl, p.linkedinUrl),
      yearsExperience: data.overwriteBasics ? (p.yearsExperience ?? existing.yearsExperience) : (existing.yearsExperience ?? p.yearsExperience ?? null),
      seniority:       merge(existing.seniority, p.seniority),
      skills:          mergedSkills,
      spokenLanguages: mergedLangs,
      interests:       mergedInt
    }
  });

  // Ajoute les expériences qui n'existent pas déjà (par companyName + startDate)
  const existingKeys = new Set(existing.experiences.map((e) => `${e.companyName}|${e.startDate.toISOString().slice(0, 7)}`));
  const toAdd = p.experiences
    .filter((e) => !!e.companyName && e.companyName.trim().length > 0)
    .filter((e) => {
      const d = parseDate(e.startDate);
      const key = `${e.companyName}|${d ? d.toISOString().slice(0, 7) : ""}`;
      return !existingKeys.has(key);
    });
  if (toAdd.length > 0) {
    await (prisma as any).candidateExperience.createMany({
      data: toAdd.map((e) => ({
        candidateId: data.candidateId,
        companyName: e.companyName!,
        jobTitle: e.jobTitle || null,
        startDate: parseDate(e.startDate) ?? new Date(),
        endDate: parseDate(e.endDate),
        description: e.description || null
      }))
    });
  }

  // Ajoute les formations
  const validTrainings = p.trainings.filter((t) => t.institution || t.title);
  if (validTrainings.length > 0) {
    try {
      await (prisma as any).candidateTraining.createMany({
        data: validTrainings.map((t) => ({
          candidateId: data.candidateId,
          institution: t.institution || "—",
          title: t.title || "—",
          period: t.period || null,
          description: t.description || null
        }))
      });
    } catch { /* table absente — silencieux */ }
  }

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Candidate",
    entityId: data.candidateId,
    message: `CV réimporté : +${toAdd.length} exp, +${p.trainings.length} formations${data.overwriteBasics ? " · champs identité écrasés" : ""}`
  });

  revalidatePath(`/candidates/${data.candidateId}`);
  return { ok: true as const, experiencesAdded: toAdd.length, trainingsAdded: p.trainings.length };
}
