"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeOfferStatus, createOffer, duplicateOffer, recomputeOfferTotals, createComplement, createNewVersion } from "@/server/services/offer-service";
import { isOfferEditable, isOfferFinal, OfferLockedError } from "@/lib/offer-rules";
import type { OfferStatus, BillingMilestoneStatus } from "@prisma/client";

/** Garde-fou : refuse toute mutation sur offre non-DRAFT. */
async function assertOfferEditable(offerId: string) {
  const o = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, select: { status: true } });
  if (!isOfferEditable(o.status)) throw new OfferLockedError(o.status);
}
async function assertLineEditable(lineId: string) {
  const l = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId }, select: { offer: { select: { status: true } } } });
  if (!isOfferEditable(l.offer.status)) throw new OfferLockedError(l.offer.status);
}
async function assertMilestoneEditable(milestoneId: string) {
  const m = await prisma.billingMilestone.findUniqueOrThrow({
    where: { id: milestoneId }, select: { offer: { select: { status: true } } }
  });
  if (m.offer && !isOfferEditable(m.offer.status)) throw new OfferLockedError(m.offer.status);
}

const HeaderSchema = z.object({
  title: z.string().min(1),
  mode: z.enum(["PROJECT","CONSULTING"]).default("PROJECT"),
  companyId: z.string().min(1),
  ownerId: z.string().optional().nullable().transform(v => v || null),
  status: z.enum(["DRAFT","SENT","NEGOTIATION","WON","LOST","CANCELLED"]).default("DRAFT"),
  probability: z.coerce.number().int().min(0).max(100).default(50),
  description: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  expectedDecisionAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null)
});

export async function createOfferAction(formData: FormData) {
  const session = await requirePermission("offers.write");
  const data = HeaderSchema.parse(Object.fromEntries(formData));
  const created = await createOffer({ ...data }, session.user.id);
  revalidatePath("/offers");
  redirect(`/offers/${created.id}`);
}

export async function updateOfferHeader(id: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  const before = await prisma.offer.findUniqueOrThrow({ where: { id } });
  if (!isOfferEditable(before.status)) throw new OfferLockedError(before.status);
  const data = HeaderSchema.parse(Object.fromEntries(formData));
  const after = await prisma.offer.update({ where: { id }, data });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Offer", entityId: id, message: "Offre mise à jour", before, after });
  revalidatePath(`/offers/${id}`);
}

export async function deleteOfferAction(id: string) {
  const session = await requirePermission("offers.write");
  const before = await prisma.offer.findUniqueOrThrow({ where: { id } });
  // On autorise la suppression d'un brouillon, mais on refuse la suppression d'une offre WON
  // (et on déconseille pour SENT/NEGOTIATION/LOST/CANCELLED — historique commercial).
  if (before.status === "WON") throw new OfferLockedError(before.status);
  await prisma.offer.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Offer", entityId: id, message: `Offre ${before.reference} supprimée`, before });
  revalidatePath("/offers");
  redirect("/offers");
}

export async function createNewVersionAction(id: string) {
  const session = await requirePermission("offers.write");
  const created = await createNewVersion(session.user.id, id);
  revalidatePath("/offers");
  revalidatePath(`/offers/${id}`);
  redirect(`/offers/${created.id}`);
}

export async function setOfferStatus(id: string, newStatus: OfferStatus) {
  const session = await requirePermission("offers.write");
  await changeOfferStatus({ actorId: session.user.id, offerId: id, newStatus });
  revalidatePath(`/offers/${id}`);
  revalidatePath(`/projects`);
}

export async function duplicateOfferAction(id: string) {
  const session = await requirePermission("offers.write");
  const created = await duplicateOffer(session.user.id, id);
  revalidatePath("/offers");
  redirect(`/offers/${created.id}`);
}

export async function createComplementAction(parentId: string) {
  const session = await requirePermission("offers.write");
  const created = await createComplement(session.user.id, parentId);
  revalidatePath(`/offers/${parentId}`);
  redirect(`/offers/${created.id}`);
}

// ---- LIGNES ---------------------------------------------------

const ServiceLineSchema = z.object({
  description: z.string().min(1),
  profileId: z.string().min(1, "Profil requis"),
  quantity: z.coerce.number().nonnegative(),
  unit: z.enum(["day","hour"]).default("day"),
  unitSellPrice: z.coerce.number().nonnegative(),
  unitCost: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).default(0)
});

const OtherLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().default("unit"),
  unitSellPrice: z.coerce.number().nonnegative(),
  marginPctInput: z.coerce.number().min(0).max(100).default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0)
});

export async function addServiceLine(offerId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertOfferEditable(offerId);
  const data = ServiceLineSchema.parse(Object.fromEntries(formData));
  const last = await prisma.offerLine.findFirst({ where: { offerId }, orderBy: { position: "desc" } });
  const created = await prisma.offerLine.create({ data: { ...data, type: "SERVICE", offerId, position: (last?.position ?? 0) + 1, marginPctInput: null } });
  await recomputeOfferTotals(offerId);
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "OfferLine", entityId: created.id, message: `Ligne service ajoutée`, after: created });
  revalidatePath(`/offers/${offerId}`);
}

export async function addOtherLine(offerId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertOfferEditable(offerId);
  const data = OtherLineSchema.parse(Object.fromEntries(formData));
  const last = await prisma.offerLine.findFirst({ where: { offerId }, orderBy: { position: "desc" } });
  const created = await prisma.offerLine.create({
    data: {
      offerId,
      type: "OTHER",
      profileId: null,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitSellPrice: data.unitSellPrice,
      unitCost: 0, // recalculé via marginPctInput
      discountPct: data.discountPct,
      marginPctInput: data.marginPctInput,
      position: (last?.position ?? 0) + 1
    }
  });
  await recomputeOfferTotals(offerId);
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "OfferLine", entityId: created.id, message: `Ligne diverse ajoutée`, after: created });
  revalidatePath(`/offers/${offerId}`);
}

export async function updateServiceLine(lineId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertLineEditable(lineId);
  const before = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId } });
  const data = ServiceLineSchema.parse(Object.fromEntries(formData));
  const after = await prisma.offerLine.update({ where: { id: lineId }, data: { ...data, type: "SERVICE", marginPctInput: null } });
  await recomputeOfferTotals(after.offerId);
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "OfferLine", entityId: lineId, message: "Ligne service modifiée", before, after });
  revalidatePath(`/offers/${after.offerId}`);
}

export async function updateOtherLine(lineId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertLineEditable(lineId);
  const before = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId } });
  const data = OtherLineSchema.parse(Object.fromEntries(formData));
  const after = await prisma.offerLine.update({
    where: { id: lineId },
    data: { ...data, type: "OTHER", profileId: null, unitCost: 0 }
  });
  await recomputeOfferTotals(after.offerId);
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "OfferLine", entityId: lineId, message: "Ligne diverse modifiée", before, after });
  revalidatePath(`/offers/${after.offerId}`);
}

export async function deleteLine(lineId: string) {
  const session = await requirePermission("offers.write");
  await assertLineEditable(lineId);
  const before = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId } });
  const line = await prisma.offerLine.delete({ where: { id: lineId } });
  await recomputeOfferTotals(line.offerId);
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "OfferLine", entityId: lineId, message: "Ligne supprimée", before });
  revalidatePath(`/offers/${line.offerId}`);
}

// ---- TRANCHES -------------------------------------------------

const MilestoneSchema = z.object({
  label: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  percentage: z.coerce.number().optional().nullable(),
  expectedAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  trigger: z.string().optional().nullable(),
  status: z.enum(["PLANNED","READY","TRANSMITTED","PAID","CANCELLED"]).default("PLANNED")
});

export async function addMilestone(offerId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertOfferEditable(offerId);
  const data = MilestoneSchema.parse(Object.fromEntries(formData));
  // Si pourcentage saisi → recalcule amount depuis total offre
  let amount = data.amount;
  if (data.percentage && data.percentage > 0) {
    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
    amount = Math.round(Number(offer.totalSell) * (Number(data.percentage) / 100) * 100) / 100;
  }
  const created = await prisma.billingMilestone.create({ data: { ...data, amount, offerId } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "BillingMilestone", entityId: created.id, message: `Tranche '${data.label}' ajoutée à l'offre`, after: created });
  revalidatePath(`/offers/${offerId}`);
}

export async function deleteMilestone(milestoneId: string, offerId: string) {
  const session = await requirePermission("offers.write");
  await assertMilestoneEditable(milestoneId);
  const before = await prisma.billingMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
  await prisma.billingMilestone.delete({ where: { id: milestoneId } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "BillingMilestone", entityId: milestoneId, message: `Tranche supprimée`, before });
  revalidatePath(`/offers/${offerId}`);
}

export async function setMilestoneStatus(milestoneId: string, newStatus: BillingMilestoneStatus) {
  const session = await requirePermission("finance.write");
  const m = await prisma.billingMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
  const data: any = { status: newStatus };
  if (newStatus === "TRANSMITTED" && !m.transmittedAt) data.transmittedAt = new Date();
  if (newStatus === "PAID" && !m.paidAt) data.paidAt = new Date();
  const after = await prisma.billingMilestone.update({ where: { id: milestoneId }, data });
  await logActivity({
    actorId: session.user.id, action: "MILESTONE_STATUS_CHANGE", entityType: "BillingMilestone", entityId: milestoneId,
    message: `Tranche '${m.label}' : ${m.status} → ${newStatus}`, before: m, after
  });
  if (m.offerId) revalidatePath(`/offers/${m.offerId}`);
  if (m.projectId) revalidatePath(`/projects/${m.projectId}`);
  revalidatePath("/finance");
}
