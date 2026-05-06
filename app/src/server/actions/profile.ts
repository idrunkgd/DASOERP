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
    skills: data.skills
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
  await logActivity({
    actorId: me.id, action: "UPDATE", entityType: "User", entityId: me.id,
    message: `Profil personnel mis à jour${data.newPassword ? " (mot de passe modifié)" : ""}`
  });
  revalidatePath("/me");
}
