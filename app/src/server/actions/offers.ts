"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeOfferStatus, createOffer, duplicateOffer, recomputeOfferTotals, createComplement, createNewVersion } from "@/server/services/offer-service";
import { computeOfferLineTotals } from "@/lib/calc";
import { isOfferEditable, isOfferFinal, isOfferHeaderEditable, OfferLockedError } from "@/lib/offer-rules";
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
  expectedDecisionAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  vatRate: z.coerce.number().min(0).max(50).default(21)
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
  // Verrou : pas modifiable après WON/LOST/CANCELLED. Les statuts intermédiaires
  // (SENT, NEGOTIATION) gardent le header éditable pour ajuster owner, dates,
  // probabilité, description, etc.
  if (!isOfferHeaderEditable(before.status)) throw new OfferLockedError(before.status);
  const data = HeaderSchema.parse(Object.fromEntries(formData));
  // Sécurité : on refuse les transitions terminales (WON/LOST/CANCELLED) via
  // le header form — elles passent par les boutons dédiés (wizard, etc.).
  if (data.status !== before.status && isOfferFinal(data.status as any)) {
    throw new Error(
      `Pour passer cette offre en ${data.status}, utilisez le bouton dédié (« Marquer gagnée / perdue / annuler ») au lieu du formulaire.`
    );
  }
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

// Modèle de saisie OTHER (matériel/licences/sous-traitance…) :
// - L'utilisateur saisit prix d'achat (`unitCost`) + marge attendue % (`marginPctInput`, défaut 20)
// - On calcule `unitSellPrice = unitCost / (1 - margin/100)` (marge sur prix de vente)
//   ex: cost=100, marge=20% → sell = 100 / 0.8 = 125 €
// - Si la marge = 0 et unitSellPrice fourni → utilisé tel quel (fallback)
const OtherLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().default("unit"),
  unitCost: z.coerce.number().nonnegative().default(0),
  unitSellPrice: z.coerce.number().nonnegative().optional().default(0),
  marginPctInput: z.coerce.number().min(0).max(99.9).default(20),
  discountPct: z.coerce.number().min(0).max(100).default(0)
});

/** Calcule unitSellPrice à partir de unitCost + marginPctInput (marge sur prix de vente). */
function deriveSellPrice(cost: number, marginPct: number, fallback?: number): number {
  if (cost > 0 && marginPct >= 0 && marginPct < 100) {
    return Math.round((cost / (1 - marginPct / 100)) * 100) / 100;
  }
  return fallback ?? 0;
}

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
  const computedSell = deriveSellPrice(data.unitCost, data.marginPctInput, data.unitSellPrice);
  const created = await prisma.offerLine.create({
    data: {
      offerId,
      type: "OTHER",
      profileId: null,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost, // vrai prix d'achat saisi par le user
      unitSellPrice: computedSell, // calculé depuis cost + marge
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
  // Si la ligne est dans une option → recompute option ; sinon → recompute total offer
  if (after.optionId) {
    await recomputeOfferOption(after.optionId);
  } else {
    await recomputeOfferTotals(after.offerId);
  }
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "OfferLine", entityId: lineId, message: "Ligne service modifiée", before, after });
  revalidatePath(`/offers/${after.offerId}`);
}

export async function updateOtherLine(lineId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertLineEditable(lineId);
  const before = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId } });
  const data = OtherLineSchema.parse(Object.fromEntries(formData));
  const computedSell = deriveSellPrice(data.unitCost, data.marginPctInput, data.unitSellPrice);
  const after = await prisma.offerLine.update({
    where: { id: lineId },
    data: {
      type: "OTHER",
      profileId: null,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      unitSellPrice: computedSell,
      discountPct: data.discountPct,
      marginPctInput: data.marginPctInput
    }
  });
  if (after.optionId) {
    await recomputeOfferOption(after.optionId);
  } else {
    await recomputeOfferTotals(after.offerId);
  }
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "OfferLine", entityId: lineId, message: "Ligne diverse modifiée", before, after });
  revalidatePath(`/offers/${after.offerId}`);
}

// ---- OPTIONS ---------------------------------------------------

const OfferOptionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function addOfferOption(offerId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  await assertOfferEditable(offerId);
  const data = OfferOptionSchema.parse(Object.fromEntries(formData));
  const last = await prisma.offerOption.findFirst({
    where: { offerId },
    orderBy: { position: "desc" }
  });
  const created = await prisma.offerOption.create({
    data: {
      offerId,
      name: data.name,
      description: data.description,
      position: (last?.position ?? 0) + 1
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "OfferOption",
    entityId: created.id,
    message: `Option « ${data.name} » créée`
  });
  revalidatePath(`/offers/${offerId}`);
  return { id: created.id };
}

export async function updateOfferOption(optionId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  const before = await prisma.offerOption.findUniqueOrThrow({
    where: { id: optionId },
    include: { offer: { select: { status: true } } }
  });
  if (!isOfferEditable(before.offer.status)) throw new OfferLockedError(before.offer.status);
  const data = OfferOptionSchema.parse(Object.fromEntries(formData));
  await prisma.offerOption.update({
    where: { id: optionId },
    data: { name: data.name, description: data.description }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "OfferOption",
    entityId: optionId,
    message: `Option « ${data.name} » mise à jour`
  });
  revalidatePath(`/offers/${before.offerId}`);
}

export async function deleteOfferOption(optionId: string) {
  const session = await requirePermission("offers.write");
  const before = await prisma.offerOption.findUniqueOrThrow({
    where: { id: optionId },
    include: { offer: { select: { status: true } } }
  });
  if (!isOfferEditable(before.offer.status)) throw new OfferLockedError(before.offer.status);
  await prisma.offerOption.delete({ where: { id: optionId } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "OfferOption",
    entityId: optionId,
    message: `Option « ${before.name} » supprimée`
  });
  revalidatePath(`/offers/${before.offerId}`);
}

/** Ajoute une ligne SERVICE à une option (au lieu du devis principal). */
export async function addOptionServiceLine(optionId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  const option = await prisma.offerOption.findUniqueOrThrow({
    where: { id: optionId },
    include: { offer: { select: { id: true, status: true } } }
  });
  if (!isOfferEditable(option.offer.status)) throw new OfferLockedError(option.offer.status);
  const data = ServiceLineSchema.parse(Object.fromEntries(formData));
  const last = await prisma.offerLine.findFirst({
    where: { optionId },
    orderBy: { position: "desc" }
  });
  const created = await prisma.offerLine.create({
    data: {
      ...data,
      type: "SERVICE",
      offerId: option.offer.id,
      optionId,
      position: (last?.position ?? 0) + 1,
      marginPctInput: null
    }
  });
  await recomputeOfferOption(optionId);
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "OfferLine",
    entityId: created.id,
    message: `Ligne service ajoutée à l'option « ${option.name} »`
  });
  revalidatePath(`/offers/${option.offer.id}`);
}

/** Ajoute une ligne OTHER (matériel) à une option. */
export async function addOptionOtherLine(optionId: string, formData: FormData) {
  const session = await requirePermission("offers.write");
  const option = await prisma.offerOption.findUniqueOrThrow({
    where: { id: optionId },
    include: { offer: { select: { id: true, status: true } } }
  });
  if (!isOfferEditable(option.offer.status)) throw new OfferLockedError(option.offer.status);
  const data = OtherLineSchema.parse(Object.fromEntries(formData));
  const last = await prisma.offerLine.findFirst({
    where: { optionId },
    orderBy: { position: "desc" }
  });
  const computedSell = deriveSellPrice(data.unitCost, data.marginPctInput, data.unitSellPrice);
  const created = await prisma.offerLine.create({
    data: {
      offerId: option.offer.id,
      optionId,
      type: "OTHER",
      profileId: null,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      unitSellPrice: computedSell,
      discountPct: data.discountPct,
      marginPctInput: data.marginPctInput,
      position: (last?.position ?? 0) + 1
    }
  });
  await recomputeOfferOption(optionId);
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "OfferLine",
    entityId: created.id,
    message: `Ligne matériel ajoutée à l'option « ${option.name} »`
  });
  revalidatePath(`/offers/${option.offer.id}`);
}

/**
 * Recalcule les totaux d'une option : pour CHAQUE ligne, on recalcule
 * totalSell/totalCost depuis ses inputs (qty × prix etc.), on persiste,
 * puis on somme.
 *
 * IMPORTANT : les lignes viennent d'être créées avec totalSell=0 (default
 * Prisma) — il faut donc impérativement les recalculer ici, sinon le total
 * de l'option reste à 0 €.
 */
async function recomputeOfferOption(optionId: string) {
  const lines = await prisma.offerLine.findMany({ where: { optionId } });
  let totalSell = 0;
  let totalCost = 0;
  for (const l of lines) {
    const t = computeOfferLineTotals({
      quantity: l.quantity.toString(),
      unitSellPrice: l.unitSellPrice.toString(),
      unitCost: l.unitCost.toString(),
      discountPct: l.discountPct.toString(),
      marginPctInput:
        l.marginPctInput != null ? l.marginPctInput.toString() : null
    });
    await prisma.offerLine.update({
      where: { id: l.id },
      data: {
        totalSell: t.totalSell,
        totalCost: t.totalCost,
        marginAmount: t.marginAmount,
        marginPct: t.marginPct
      }
    });
    totalSell += t.totalSell;
    totalCost += t.totalCost;
  }
  await prisma.offerOption.update({
    where: { id: optionId },
    data: { totalSell, totalCost }
  });
}

export async function deleteLine(lineId: string) {
  const session = await requirePermission("offers.write");
  await assertLineEditable(lineId);
  const before = await prisma.offerLine.findUniqueOrThrow({ where: { id: lineId } });
  const line = await prisma.offerLine.delete({ where: { id: lineId } });
  if (line.optionId) {
    await recomputeOfferOption(line.optionId);
  } else {
    await recomputeOfferTotals(line.offerId);
  }
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
