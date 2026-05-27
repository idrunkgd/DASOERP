import { prisma } from "@/lib/db";
import { aggregateOfferTotals, computeOfferLineTotals } from "@/lib/calc";
import { logActivity } from "@/lib/audit";
import { nextOfferReference, nextProjectReference, nextComplementReference } from "@/lib/references";
import { canCreateNewVersion, OfferLockedError } from "@/lib/offer-rules";
import type { OfferStatus, Prisma } from "@prisma/client";

/** Recalcule lignes (cache) + totaux offre. À appeler après toute mutation lignes.
 *
 * Effet bonus : si l'offre a des tranches (BillingMilestone) avec un `percentage`
 * enregistré, on resync leur `amount` sur la base du nouveau totalSell.
 * On ne touche PAS les tranches sans % (montant fixe saisi à la main) ni celles
 * déjà TRANSMITTED/PAID (= déjà facturé, on ne change pas l'historique).
 */
export async function recomputeOfferTotals(offerId: string) {
  const lines = await prisma.offerLine.findMany({ where: { offerId } });
  // recalcule ligne par ligne + persist
  for (const l of lines) {
    const t = computeOfferLineTotals({
      quantity: l.quantity.toString(),
      unitSellPrice: l.unitSellPrice.toString(),
      unitCost: l.unitCost.toString(),
      discountPct: l.discountPct.toString()
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
  }
  const fresh = await prisma.offerLine.findMany({ where: { offerId } });
  const tot = aggregateOfferTotals(fresh.map(l => ({
    totalSell: Number(l.totalSell),
    totalCost: Number(l.totalCost),
    marginAmount: Number(l.marginAmount),
    marginPct: Number(l.marginPct)
  })));
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      totalSell: tot.totalSell,
      totalCost: tot.totalCost,
      marginAmount: tot.marginAmount,
      marginPct: tot.marginPct
    }
  });

  // Re-sync des tranches avec un % stocké
  const milestones = await prisma.billingMilestone.findMany({
    where: {
      offerId,
      percentage: { not: null },
      status: { in: ["PLANNED", "READY"] } // pas TRANSMITTED/PAID
    }
  });
  for (const m of milestones) {
    const pct = Number(m.percentage ?? 0);
    if (pct <= 0) continue;
    const newAmount = Math.round((tot.totalSell * pct) / 100 * 100) / 100;
    if (Number(m.amount) === newAmount) continue;
    await prisma.billingMilestone.update({
      where: { id: m.id },
      data: { amount: newAmount }
    });
  }

  return tot;
}

/**
 * Change le statut d'une offre. Si WON: crée projet + copie lignes + tranches.
 */
export async function changeOfferStatus(opts: {
  actorId: string;
  offerId: string;
  newStatus: OfferStatus;
}) {
  const { offerId, newStatus, actorId } = opts;

  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: { lines: true, milestones: true, project: true, contacts: true, parentOffer: { include: { project: true } } }
    });
    if (offer.status === newStatus) return offer;

    const previous = offer.status;
    await tx.offer.update({
      where: { id: offerId },
      data: {
        status: newStatus,
        closedAt: ["WON", "LOST", "CANCELLED"].includes(newStatus) ? new Date() : offer.closedAt
      }
    });

    await logActivity({
      actorId, action: "STATUS_CHANGE", entityType: "Offer", entityId: offerId,
      message: `Statut offre ${offer.reference} : ${previous} → ${newStatus}`
    });

    if (newStatus === "WON") {
      // CAS 1 : c'est un complément ET le parent a un projet → on étend ce projet
      if (offer.parentOfferId && offer.parentOffer?.project && !offer.project) {
        const parentProject = offer.parentOffer.project;
        // Rattache les tranches du complément au projet existant
        await tx.billingMilestone.updateMany({
          where: { offerId: offer.id },
          data: { projectId: parentProject.id, offerId: null }
        });
        // Augmente les budgets du projet
        await tx.project.update({
          where: { id: parentProject.id },
          data: {
            budgetSell:      { increment: offer.totalSell },
            budgetCost:      { increment: offer.totalCost },
            marginEstimated: { increment: offer.marginAmount }
          }
        });
        // Lien vers le projet (1-1) : on garde le projet sur l'offre racine, mais on consigne le rattachement
        await logActivity({
          actorId, action: "OFFER_WON", entityType: "Offer", entityId: offerId,
          message: `Complément ${offer.reference} gagné — fusionné dans projet ${parentProject.reference}`
        });
      }
      // CAS 2 : offre racine OU complément sans projet parent → création projet dédié
      else if (!offer.project) {
        const reference = await nextProjectReference();
        const project = await tx.project.create({
          data: {
            reference,
            name: offer.title,
            mode: offer.mode,
            status: "TO_START",
            companyId: offer.companyId,
            offerId: offer.id,
            managerId: offer.ownerId,
            budgetSell: offer.totalSell,
            budgetCost: offer.totalCost,
            marginEstimated: offer.marginAmount,
            contacts: { create: offer.contacts.map((c) => ({ contactId: c.contactId })) }
          }
        });
        for (const m of offer.milestones) {
          await tx.billingMilestone.update({ where: { id: m.id }, data: { projectId: project.id } });
        }
        await logActivity({
          actorId, action: "OFFER_WON", entityType: "Offer", entityId: offerId,
          message: `Offre ${offer.reference} gagnée — projet ${reference} créé`
        });
        await logActivity({
          actorId, action: "PROJECT_CREATED_FROM_OFFER", entityType: "Project", entityId: project.id,
          message: `Projet ${reference} créé automatiquement depuis offre ${offer.reference}`
        });
      }
    } else if (newStatus === "LOST") {
      await logActivity({ actorId, action: "OFFER_LOST", entityType: "Offer", entityId: offerId, message: `Offre ${offer.reference} perdue` });
    }

    return tx.offer.findUniqueOrThrow({ where: { id: offerId }, include: { project: true } });
  });
}

/**
 * Crée une nouvelle version d'une offre déjà envoyée.
 * - L'offre originale reste consultable mais figée (le supersededById pointe ici)
 * - La nouvelle version est en DRAFT, V+1, avec toutes les lignes/tranches/contacts clonés
 * - Référence : <ref originale>-V<N>
 */
export async function createNewVersion(actorId: string, sourceOfferId: string) {
  const src = await prisma.offer.findUniqueOrThrow({
    where: { id: sourceOfferId },
    include: { lines: true, milestones: true, contacts: true, nextVersion: true }
  });
  if (!canCreateNewVersion(src.status)) throw new OfferLockedError(src.status);
  if (src.nextVersion) throw new Error(`Une version V${src.version + 1} existe déjà : ${src.nextVersion.reference}`);

  // Référence : on remplace la dernière partie -V<N> ou on l'ajoute
  const baseRef = src.reference.replace(/-V\d+$/, "");
  const newVersion = src.version + 1;
  const newRef = `${baseRef}-V${newVersion}`;

  return prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        reference: newRef,
        title: src.title,
        mode: src.mode,
        status: "DRAFT",
        probability: src.probability,
        description: src.description,
        comments: src.comments,
        companyId: src.companyId,
        ownerId: actorId,
        version: newVersion,
        previousVersionId: src.id,
        // Pas de duplication des liens parent/mission ; on conserve les clones de structure
        lines: { create: src.lines.map(l => ({
          position: l.position,
          description: l.description,
          type: l.type,
          profileId: l.profileId,
          marginPctInput: l.marginPctInput,
          quantity: l.quantity,
          unit: l.unit,
          unitSellPrice: l.unitSellPrice,
          unitCost: l.unitCost,
          discountPct: l.discountPct
        }))},
        milestones: { create: src.milestones.map(m => ({
          label: m.label,
          percentage: m.percentage,
          amount: m.amount,
          expectedAt: m.expectedAt,
          trigger: m.trigger,
          status: "PLANNED"
        }))},
        contacts: { create: src.contacts.map(c => ({ contactId: c.contactId })) }
      }
    });
    await logActivity({
      actorId, action: "CREATE", entityType: "Offer", entityId: created.id,
      message: `Nouvelle version ${newRef} créée à partir de ${src.reference}`
    });
    return created;
  }).then(async (created) => {
    // Recalcule à l'extérieur de la transaction (évite les contentions)
    await recomputeOfferTotals(created.id);
    return created;
  });
}

/**
 * Crée un complément à partir d'une offre parente.
 * - Reprend client, contacts, owner, mode
 * - Référence -CN auto
 * - Statut DRAFT, sans lignes ni tranches (à saisir)
 */
export async function createComplement(actorId: string, parentOfferId: string, title?: string) {
  const parent = await prisma.offer.findUniqueOrThrow({
    where: { id: parentOfferId }, include: { contacts: true }
  });
  if (parent.parentOfferId) throw new Error("Impossible : on ne crée pas de complément sur un complément. Créez-le sur l'offre racine.");
  const reference = await nextComplementReference(parentOfferId);
  const created = await prisma.offer.create({
    data: {
      reference,
      title: title ?? `${parent.title} — Complément ${reference.split("-C")[1]}`,
      mode: parent.mode,
      status: "DRAFT",
      probability: parent.probability,
      companyId: parent.companyId,
      ownerId: actorId,
      parentOfferId: parent.id,
      contacts: { create: parent.contacts.map(c => ({ contactId: c.contactId })) }
    }
  });
  await logActivity({
    actorId, action: "CREATE", entityType: "Offer", entityId: created.id,
    message: `Complément ${reference} créé sur offre parente ${parent.reference}`
  });
  return created;
}

/**
 * Duplique une offre (lignes + tranches incluses) en statut DRAFT.
 */
export async function duplicateOffer(actorId: string, offerId: string) {
  const src = await prisma.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { lines: true, milestones: true, contacts: true }
  });
  const reference = await nextOfferReference();
  const created = await prisma.offer.create({
    data: {
      reference,
      title: src.title + " (copie)",
      status: "DRAFT",
      probability: src.probability,
      description: src.description,
      comments: src.comments,
      companyId: src.companyId,
      ownerId: actorId,
      lines: {
        create: src.lines.map(l => ({
          position: l.position,
          description: l.description,
          type: l.type,
          quantity: l.quantity,
          unit: l.unit,
          unitSellPrice: l.unitSellPrice,
          unitCost: l.unitCost,
          discountPct: l.discountPct
        }))
      },
      milestones: {
        create: src.milestones.map(m => ({
          label: m.label,
          percentage: m.percentage,
          amount: m.amount,
          expectedAt: m.expectedAt,
          trigger: m.trigger,
          status: "PLANNED"
        }))
      },
      contacts: {
        create: src.contacts.map(c => ({ contactId: c.contactId }))
      }
    }
  });
  await recomputeOfferTotals(created.id);
  await logActivity({
    actorId, action: "CREATE", entityType: "Offer", entityId: created.id,
    message: `Offre ${reference} créée par duplication de ${src.reference}`
  });
  return created;
}

export async function createOffer(data: Prisma.OfferUncheckedCreateInput, actorId: string) {
  const reference = data.reference ?? await nextOfferReference();
  const created = await prisma.offer.create({
    data: { ...data, reference, ownerId: data.ownerId ?? actorId }
  });
  await logActivity({
    actorId, action: "CREATE", entityType: "Offer", entityId: created.id,
    message: `Offre ${reference} créée`
  });
  return created;
}
