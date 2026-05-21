"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { callLlmWithMedia, extractJson } from "@/lib/llm";

// Schéma de retour Claude
const ExperienceSchema = z.object({
  companyName: z.string(),
  jobTitle: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  description: z.string().nullable()
});

const CvSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  seniority: z.string().nullable(),
  skills: z.array(z.string()).default([]),
  spokenLanguages: z.array(z.string()).default([]),
  experiences: z.array(ExperienceSchema).default([])
});

export type ParsedCv = z.infer<typeof CvSchema>;

/**
 * Parse un CV (PDF ou image) via Claude API.
 * Le client envoie un dataUri (base64 + media type).
 * Renvoie un objet structuré + le payload brut pour audit.
 */
export async function parseCv(dataUri: string): Promise<{
  ok: boolean;
  error?: string;
  data?: ParsedCv;
  provider?: string;
}> {
  await requireSession();

  const prompt = `Tu analyses un CV de candidat IT/consulting (probablement en français). Extrais les informations au format JSON strict :
{
  "firstName": "prénom ou null",
  "lastName": "nom ou null",
  "email": "email ou null",
  "phone": "téléphone formaté ou null",
  "city": "ville ou null",
  "linkedinUrl": "url LinkedIn complète ou null",
  "yearsExperience": nombre d'années d'expérience ou null,
  "seniority": "Junior|Medior|Senior|Lead|Architect ou null (inférence)",
  "skills": ["liste de compétences techniques uniquement, max 30"],
  "spokenLanguages": ["FR", "EN", "NL"...],
  "experiences": [
    {
      "companyName": "...",
      "jobTitle": "...",
      "startDate": "YYYY-MM-DD ou YYYY-MM-01 si seul le mois est connu, sinon null",
      "endDate": "YYYY-MM-DD ou null si poste en cours",
      "description": "résumé court de la mission"
    }
  ]
}
Réponds UNIQUEMENT le JSON, rien d'autre.`;

  const result = await callLlmWithMedia({
    prompt,
    dataUri,
    task: "cv",
    maxTokens: 4000
  });
  if (!result.ok) return { ok: false, error: result.error };

  let parsedRaw: any;
  try {
    parsedRaw = JSON.parse(extractJson(result.text));
  } catch {
    return { ok: false, error: `${result.provider} : JSON invalide` };
  }
  const parsed = CvSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Structure inattendue : ${parsed.error.message.slice(0, 200)}`
    };
  }
  return { ok: true, data: parsed.data, provider: result.provider };
}

/**
 * Crée un candidat à partir du résultat de parsing.
 * Si experiences fournies, elles sont insérées dans CandidateExperience.
 */
export async function createCandidateFromParsedCv(formData: FormData) {
  const session = await requireSession();
  const raw = String(formData.get("payload") ?? "");
  if (!raw) throw new Error("Payload manquant");
  const parsed = CvSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Payload invalide");
  const d = parsed.data;
  if (!d.firstName && !d.lastName) {
    throw new Error("Au moins un prénom ou nom est requis");
  }

  const candidate = await prisma.candidate.create({
    data: {
      firstName: d.firstName ?? "Prénom",
      lastName: d.lastName ?? "Nom",
      email: d.email,
      phone: d.phone,
      city: d.city,
      linkedinUrl: d.linkedinUrl,
      yearsExperience: d.yearsExperience ?? undefined,
      seniority: d.seniority,
      skills: d.skills,
      spokenLanguages: d.spokenLanguages,
      ownerId: session.user.id,
      experiences: {
        create: d.experiences
          .filter((e) => e.companyName)
          .map((e) => ({
            companyName: e.companyName,
            jobTitle: e.jobTitle,
            startDate: e.startDate ? new Date(e.startDate) : new Date(),
            endDate: e.endDate ? new Date(e.endDate) : null,
            description: e.description
          }))
      }
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Candidate",
    entityId: candidate.id,
    message: `Candidat « ${candidate.firstName} ${candidate.lastName} » créé via parser CV`
  });
  revalidatePath("/candidates");
  revalidatePath("/test/cv-parser");
  return { id: candidate.id };
}
