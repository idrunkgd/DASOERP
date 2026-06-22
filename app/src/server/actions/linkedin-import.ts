"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { extractJson } from "@/lib/llm";

// ─── Helper LLM texte-only (LinkedIn paste, pas d'image) ────────────────
// On réutilise l'API Claude directement (pas la lib `callLlmWithMedia` qui
// est conçue pour image/PDF). Fallback Gemini si Anthropic indisponible.

async function callLlmText(prompt: string, userText: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!anthropicKey && !googleKey) {
    return { ok: false, error: "Aucune clé LLM configurée (ANTHROPIC_API_KEY ou GOOGLE_API_KEY)" };
  }

  // Anthropic Haiku — extraction structurée, peu coûteuse
  if (anthropicKey) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2500,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: `${prompt}\n\n---\n\n${userText}` }]
            }
          ]
        })
      });
      if (resp.ok) {
        const json = (await resp.json()) as any;
        const text: string = json?.content?.[0]?.text ?? "";
        if (text) return { ok: true, text };
      }
    } catch {
      // tombe sur Gemini
    }
  }

  // Fallback Gemini Flash : on tente plusieurs modèles dans l'ordre car
  // les noms changent (les anciens gemini-1.5-* sont régulièrement
  // dépréciés ou 404 sur certaines régions). Cascade vers le plus récent
  // au plus ancien tant qu'on a 404/429.
  if (googleKey) {
    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-001",
      "gemini-1.5-flash-latest"
    ];
    let lastErr = "";
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(googleKey)}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${prompt}\n\n---\n\n${userText}` }] }],
            generationConfig: { maxOutputTokens: 2500, temperature: 0.1 }
          })
        });
        if (resp.ok) {
          const json = (await resp.json()) as any;
          const text: string = json?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
          if (text) return { ok: true, text };
          lastErr = `Gemini ${model} : réponse vide`;
        } else {
          const errBody = await resp.text();
          lastErr = `Gemini ${model} ${resp.status}: ${errBody.slice(0, 200)}`;
          // Sur 404 ou 429 on tente le suivant ; sur autre erreur on abandonne
          if (resp.status !== 404 && resp.status !== 429) {
            return { ok: false, error: lastErr };
          }
        }
      } catch (e: any) {
        lastErr = `Gemini ${model}: ${String(e?.message ?? e)}`;
      }
    }
    return { ok: false, error: lastErr || "Gemini indisponible sur tous les modèles" };
  }

  return { ok: false, error: "Tous les providers LLM ont échoué" };
}

// ─── Schéma de réponse attendu de Claude ────────────────────────────────

const ParsedExperienceSchema = z.object({
  companyName: z.string().min(1),
  jobTitle: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),  // "YYYY-MM" ou "YYYY"
  endDate: z.string().nullable().optional(),    // null = poste en cours
  description: z.string().nullable().optional()
});

const ParsedCandidateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  seniority: z.enum(["JUNIOR", "MEDIOR", "SENIOR", "EXPERT"]).nullable().optional(),
  skills: z.array(z.string()).default([]),
  spokenLanguages: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  experiences: z.array(ParsedExperienceSchema).default([])
});

export type ParsedLinkedInCandidate = z.infer<typeof ParsedCandidateSchema>;

// ─── Parse seul : retourne le JSON structuré, ne crée rien ─────────────
// Utile pour permettre à l'utilisateur de valider/corriger avant création.

const PARSE_PROMPT = `Tu es un parser de profils LinkedIn. À partir du texte brut copié-collé d'un profil LinkedIn ci-dessous, extrais les informations dans un JSON strict.

Format de sortie OBLIGATOIRE (JSON pur, sans bloc de code, sans commentaires) :

{
  "firstName": "prénom",
  "lastName": "nom de famille",
  "email": "email ou null si absent",
  "phone": "téléphone ou null",
  "city": "ville/région ou null",
  "currentTitle": "intitulé du poste actuel ou null",
  "yearsExperience": entier (calcule à partir des expériences) ou null,
  "seniority": "JUNIOR" | "MEDIOR" | "SENIOR" | "EXPERT" ou null,
  "skills": ["liste des compétences techniques détectées"],
  "spokenLanguages": ["FR", "EN", ...],
  "summary": "résumé/about en 2-3 phrases ou null",
  "experiences": [
    {
      "companyName": "entreprise",
      "jobTitle": "intitulé poste",
      "startDate": "YYYY-MM ou YYYY ou null",
      "endDate": "YYYY-MM, YYYY ou null si poste actuel",
      "description": "missions principales ou null"
    }
  ]
}

Règles :
- Réponds uniquement avec le JSON, rien d'autre.
- Si le texte n'est manifestement pas un profil LinkedIn (ou trop pauvre), réponds : { "error": "Texte insuffisant ou non LinkedIn" }
- Pour seniority : JUNIOR (0-3 ans), MEDIOR (3-6 ans), SENIOR (6-10 ans), EXPERT (10+ ans).
- Skills : seulement les compétences techniques pertinentes pour une mission consultance (ex: "Python", "Kubernetes", "AVEVA", "Siemens TIA Portal", "ISO 27001"). Ignore les soft skills.
- Langues : codes ISO 639-1 deux lettres en majuscules (FR, EN, NL, DE, ES...).
- Si une date est en français ("janvier 2020"), convertis-la en format ISO ("2020-01").
- Si le poste est encore en cours, endDate doit être null.

Texte du profil LinkedIn ci-dessous :`;

export async function parseLinkedInText(rawText: string) {
  await requirePermission("consulting.write");
  const text = rawText.trim();
  if (text.length < 100) {
    return { ok: false as const, error: "Texte trop court (minimum 100 caractères)" };
  }
  if (text.length > 50000) {
    return { ok: false as const, error: "Texte trop long (maximum 50000 caractères)" };
  }

  const llmResp = await callLlmText(PARSE_PROMPT, text);
  if (!llmResp.ok) {
    return { ok: false as const, error: `LLM indisponible : ${llmResp.error}` };
  }

  let cleaned = extractJson(llmResp.text);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    return { ok: false as const, error: "Réponse LLM non parsable (JSON invalide)" };
  }
  if (parsedJson && typeof parsedJson === "object" && "error" in parsedJson) {
    return { ok: false as const, error: String((parsedJson as any).error) };
  }
  const result = ParsedCandidateSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false as const, error: `Format invalide : ${result.error.errors[0]?.message ?? "inconnu"}` };
  }
  return { ok: true as const, data: result.data };
}

// ─── Création effective du candidat depuis le JSON validé ───────────────

const CreateFromLinkedInSchema = z.object({
  linkedinUrl: z.string().url().optional().nullable(),
  parsed: ParsedCandidateSchema
});

export async function createCandidateFromLinkedIn(input: z.infer<typeof CreateFromLinkedInSchema>) {
  const session = await requirePermission("consulting.write");
  const data = CreateFromLinkedInSchema.parse(input);
  const p = data.parsed;

  // Anti-doublon : si email fourni et déjà présent → on ne crée pas, on
  // renvoie l'existant pour redirection. Ça évite les imports successifs
  // qui dupliqueraient les expériences.
  if (p.email) {
    const existing = await prisma.candidate.findFirst({
      where: { email: p.email },
      select: { id: true }
    });
    if (existing) {
      return { ok: true as const, id: existing.id, duplicate: true };
    }
  }

  function parseDate(s: string | null | undefined): Date | null {
    if (!s) return null;
    // Accepte "YYYY", "YYYY-MM", "YYYY-MM-DD"
    const m = s.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return null;
    const year = Number(m[1]);
    const month = m[2] ? Number(m[2]) - 1 : 0;
    const day = m[3] ? Number(m[3]) : 1;
    const d = new Date(Date.UTC(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const created = await prisma.candidate.create({
    data: {
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email || null,
      phone: p.phone || null,
      city: p.city || null,
      linkedinUrl: data.linkedinUrl || null,
      source: "LinkedIn",
      skills: p.skills,
      spokenLanguages: p.spokenLanguages,
      yearsExperience: p.yearsExperience ?? null,
      seniority: p.seniority || null,
      notes: p.summary ? `Résumé LinkedIn : ${p.summary}` : null,
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

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Candidate",
    entityId: created.id,
    message: `Candidat « ${p.firstName} ${p.lastName} » importé depuis LinkedIn`
  });
  revalidatePath("/candidates");
  return { ok: true as const, id: created.id, duplicate: false };
}
