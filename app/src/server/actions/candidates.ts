"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  source: z.string().optional().nullable(),
  skills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  spokenLanguages: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  yearsExperience: z.coerce.number().int().nonnegative().optional().nullable(),
  seniority: z.string().optional().nullable(),
  dailyCost: z.coerce.number().nonnegative().optional().nullable(),
  hourlyCost: z.coerce.number().nonnegative().optional().nullable(),
  minDailyRate: z.coerce.number().nonnegative().optional().nullable(),
  /// Taux journalier vendu au client (HTVA) — distinct du coût interne
  dailyRate: z.coerce.number().nonnegative().optional().nullable(),
  /// Type de contrat quand engagé chez Dasolabs
  contractType: z.enum(["EMPLOYEE", "FREELANCE"]).optional().nullable().transform((v) => v || null),
  status: z.enum(["ACTIVE","ENGAGED","UNAVAILABLE","ARCHIVED"]).default("ACTIVE"),
  availableFrom: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  notes: z.string().optional().nullable()
});

export async function createCandidate(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = Schema.parse(Object.fromEntries(formData));
  // Garde-fou exclusivité : un User actif (consultant interne) avec ce mail empêche
  // la création d'un Candidat homonyme dans le vivier externe.
  if (data.email) {
    const collidingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (collidingUser?.active) {
      throw new Error(`Un consultant actif (${collidingUser.firstName} ${collidingUser.lastName}) utilise déjà cet email. Une personne ne peut pas être à la fois consultant interne et candidat externe.`);
    }
  }
  const c = await prisma.candidate.create({ data: { ...data, ownerId: session.user.id } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Candidate", entityId: c.id, message: `Candidat ${c.firstName} ${c.lastName} créé`, after: c });
  revalidatePath("/candidates");
  redirect(`/candidates/${c.id}`);
}

export async function updateCandidate(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const before = await prisma.candidate.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.candidate.update({ where: { id }, data });
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
