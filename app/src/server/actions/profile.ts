"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Mise à jour du profil par l'utilisateur lui-même.
 * Champs autorisés : photo, téléphone, LinkedIn, ville, langues, compétences,
 * mot de passe (avec confirmation de l'ancien).
 * Pas de modification du rôle, du groupe d'accès, du taux ou de l'email.
 */
const SelfSchema = z.object({
  photoUrl: z.string().optional().nullable().transform(v => {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (t.length > 1_400_000) throw new Error("Photo trop volumineuse (>1 Mo)");
    return t;
  }),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  spokenLanguages: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  skills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  interests: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  // Point de contact pour le CV
  cvContactName:  z.string().optional().nullable().transform(v => (v?.trim() || null)),
  cvContactRole:  z.string().optional().nullable().transform(v => (v?.trim() || null)),
  cvContactEmail: z.string().optional().nullable().transform(v => (v?.trim() || null)),
  cvContactPhone: z.string().optional().nullable().transform(v => (v?.trim() || null)),
  // Formations — JSON serialisé depuis l'UI
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
  currentPassword: z.string().optional().or(z.literal("")),
  newPassword: z.string().optional().or(z.literal(""))
});

export async function updateMyProfile(formData: FormData) {
  const session = await requireSession();
  const data = SelfSchema.parse(Object.fromEntries(formData));
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  const updateData: any = {
    photoUrl: data.photoUrl,
    phone: data.phone,
    linkedinUrl: data.linkedinUrl,
    city: data.city,
    spokenLanguages: data.spokenLanguages,
    skills: data.skills,
    interests: data.interests,
    cvContactName:  data.cvContactName,
    cvContactRole:  data.cvContactRole,
    cvContactEmail: data.cvContactEmail,
    cvContactPhone: data.cvContactPhone
  };

  // Changement de mot de passe optionnel
  if (data.newPassword) {
    if (data.newPassword.length < 8) throw new Error("Le nouveau mot de passe doit faire au moins 8 caractères");
    if (!data.currentPassword) throw new Error("Mot de passe actuel requis pour le changer");
    const ok = await bcrypt.compare(data.currentPassword, me.passwordHash);
    if (!ok) throw new Error("Mot de passe actuel incorrect");
    updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }

  await prisma.user.update({ where: { id: me.id }, data: updateData });

  // Formations : replace-all simple (supprime les anciennes, insère les nouvelles).
  // Pour un volume raisonnable (quelques entrées par consultant) c'est suffisant.
  await (prisma as any).userTraining.deleteMany({ where: { userId: me.id } });
  if (data.trainings.length > 0) {
    await (prisma as any).userTraining.createMany({
      data: data.trainings.map((t) => ({ ...t, userId: me.id }))
    });
  }
  await logActivity({
    actorId: me.id, action: "UPDATE", entityType: "User", entityId: me.id,
    message: `Profil personnel mis à jour${data.newPassword ? " (mot de passe modifié)" : ""}`
  });
  revalidatePath("/me");
}
