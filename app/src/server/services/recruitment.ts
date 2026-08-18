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
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true, firstName: true, lastName: true, role: true, active: true,
      leftAt: true, candidateProfile: { select: { id: true } }
    }
  });

  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // ─── CAS RÉEMBAUCHE ───
  // L'offboarding ne SUPPRIME pas le User : il le désactive (active=false,
  // leftAt renseigné) et détache le Candidate (convertedToUserId=null) pour
  // le remettre dans le vivier. L'email reste donc pris par ce compte
  // inactif. Si on retente de recruter la même personne plus tard, on doit
  // RÉACTIVER l'ancien compte au lieu d'échouer sur une collision d'email.
  //
  // Sécurité : on ne réactive que si le compte est bien un ancien
  // consultant parti (active=false ET leftAt non null) ET que ce n'est pas
  // un compte portail candidat (candidateProfile null).
  if (existing && !existing.active && existing.leftAt && !existing.candidateProfile) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,          // nouveau mot de passe initial
          active: true,
          leftAt: null,          // il revient !
          role,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          // Rafraîchit le profil avec les données à jour du candidat
          photoUrl: candidate.photoUrl ?? undefined,
          phone: candidate.phone ?? undefined,
          linkedinUrl: candidate.linkedinUrl ?? undefined,
          city: candidate.city ?? undefined,
          seniority: candidate.seniority ?? undefined,
          yearsExperience: candidate.yearsExperience ?? undefined,
          spokenLanguages: candidate.spokenLanguages.length > 0 ? candidate.spokenLanguages : undefined,
          skills: candidate.skills.length > 0 ? candidate.skills : undefined,
          dailyCost: candidate.dailyCost ?? undefined,
          hourlyCost: candidate.hourlyCost ?? undefined,
          weeklyCapacityH: weeklyCapacityH ?? 38,
          joinedAt: joinedAt ?? new Date()
        }
      });
      // Re-copie les expériences manquantes (idempotent sur companyName+startDate)
      const [candidateExperiences, userExperiences] = await Promise.all([
        tx.candidateExperience.findMany({ where: { candidateId } }),
        tx.userExperience.findMany({
          where: { userId: user.id },
          select: { companyName: true, startDate: true }
        })
      ]);
      const existingKeys = new Set(
        userExperiences.map((e) => `${e.companyName}|${e.startDate.toISOString().slice(0, 10)}`)
      );
      const toCreate = candidateExperiences.filter(
        (e) => !existingKeys.has(`${e.companyName}|${e.startDate.toISOString().slice(0, 10)}`)
      );
      if (toCreate.length > 0) {
        await tx.userExperience.createMany({
          data: toCreate.map((e) => ({
            userId: user.id,
            companyName: e.companyName,
            jobTitle: e.jobTitle,
            startDate: e.startDate,
            endDate: e.endDate,
            description: e.description
          }))
        });
      }
      await tx.candidate.update({
        where: { id: candidateId },
        data: { convertedToUserId: user.id, convertedAt: new Date(), status: "ARCHIVED" }
      });
      await logActivity({
        actorId, action: "STATUS_CHANGE", entityType: "Candidate", entityId: candidate.id,
        message: `RÉEMBAUCHE : ${candidate.firstName} ${candidate.lastName} — compte ${user.email} réactivé (${toCreate.length} expérience(s) ajoutée(s))`,
        diff: { candidateId, userId: user.id, role, reactivated: true } as any
      });
      return user;
    });
  }

  // ─── CAS COLLISION RÉELLE ───
  if (existing) {
    throw new Error(
      `Un utilisateur existe déjà avec l'email ${email} : ${existing.firstName} ${existing.lastName} ` +
      `(rôle ${existing.role}${existing.active ? ", actif" : ", inactif"}). ` +
      `Ouvre sa fiche : /users/${existing.id} — ou choisis un autre email.`
    );
  }

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
    // ✱ Copie du CV (CandidateExperience → UserExperience). Structure
    // identique entre les deux modèles, donc mapping trivial. Sans cette
    // étape, le CV s'évaporait lors de la promotion : sur la fiche du
    // nouveau consultant, l'onglet Expériences était vide alors que le
    // candidat avait bien un historique côté /candidates.
    const candidateExperiences = await tx.candidateExperience.findMany({
      where: { candidateId }
    });
    if (candidateExperiences.length > 0) {
      await tx.userExperience.createMany({
        data: candidateExperiences.map((e) => ({
          userId: user.id,
          companyName: e.companyName,
          jobTitle: e.jobTitle,
          startDate: e.startDate,
          endDate: e.endDate,
          description: e.description
        }))
      });
    }
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
      message: `Candidat ${candidate.firstName} ${candidate.lastName} promu Consultant — User ${user.email} créé (${candidateExperiences.length} expérience${candidateExperiences.length > 1 ? "s" : ""} recopiée${candidateExperiences.length > 1 ? "s" : ""})`,
      diff: { candidateId, userId: user.id, role, copiedExperiences: candidateExperiences.length } as any
    });
    return user;
  });
}

/**
 * Ré-copie les expériences d'un candidat vers son user consultant existant.
 * Cas d'usage : bug historique où la promotion perdait le CV — cette action
 * permet de rattraper sans avoir à re-saisir les expériences à la main.
 *
 * Comportement idempotent : on ne duplique pas les expériences déjà présentes
 * côté user (matching sur companyName + startDate).
 */
export async function backfillPromotedCandidateExperiences(opts: {
  actorId: string;
  candidateId: string;
}) {
  const { actorId, candidateId } = opts;
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { experiences: true, convertedToUser: true }
  });
  if (!candidate.convertedToUserId || !candidate.convertedToUser) {
    throw new Error("Ce candidat n'a pas été recruté — rien à recopier.");
  }
  if (candidate.experiences.length === 0) {
    throw new Error("Ce candidat n'a aucune expérience à recopier.");
  }
  const existing = await prisma.userExperience.findMany({
    where: { userId: candidate.convertedToUserId },
    select: { companyName: true, startDate: true }
  });
  const existingKey = new Set(
    existing.map((e) => `${e.companyName}|${e.startDate.toISOString().slice(0, 10)}`)
  );
  const toCreate = candidate.experiences.filter((e) => {
    const key = `${e.companyName}|${e.startDate.toISOString().slice(0, 10)}`;
    return !existingKey.has(key);
  });
  if (toCreate.length === 0) return { created: 0 };
  await prisma.userExperience.createMany({
    data: toCreate.map((e) => ({
      userId: candidate.convertedToUserId!,
      companyName: e.companyName,
      jobTitle: e.jobTitle,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description
    }))
  });
  await logActivity({
    actorId, action: "UPDATE", entityType: "User", entityId: candidate.convertedToUserId,
    message: `Backfill CV : ${toCreate.length} expérience${toCreate.length > 1 ? "s" : ""} recopiée${toCreate.length > 1 ? "s" : ""} depuis le candidat`,
    diff: { candidateId, userId: candidate.convertedToUserId, created: toCreate.length } as any
  });
  return { created: toCreate.length };
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
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, firstName: true, lastName: true, role: true, active: true }
  });
  if (existing) {
    throw new Error(
      `Un utilisateur existe déjà avec l'email ${email} : ${existing.firstName} ${existing.lastName} ` +
      `(rôle ${existing.role}${existing.active ? "" : ", inactif"}). ` +
      `Ouvre sa fiche : /users/${existing.id} — ou choisis un autre email.`
    );
  }
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
