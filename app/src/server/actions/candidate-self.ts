"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Permet à un candidat connecté (User lié via Candidate.portalUserId) de mettre
 * à jour son propre CV — alimente directement la fiche Candidate dans le système.
 * Le candidat n'a accès à AUCUN autre champ : pas de tarif, pas de statut, pas
 * de propriétaire commercial, pas de notes internes.
 */
const Schema = z.object({
  candidateId: z.string().min(1),
  // Champs CV éditables par le candidat
  photoUrl: z.string().optional().nullable().transform(v => {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (t.length > 1_400_000) throw new Error("Photo trop volumineuse (>1 Mo)");
    return t;
  }),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  seniority: z.string().optional().nullable(),
  yearsExperience: z.coerce.number().int().nonnegative().optional().nullable(),
  spokenLanguages: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  skills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  // Disponibilité — le candidat peut indiquer quand il est libre
  availableFrom: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  // Mot de passe — facultatif
  currentPassword: z.string().optional().or(z.literal("")),
  newPassword: z.string().optional().or(z.literal(""))
});

export async function updateMyCv(formData: FormData) {
  const session = await requireSession();
  const data = Schema.parse(Object.fromEntries(formData));

  // Vérification stricte : le candidate doit être lié au User connecté.
  const candidate = await prisma.candidate.findUnique({
    where: { id: data.candidateId },
    select: { id: true, portalUserId: true, firstName: true, lastName: true }
  });
  if (!candidate || candidate.portalUserId !== session.user.id) {
    throw new Error("Vous n'avez pas accès à ce profil candidat.");
  }

  // Champs candidat
  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      photoUrl: data.photoUrl,
      phone: data.phone,
      linkedinUrl: data.linkedinUrl,
      city: data.city,
      seniority: data.seniority,
      yearsExperience: data.yearsExperience,
      spokenLanguages: data.spokenLanguages,
      skills: data.skills,
      availableFrom: data.availableFrom
    }
  });

  // On synchronise aussi le User (photo, téléphone, etc.) pour la cohérence visuelle
  const userUpdate: any = {
    photoUrl: data.photoUrl,
    phone: data.phone,
    linkedinUrl: data.linkedinUrl,
    city: data.city,
    seniority: data.seniority,
    yearsExperience: data.yearsExperience,
    spokenLanguages: data.spokenLanguages,
    skills: data.skills
  };

  // Changement de mot de passe optionnel
  if (data.newPassword) {
    if (data.newPassword.length < 8) throw new Error("Le nouveau mot de passe doit faire au moins 8 caractères");
    if (!data.currentPassword) throw new Error("Mot de passe actuel requis pour le changer");
    const me = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    const ok = await bcrypt.compare(data.currentPassword, me.passwordHash);
    if (!ok) throw new Error("Mot de passe actuel incorrect");
    userUpdate.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }

  await prisma.user.update({ where: { id: session.user.id }, data: userUpdate });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "Candidate", entityId: candidate.id,
    message: `CV candidat mis à jour par ${candidate.firstName} ${candidate.lastName} (self-service)${data.newPassword ? " + mot de passe modifié" : ""}`
  });
  revalidatePath("/me");
  revalidatePath(`/candidates/${candidate.id}`);
}
