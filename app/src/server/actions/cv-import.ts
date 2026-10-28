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

const ParsedExperienceSchema = z.object({
  companyName: z.string().min(1),
  jobTitle: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),  // "YYYY-MM" ou "YYYY"
  endDate: z.string().nullable().optional(),    // null = poste en cours
  description: z.string().nullable().optional()
});

const ParsedTrainingSchema = z.object({
  institution: z.string().min(1),
  title: z.string().min(1),
  period: z.string().nullable().optional(),
  description: z.string().nullable().optional()
});

const ParsedCandidateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  seniority: z.enum(["JUNIOR", "MEDIOR", "SENIOR", "EXPERT"]).nullable().optional(),
  skills: z.array(z.string()).default([]),
  spokenLanguages: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  experiences: z.array(ParsedExperienceSchema).default([]),
  trainings: z.array(ParsedTrainingSchema).default([])
});

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
    maxTokens: 4000
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
          .filter((e) => !!e.companyName)
          .map((e) => ({
            companyName: e.companyName,
            jobTitle: e.jobTitle || null,
            startDate: parseDate(e.startDate) ?? new Date(),
            endDate: parseDate(e.endDate),
            description: e.description || null
          }))
      }
    }
  });

  // Formations — table facultative avant migration déployée, donc try/catch
  if (p.trainings.length > 0) {
    try {
      await (prisma as any).candidateTraining.createMany({
        data: p.trainings.map((t) => ({
          candidateId: created.id,
          institution: t.institution,
          title: t.title,
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
