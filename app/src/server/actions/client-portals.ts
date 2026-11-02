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
  const data = PortalSchema.parse(Object.fromEntries(formData));
  const portal = await (prisma as any).clientPortal.create({
    data: { ...data, createdById: session.user.id }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "ClientPortal",
    entityId: portal.id, message: `Portail client « ${portal.name} » créé`
  });
  revalidatePath("/client-portals");
  redirect(`/client-portals/${portal.id}`);
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
