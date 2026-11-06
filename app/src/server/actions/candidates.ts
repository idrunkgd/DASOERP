"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { geocodeCity } from "@/lib/geocoding";

/**
 * Enrichit les données candidat avec postalCode + lat/lng géocodés quand c'est
 * pertinent : si une ville est fournie et que (postalCode absent OU lat/lng
 * absents). Best-effort, silencieux en cas d'échec Nominatim.
 */
async function enrichWithGeocode<T extends { city?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null }>(
  data: T
): Promise<T> {
  if (!data.city) return data;
  const needsPostal = !data.postalCode;
  const needsCoords = data.latitude == null || data.longitude == null;
  if (!needsPostal && !needsCoords) return data;
  const g = await geocodeCity(data.city);
  if (!g) return data;
  return {
    ...data,
    postalCode: data.postalCode ?? g.postalCode,
    latitude:   data.latitude   ?? g.latitude,
    longitude:  data.longitude  ?? g.longitude
  };
}

/**
 * Géocode un candidat existant (ou tous les candidats sans coords) à la main.
 * Appelable depuis la fiche candidat ou un bouton admin.
 */
export async function geocodeCandidate(id: string) {
  await requirePermission("consulting.write");
  const c = await prisma.candidate.findUniqueOrThrow({ where: { id }, select: { id: true, city: true } });
  if (!c.city) return { ok: false as const, reason: "Pas de ville renseignée" };
  const g = await geocodeCity(c.city);
  if (!g) return { ok: false as const, reason: "Ville introuvable via Nominatim" };
  await (prisma as any).candidate.update({
    where: { id },
    data: { postalCode: g.postalCode, latitude: g.latitude, longitude: g.longitude }
  });
  revalidatePath(`/candidates/${id}`);
  return { ok: true as const, postalCode: g.postalCode, latitude: g.latitude, longitude: g.longitude };
}

const Schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).transform(v => v || null),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable().transform(v => {
    const t = (v ?? "").trim();
    if (!t) return null;
    // Limite pratique : 1 Mo en data URI (~750KB d'image binaire)
    if (t.length > 1_400_000) throw new Error("Photo trop volumineuse (>1 Mo)");
    return t;
  }),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable().transform(v => (v?.trim() || null)),
  source: z.string().optional().nullable(),
  skills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  interests: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  spokenLanguages: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  cvContactUserId: z.string().optional().nullable().transform(v => (v?.trim() || null)),
  cvContactRole:   z.string().optional().nullable().transform(v => (v?.trim() || null)),
  trainings: z.string().optional().transform(v => {
    if (!v) return [] as Array<{ institution: string; title: string; period: string | null; description: string | null }>;
    try {
      const arr = JSON.parse(v);
      if (!Array.isArray(arr)) return [];
      return arr
        .map((t: any) => ({
          institution: String(t.institution ?? "").trim(),
          title: String(t.title ?? "").trim(),
          period: t.period ? String(t.period).trim() : null,
          description: t.description ? String(t.description).trim() : null
        }))
        .filter((t) => t.institution || t.title);
    } catch { return []; }
  }),
  yearsExperience: z.coerce.number().int().nonnegative().optional().nullable(),
  seniority: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable().transform(v => (v?.trim() || null)),
  dailyCost: z.coerce.number().nonnegative().optional().nullable(),
  hourlyCost: z.coerce.number().nonnegative().optional().nullable(),
  minDailyRate: z.coerce.number().nonnegative().optional().nullable(),
  /// Taux journalier vendu au client (HTVA) — distinct du coût interne
  dailyRate: z.coerce.number().nonnegative().optional().nullable(),
  /// Type de contrat quand engagé chez Dasolabs. Chaîne vide = "Non défini"
  /// (mappe à null en base). Le preprocess doit venir AVANT le z.enum sinon
  /// la chaîne vide est rejetée avec 'Invalid enum value'.
  contractType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["EMPLOYEE", "FREELANCE"]).nullable().optional()
  ),
  status: z.enum(["ACTIVE","ENGAGED","UNAVAILABLE","ARCHIVED"]).default("ACTIVE"),
  availableFrom: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  notes: z.string().optional().nullable()
});

export async function createCandidate(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const parsed = Schema.parse(Object.fromEntries(formData));
  const { trainings, ...data } = parsed;
  if (data.email) {
    const collidingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (collidingUser?.active) {
      throw new Error(`Un consultant actif (${collidingUser.firstName} ${collidingUser.lastName}) utilise déjà cet email. Une personne ne peut pas être à la fois consultant interne et candidat externe.`);
    }
  }
  const enriched = await enrichWithGeocode(data as any);
  const c = await (prisma as any).candidate.create({ data: { ...enriched, ownerId: session.user.id } });
  if (trainings.length > 0) {
    try {
      await (prisma as any).candidateTraining.createMany({
        data: trainings.map((t) => ({ ...t, candidateId: c.id }))
      });
    } catch { /* table absente avant migration — silencieux */ }
  }
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Candidate", entityId: c.id, message: `Candidat ${c.firstName} ${c.lastName} créé`, after: c });
  revalidatePath("/candidates");
  redirect(`/candidates/${c.id}`);
}

export async function updateCandidate(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.candidate.findUniqueOrThrow({ where: { id } });
  const parsed = Schema.parse(Object.fromEntries(formData));
  const { trainings, ...data } = parsed;
  // Si la ville a changé → on efface les anciennes coords/CP pour forcer un
  // re-géocodage. L'admin peut aussi fournir un CP à la main dans le form.
  let patch: any = { ...data };
  if (before.city && data.city && before.city !== data.city) {
    patch = { ...patch, postalCode: patch.postalCode ?? null, latitude: null, longitude: null };
  }
  const enriched = await enrichWithGeocode(patch);
  const after = await (prisma as any).candidate.update({ where: { id }, data: enriched });
  try {
    await (prisma as any).candidateTraining.deleteMany({ where: { candidateId: id } });
    if (trainings.length > 0) {
      await (prisma as any).candidateTraining.createMany({
        data: trainings.map((t) => ({ ...t, candidateId: id }))
      });
    }
  } catch { /* table absente avant migration — silencieux */ }
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Candidate", entityId: id, message: `Candidat mis à jour`, before, after });
  revalidatePath(`/candidates/${id}`); revalidatePath("/candidates");
}

export async function deleteCandidate(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.candidate.findUniqueOrThrow({ where: { id } });
  await prisma.candidate.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Candidate", entityId: id, message: "Candidat supprimé", before });
  revalidatePath("/candidates");
  redirect("/candidates");
}
