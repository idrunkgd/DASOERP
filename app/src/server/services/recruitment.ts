import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { DEFAULT_GROUP_NAME } from "@/lib/rbac";

/**
 * Promotion d'un Candidat externe en Consultant interne (User actif).
 * - Crée un User CONSULTANT avec un mot de passe temporaire (à transmettre hors-bande)
 * - Recopie le profil (photo, compétences, taux, langues, séniorité…)
 * - Lie les deux entités via Candidate.convertedToUserId
 * - Marque le Candidate comme ARCHIVED (il sort du vivier candidats)
 */
export async function promoteCandidateToConsultant(opts: {
  actorId: string;
  candidateId: string;
  email: string;             // email pro Dasolabs (souvent ≠ email candidat)
  tempPassword: string;
  role?: "CONSULTANT" | "MANAGER" | "COMMERCIAL" | "FINANCE";
  joinedAt?: Date;
  weeklyCapacityH?: number;
}) {
  const { actorId, candidateId, email, tempPassword, role = "CONSULTANT", joinedAt, weeklyCapacityH } = opts;

  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  if (candidate.convertedToUserId) {
    throw new Error("Ce candidat a déjà été recruté.");
  }
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new Error(`Un utilisateur existe déjà avec l'email ${email}.`);

  const passwordHash = await bcrypt.hash(tempPassword, 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName: candidate.firstName,
        lastName:  candidate.lastName,
        role,
        active: true,
        photoUrl: candidate.photoUrl,
        phone: candidate.phone,
        linkedinUrl: candidate.linkedinUrl,
        city: candidate.city,
        seniority: candidate.seniority,
        yearsExperience: candidate.yearsExperience,
        spokenLanguages: candidate.spokenLanguages,
        skills: candidate.skills,
        dailyCost: candidate.dailyCost,
        hourlyCost: candidate.hourlyCost,
        weeklyCapacityH: weeklyCapacityH ?? 38,
        joinedAt: joinedAt ?? new Date()
      }
    });
    await tx.candidate.update({
      where: { id: candidateId },
      data: {
        convertedToUserId: user.id,
        convertedAt: new Date(),
        // Le candidat sort du vivier externe : il est maintenant employé Dasolabs.
        // ARCHIVED → masqué par défaut dans la liste candidats (exclusivité avec /consultants).
        status: "ARCHIVED"
      }
    });
    await logActivity({
      actorId, action: "STATUS_CHANGE", entityType: "Candidate", entityId: candidate.id,
      message: `Candidat ${candidate.firstName} ${candidate.lastName} promu Consultant — User ${user.email} créé`,
      diff: { candidateId, userId: user.id, role } as any
    });
    return user;
  });
}

/**
 * Crée un compte portail pour un candidat — il pourra se connecter et compléter
 * son CV en self-service. Le compte est en groupe Visiteur (aucun accès aux modules),
 * il ne peut éditer que son profil.
 *
 * Distinct de promoteCandidateToConsultant : ici le candidat reste candidat externe,
 * on lui ouvre juste un portail d'auto-saisie.
 */
export async function createCandidatePortalAccount(opts: {
  actorId: string;
  candidateId: string;
  email: string;
  tempPassword: string;
}) {
  const { actorId, candidateId, email, tempPassword } = opts;
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateId } });
  if (candidate.portalUserId) throw new Error("Ce candidat a déjà un compte portail.");
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new Error(`Un utilisateur existe déjà avec l'email ${email}.`);
  // Convention : un email portail commence par "ext." pour bien distinguer des
  // emails consultants internes. On le warne mais on n'impose pas (libre choix admin).

  const passwordHash = await bcrypt.hash(tempPassword, 10);
  // On lui assigne le groupe Visiteur (aucun accès — ne peut éditer que son profil)
  const visitorGroup = await prisma.accessGroup.findUnique({ where: { name: DEFAULT_GROUP_NAME } });

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName: candidate.firstName,
        lastName:  candidate.lastName,
        role: "CONSULTANT",        // étiquette neutre — le rôle n'a pas d'impact
        active: true,
        photoUrl: candidate.photoUrl,
        phone: candidate.phone,
        linkedinUrl: candidate.linkedinUrl,
        city: candidate.city,
        seniority: candidate.seniority,
        yearsExperience: candidate.yearsExperience,
        spokenLanguages: candidate.spokenLanguages,
        skills: candidate.skills,
        accessGroupId: visitorGroup?.id ?? null
      }
    });
    await tx.candidate.update({
      where: { id: candidateId },
      data: { portalUserId: user.id }
    });
    await logActivity({
      actorId, action: "CREATE", entityType: "User", entityId: user.id,
      message: `Compte portail créé pour candidat ${candidate.firstName} ${candidate.lastName} (${email})`
    });
    return user;
  });
}

/**
 * Marque un consultant comme ayant quitté Dasolabs.
 * - User devient inactif (ne peut plus se logger), leftAt = aujourd'hui
 * - Option keepInPool : recrée un Candidate à partir du profil consultant (vivier réutilisable)
 */
export async function offboardConsultant(opts: {
  actorId: string;
  userId: string;
  keepInPool: boolean;
  reason?: string | null;
}) {
  const { actorId, userId, keepInPool, reason } = opts;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.active) throw new Error("Cet utilisateur est déjà inactif.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { active: false, leftAt: new Date() }
    });
    let createdCandidate = null;
    if (keepInPool) {
      // Si l'utilisateur vient lui-même d'un Candidate, on rouvre celui-ci.
      // On détache convertedToUserId pour le faire ressortir dans le vivier (le User
      // référencé est désormais inactif, donc plus de "double présence").
      const origin = await tx.candidate.findFirst({ where: { convertedToUserId: userId } });
      if (origin) {
        createdCandidate = await tx.candidate.update({
          where: { id: origin.id },
          data: {
            status: "ACTIVE",
            availableFrom: new Date(),
            convertedToUserId: null,
            // On met à jour les compétences/taux/profil avec l'état le plus récent du consultant
            photoUrl: user.photoUrl ?? origin.photoUrl,
            phone: user.phone ?? origin.phone,
            linkedinUrl: user.linkedinUrl ?? origin.linkedinUrl,
            city: user.city ?? origin.city,
            seniority: user.seniority ?? origin.seniority,
            yearsExperience: user.yearsExperience ?? origin.yearsExperience,
            spokenLanguages: user.spokenLanguages.length > 0 ? user.spokenLanguages : origin.spokenLanguages,
            skills: user.skills.length > 0 ? user.skills : origin.skills,
            dailyCost: user.dailyCost ?? origin.dailyCost,
            hourlyCost: user.hourlyCost ?? origin.hourlyCost,
            notes: [origin.notes, reason ? `Re-disponible suite à départ Dasolabs — ${reason}` : "Re-disponible suite à départ Dasolabs"].filter(Boolean).join("\n")
          }
        });
      } else {
        createdCandidate = await tx.candidate.create({
          data: {
            firstName: user.firstName, lastName: user.lastName,
            email: user.email,
            photoUrl: user.photoUrl, phone: user.phone, linkedinUrl: user.linkedinUrl,
            city: user.city, seniority: user.seniority, yearsExperience: user.yearsExperience,
            spokenLanguages: user.spokenLanguages, skills: user.skills,
            dailyCost: user.dailyCost, hourlyCost: user.hourlyCost,
            status: "ACTIVE", availableFrom: new Date(),
            source: "Ancien consultant Dasolabs",
            notes: reason ? `Départ Dasolabs : ${reason}` : "Ancien consultant Dasolabs",
            ownerId: actorId
          }
        });
      }
    }
    await logActivity({
      actorId, action: "STATUS_CHANGE", entityType: "User", entityId: userId,
      message: `Consultant ${user.firstName} ${user.lastName} a quitté Dasolabs${keepInPool ? " (gardé dans le vivier)" : ""}${reason ? ` — ${reason}` : ""}`,
      diff: { previousActive: true, leftAt: updated.leftAt, keepInPool, candidateId: createdCandidate?.id } as any
    });
    return { user: updated, candidate: createdCandidate };
  });
}
