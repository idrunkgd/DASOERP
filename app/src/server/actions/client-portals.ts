"use server";
/**
 * Server actions côté ADMIN pour la gestion des portails clients.
 * Les actions côté public (par token) sont dans client-portal-public.ts.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PortalSchema = z.object({
  name: z.string().min(1).max(120),
  companyId: z.string().min(1),
  logoUrl: z.string().optional().nullable().transform((v) => {
    const t = (v ?? "").trim();
    if (!t) return null;
    // Limite data URI à ~1 MB
    if (t.length > 1_400_000) throw new Error("Logo trop volumineux (>1 Mo)");
    return t;
  }),
  contactName: z.string().optional().nullable().transform((v) => v?.trim() || null),
  contactEmail: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  isActive: z.coerce.boolean().default(true),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createClientPortal(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const raw = Object.fromEntries(formData) as Record<string, any>;
  const data = PortalSchema.parse(raw);

  // Premier contact obligatoire — on refuse la création sans.
  const firstContactName  = (raw.firstContactName  as string | undefined)?.trim();
  const firstContactEmail = (raw.firstContactEmail as string | undefined)?.trim() || null;
  const firstContactJobTitle = (raw.firstContactJobTitle as string | undefined)?.trim() || null;
  if (!firstContactName) {
    throw new Error("Un premier contact client est obligatoire pour créer le portail.");
  }
  if (firstContactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(firstContactEmail)) {
    throw new Error("Email du premier contact invalide.");
  }

  const portalId = await prisma.$transaction(async (tx) => {
    const portal = await (tx as any).clientPortal.create({
      // Nouveaux portails en V2 par défaut.
      data: { ...data, createdById: session.user.id, workflowVersion: "V2" }
    });
    await (tx as any).clientPortalContact.create({
      data: {
        portalId: portal.id,
        name: firstContactName,
        email: firstContactEmail,
        jobTitle: firstContactJobTitle,
        createdById: session.user.id
      }
    });
    return portal.id;
  });

  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "ClientPortal",
    entityId: portalId,
    message: `Portail client « ${data.name} » créé avec contact initial « ${firstContactName} »`
  });
  revalidatePath("/client-portals");
  redirect(`/client-portals/${portalId}`);
}

export async function updateClientPortal(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = PortalSchema.parse(Object.fromEntries(formData));
  const before = await (prisma as any).clientPortal.findUniqueOrThrow({ where: { id } });
  const portal = await (prisma as any).clientPortal.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortal",
    entityId: id, message: `Portail « ${portal.name} » mis à jour`, before, after: portal
  });
  revalidatePath("/client-portals");
  revalidatePath(`/client-portals/${id}`);
}

export async function regenerateClientPortalToken(id: string) {
  const session = await requirePermission("consulting.write");
  // Nouveau token = nouveau cuid (impossible à prédire depuis l'ancien)
  const randomToken = `cp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  const portal = await (prisma as any).clientPortal.update({
    where: { id }, data: { token: randomToken }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortal",
    entityId: id, message: `Token portail « ${portal.name} » régénéré (ancien lien invalidé)`
  });
  revalidatePath(`/client-portals/${id}`);
  return { ok: true, newToken: portal.token };
}

export async function deleteClientPortal(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).clientPortal.findUniqueOrThrow({ where: { id } });
  await (prisma as any).clientPortal.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "ClientPortal",
    entityId: id, message: `Portail « ${before.name} » supprimé`
  });
  revalidatePath("/client-portals");
  redirect("/client-portals");
}

// ─── Propositions candidat ──────────────────────────────────────────

const ProposalSchema = z.object({
  portalId: z.string().min(1),
  candidateId: z.string().min(1),
  missionRequestId: z.string().optional().nullable().transform((v) => v || null),
  /// Besoin du portail auquel rattacher cette proposition (recommandé).
  needId: z.string().optional().nullable().transform((v) => v?.trim() || null),
  proposedDailyRate: z.coerce.number().positive(),
  internalNote: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createProposal(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = ProposalSchema.parse(Object.fromEntries(formData));
  // L'owner du candidat (= créateur du candidat) reçoit les notifs
  const candidate = await prisma.candidate.findUnique({
    where: { id: data.candidateId },
    select: { ownerId: true, firstName: true, lastName: true }
  });
  if (!candidate) throw new Error("Candidat introuvable");
  const portal = await (prisma as any).clientPortal.findUnique({
    where: { id: data.portalId }, select: { name: true, isActive: true }
  });
  if (!portal) throw new Error("Portail introuvable");
  if (!portal.isActive) throw new Error("Portail inactif — réactive-le avant de proposer");

  const proposal = await (prisma as any).candidateProposal.create({
    data: {
      ...data,
      ownerUserId: candidate.ownerId,
      createdById: session.user.id,
      status: "PROPOSED"
    }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "CandidateProposal",
    entityId: proposal.id,
    message: `${candidate.firstName} ${candidate.lastName} proposé(e) à ${portal.name} au tarif ${data.proposedDailyRate} €/j`
  });
  revalidatePath(`/candidates/${data.candidateId}`);
  revalidatePath(`/client-portals/${data.portalId}`);
  return { ok: true, id: proposal.id };
}

// ─── Besoins du portail (ClientPortalNeed) ─────────────────────────────

const NeedSchema = z.object({
  portalId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null),
  status: z.enum(["OPEN", "FILLED", "CLOSED"]).default("OPEN"),
  sortOrder: z.coerce.number().int().optional().default(0)
});

export async function createPortalNeed(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = NeedSchema.parse(Object.fromEntries(formData));
  const need = await (prisma as any).clientPortalNeed.create({ data });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "ClientPortalNeed",
    entityId: need.id, message: `Besoin « ${data.title} » ajouté au portail`
  });
  revalidatePath(`/client-portals/${data.portalId}`);
  return { ok: true, id: need.id };
}

export async function updatePortalNeed(id: string, patch: {
  title?: string; description?: string | null; status?: "OPEN" | "FILLED" | "CLOSED"; sortOrder?: number;
}) {
  const session = await requirePermission("consulting.write");
  const existing = await (prisma as any).clientPortalNeed.findUniqueOrThrow({ where: { id } });
  await (prisma as any).clientPortalNeed.update({ where: { id }, data: patch });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortalNeed",
    entityId: id, message: `Besoin mis à jour (${patch.status ? "statut " + patch.status : "métadonnées"})`
  });
  revalidatePath(`/client-portals/${existing.portalId}`);
  return { ok: true };
}

export async function deletePortalNeed(id: string) {
  const session = await requirePermission("consulting.write");
  const existing = await (prisma as any).clientPortalNeed.findUniqueOrThrow({ where: { id } });
  await (prisma as any).clientPortalNeed.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "ClientPortalNeed",
    entityId: id, message: `Besoin supprimé — les propositions liées sont conservées sans rattachement`
  });
  revalidatePath(`/client-portals/${existing.portalId}`);
  return { ok: true };
}

/** Rattache / détache une proposition d'un besoin spécifique du portail. */
export async function assignProposalToNeed(proposalId: string, needId: string | null) {
  const session = await requirePermission("consulting.write");
  const p = await (prisma as any).candidateProposal.findUniqueOrThrow({
    where: { id: proposalId }, select: { portalId: true, candidateId: true }
  });
  // Si needId non null, on vérifie que le besoin appartient bien au même portail
  if (needId) {
    const n = await (prisma as any).clientPortalNeed.findUniqueOrThrow({
      where: { id: needId }, select: { portalId: true }
    });
    if (n.portalId !== p.portalId) throw new Error("Ce besoin n'appartient pas à ce portail.");
  }
  await (prisma as any).candidateProposal.update({
    where: { id: proposalId }, data: { needId }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: proposalId,
    message: needId ? `Candidat rattaché à un besoin` : `Candidat détaché du besoin`
  });
  revalidatePath(`/client-portals/${p.portalId}`);
  return { ok: true };
}

export async function retractProposal(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).candidateProposal.findUniqueOrThrow({ where: { id } });
  await (prisma as any).candidateProposal.update({
    where: { id }, data: { isVisible: false }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: id, message: `Proposition retirée du portail (invisible côté client)`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
  revalidatePath(`/candidates/${before.candidateId}`);
}

export async function restoreProposal(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).candidateProposal.findUniqueOrThrow({ where: { id } });
  await (prisma as any).candidateProposal.update({
    where: { id }, data: { isVisible: true }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: id, message: `Proposition remise visible côté client`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
  revalidatePath(`/candidates/${before.candidateId}`);
}

/**
 * Ajoute une réponse Dasolabs au fil de discussion d'une proposition.
 * Visible côté client dans le portail.
 */
export async function addDasolabsReply(input: {
  proposalId: string;
  content: string;
}) {
  const session = await requirePermission("consulting.write");
  const content = input.content?.trim();
  if (!content) throw new Error("Message vide.");
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true }
  });
  const authorName = `${u.firstName} ${u.lastName}`.trim();

  const p = await (prisma as any).candidateProposal.findUniqueOrThrow({
    where: { id: input.proposalId },
    select: { portalId: true }
  });

  await (prisma as any).candidateProposalComment.create({
    data: {
      proposalId: input.proposalId,
      authorKind: "DASOLABS",
      authorName,
      authorUserId: session.user.id,
      content
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: input.proposalId,
    message: `Réponse Dasolabs : « ${content.slice(0, 120)} »`
  });
  revalidatePath(`/client-portals/${p.portalId}`);
}

/**
 * Marque un entretien comme effectué (côté admin). Enregistre notes + heure.
 * Débloque la décision suivante côté client (accept / shortlist / ent. 2 / reject).
 */
export async function markInterviewDone(input: {
  proposalId: string;
  which: 1 | 2;
  notes?: string;
}) {
  const session = await requirePermission("consulting.write");
  const p = await (prisma as any).candidateProposal.findUniqueOrThrow({
    where: { id: input.proposalId }
  });

  const expected = input.which === 1 ? "INTERVIEW_1_REQUESTED" : "INTERVIEW_2_REQUESTED";
  const next     = input.which === 1 ? "INTERVIEW_1_DONE"      : "INTERVIEW_2_DONE";
  if (p.status !== expected) {
    throw new Error(`Statut inattendu (${p.status}). Un entretien doit d'abord être demandé.`);
  }

  const data: Record<string, any> = { status: next };
  if (input.which === 1) {
    data.interview1DoneAt = new Date();
    data.interview1Notes  = input.notes?.trim() || null;
  } else {
    data.interview2DoneAt = new Date();
    data.interview2Notes  = input.notes?.trim() || null;
  }
  await (prisma as any).candidateProposal.update({ where: { id: p.id }, data });

  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: p.id,
    message: `Entretien ${input.which} effectué — notes partagées au client`
  });
  revalidatePath(`/client-portals/${p.portalId}`);
}

/**
 * Confirme un créneau précis parmi ceux proposés par le client.
 * Garde la date pour affichage côté client.
 */
export async function confirmInterviewSlot(input: {
  proposalId: string;
  which: 1 | 2;
  slotIndex: number;
}) {
  const session = await requirePermission("consulting.write");
  const p = await (prisma as any).candidateProposal.findUniqueOrThrow({
    where: { id: input.proposalId }
  });
  const slotsField = input.which === 1 ? "interview1Slots" : "interview2Slots";
  const confirmField = input.which === 1 ? "interview1ConfirmedAt" : "interview2ConfirmedAt";
  const slots = (p as any)[slotsField] as Array<any> | null;
  if (!slots || !slots[input.slotIndex]) throw new Error("Créneau introuvable.");
  const chosen = slots[input.slotIndex];
  const iso = new Date(`${chosen.date}T${chosen.startTime}:00`);
  await (prisma as any).candidateProposal.update({
    where: { id: p.id },
    data: { [confirmField]: iso }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: p.id,
    message: `Créneau entretien ${input.which} confirmé : ${chosen.date} ${chosen.startTime}–${chosen.endTime} (${chosen.mode})`
  });
  revalidatePath(`/client-portals/${p.portalId}`);
}

/**
 * Bascule le workflow du portail (LEGACY ↔ V2).
 * Lors de LEGACY → V2, convertit les statuts des propositions existantes :
 *   INTERVIEW_REQUESTED  → INTERVIEW_1_REQUESTED
 *   (PROPOSED / ACCEPTED / REJECTED restent identiques, ils sont communs)
 * Lors de V2 → LEGACY, convertit dans l'autre sens (perte d'info sur le
 * numéro d'entretien, mais la bascule reste réversible).
 */
export async function setPortalWorkflow(portalId: string, version: "LEGACY" | "V2") {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).clientPortal.findUniqueOrThrow({ where: { id: portalId } });

  let migrated = 0;
  await prisma.$transaction(async (tx) => {
    await (tx as any).clientPortal.update({
      where: { id: portalId }, data: { workflowVersion: version }
    });

    if (version === "V2" && before.workflowVersion === "LEGACY") {
      // LEGACY → V2 : mappe l'ancien statut vers le nouveau
      const legacyProposals = await (tx as any).candidateProposal.findMany({
        where: { portalId, status: "INTERVIEW_REQUESTED" },
        select: { id: true }
      });
      for (const p of legacyProposals) {
        await (tx as any).candidateProposal.update({
          where: { id: p.id },
          data: { status: "INTERVIEW_1_REQUESTED" }
        });
        migrated++;
      }
    } else if (version === "LEGACY" && before.workflowVersion === "V2") {
      // V2 → LEGACY : regroupe tous les statuts intermédiaires vers INTERVIEW_REQUESTED
      const v2InFlight = await (tx as any).candidateProposal.findMany({
        where: {
          portalId,
          status: {
            in: ["INTERVIEW_1_REQUESTED", "INTERVIEW_1_DONE",
                 "INTERVIEW_2_REQUESTED", "INTERVIEW_2_DONE", "SHORTLISTED"]
          }
        },
        select: { id: true }
      });
      for (const p of v2InFlight) {
        await (tx as any).candidateProposal.update({
          where: { id: p.id },
          data: { status: "INTERVIEW_REQUESTED" }
        });
        migrated++;
      }
    }
  });

  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortal",
    entityId: portalId,
    message: `Portail basculé ${before.workflowVersion} → ${version}${migrated ? ` (${migrated} proposition${migrated > 1 ? "s" : ""} migrée${migrated > 1 ? "s" : ""})` : ""}`
  });
  revalidatePath(`/client-portals/${portalId}`);
  return { ok: true, migrated };
}

/**
 * Migration en masse : bascule TOUS les portails LEGACY actifs en V2.
 * Pratique pour la bascule globale après validation sur un portail test.
 */
export async function migrateAllPortalsToV2() {
  const session = await requirePermission("consulting.write");
  const legacyPortals = await (prisma as any).clientPortal.findMany({
    where: { workflowVersion: "LEGACY", isActive: true },
    select: { id: true, name: true }
  });

  const results: Array<{ portalId: string; name: string; migrated: number }> = [];
  for (const portal of legacyPortals) {
    const { migrated } = await setPortalWorkflow(portal.id, "V2");
    results.push({ portalId: portal.id, name: portal.name, migrated });
  }

  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortal",
    message: `Migration en masse : ${results.length} portail(s) basculé(s) en V2`
  });

  return { ok: true, portals: results };
}

/**
 * Remet une proposition à l'état « En attente » (PROPOSED) même après
 * ACCEPTED / REJECTED / INTERVIEW_REQUESTED. Pratique si le client s'est
 * trompé ou si on veut relancer la décision après discussion.
 *
 * Efface aussi le message client et la date d'action pour que le portail
 * repropose les 3 boutons au client.
 */
export async function resetProposalStatus(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).candidateProposal.findUniqueOrThrow({ where: { id } });
  await (prisma as any).candidateProposal.update({
    where: { id },
    data: {
      status: "PROPOSED",
      clientMessage: null,
      clientActedAt: null,
      isVisible: true
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: id,
    message: `Proposition remise en « En attente » (ancien statut : ${before.status})`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
  revalidatePath(`/candidates/${before.candidateId}`);
}

// ─── Contacts personnels (liens nominatifs par interlocuteur) ───────

const ContactSchema = z.object({
  portalId: z.string().min(1),
  name:     z.string().min(1).max(120),
  email:    z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  jobTitle: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createPortalContact(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = ContactSchema.parse(Object.fromEntries(formData));
  const contact = await (prisma as any).clientPortalContact.create({
    data: { ...data, createdById: session.user.id }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "ClientPortalContact",
    entityId: contact.id,
    message: `Lien personnel créé pour « ${contact.name} »${contact.email ? ` (${contact.email})` : ""}`
  });
  revalidatePath(`/client-portals/${data.portalId}`);
  return { ok: true, id: contact.id, token: contact.token };
}

export async function updatePortalContact(id: string, formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = ContactSchema.omit({ portalId: true }).parse(Object.fromEntries(formData));
  const before = await (prisma as any).clientPortalContact.findUniqueOrThrow({ where: { id } });
  const after = await (prisma as any).clientPortalContact.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortalContact",
    entityId: id, message: `Contact personnel mis à jour`, before, after
  });
  revalidatePath(`/client-portals/${before.portalId}`);
}

export async function togglePortalContact(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).clientPortalContact.findUniqueOrThrow({ where: { id } });
  await (prisma as any).clientPortalContact.update({
    where: { id }, data: { isActive: !before.isActive }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortalContact",
    entityId: id,
    message: `Lien personnel « ${before.name} » ${before.isActive ? "désactivé" : "réactivé"}`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
}

export async function deletePortalContact(id: string) {
  const session = await requirePermission("consulting.write");
  const before = await (prisma as any).clientPortalContact.findUniqueOrThrow({ where: { id } });
  await (prisma as any).clientPortalContact.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "ClientPortalContact",
    entityId: id, message: `Lien personnel « ${before.name} » supprimé`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
}

export async function regeneratePortalContactToken(id: string) {
  const session = await requirePermission("consulting.write");
  const randomToken = `cpc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  const after = await (prisma as any).clientPortalContact.update({
    where: { id }, data: { token: randomToken }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "ClientPortalContact",
    entityId: id,
    message: `Token personnel « ${after.name} » régénéré (ancien lien invalidé)`
  });
  revalidatePath(`/client-portals/${after.portalId}`);
  return { ok: true, newToken: after.token };
}

export async function updateProposalRate(id: string, newRate: number, internalNote?: string) {
  const session = await requirePermission("consulting.write");
  if (newRate <= 0) throw new Error("Tarif invalide");
  const before = await (prisma as any).candidateProposal.findUniqueOrThrow({ where: { id } });
  await (prisma as any).candidateProposal.update({
    where: { id },
    data: { proposedDailyRate: newRate, internalNote: internalNote?.trim() || before.internalNote }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "CandidateProposal",
    entityId: id, message: `Tarif proposition mis à jour : ${before.proposedDailyRate} → ${newRate} €/j`
  });
  revalidatePath(`/client-portals/${before.portalId}`);
}
