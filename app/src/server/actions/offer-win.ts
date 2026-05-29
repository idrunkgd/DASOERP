"use server";
// Server actions liées au passage en gagné d'une offre, via le wizard de
// création de projet. Sépare la création atomique projet + milestones + WON
// du flow auto-magique de changeOfferStatus.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextProjectReference } from "@/lib/references";

// Format milestone : id + nouvelle date d'émission de facture (ISO YYYY-MM-DD)
const MilestoneUpdateSchema = z.object({
  id: z.string(),
  expectedAt: z.string().min(1)
});

const ProjectSchema = z.object({
  name: z.string().min(1).max(200),
  managerId: z.string().optional().nullable(),
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Passe l'offre en WON :
 *  - Met à jour expectedAt sur chaque milestone fourni
 *  - Crée le projet avec les options de configuration fournies
 *  - Rattache les milestones au projet
 *  - Marque l'offre WON
 * Tout en transaction pour rester atomique.
 */
export async function winOfferAndCreateProject(
  offerId: string,
  projectConfig: unknown,
  milestoneUpdates: unknown
) {
  const session = await requirePermission("offers.write");

  const project = ProjectSchema.parse(projectConfig);
  const updates = z.array(MilestoneUpdateSchema).parse(milestoneUpdates);

  const offer = await prisma.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: {
      contacts: true,
      milestones: { orderBy: { createdAt: "asc" } },
      project: true,
      parentOffer: { include: { project: true } }
    }
  });

  if (offer.status === "WON") {
    throw new Error("Cette offre est déjà gagnée.");
  }
  if (offer.project) {
    throw new Error("Un projet est déjà rattaché à cette offre.");
  }

  // Si c'est un complément avec un parent qui a déjà un projet, on étend
  // le projet existant (pas de wizard nécessaire). On laisse cette branche
  // au flow auto (changeOfferStatus) — ici on ne traite que la création
  // d'un nouveau projet.
  if (offer.parentOfferId && offer.parentOffer?.project) {
    throw new Error(
      "C'est un complément d'une offre ayant déjà un projet : utilisez le bouton 'Marquer gagnée' standard pour fusionner."
    );
  }

  const createdProject = await prisma.$transaction(async (tx) => {
    // 1) Mise à jour des expectedAt des milestones
    for (const u of updates) {
      const target = offer.milestones.find((m) => m.id === u.id);
      if (!target) continue;
      await tx.billingMilestone.update({
        where: { id: u.id },
        data: { expectedAt: new Date(u.expectedAt) }
      });
    }

    // 2) Création du projet
    const reference = await nextProjectReference();
    const proj = await tx.project.create({
      data: {
        reference,
        name: project.name,
        mode: offer.mode,
        status: "TO_START",
        companyId: offer.companyId,
        offerId: offer.id,
        managerId: project.managerId || offer.ownerId,
        budgetSell: offer.totalSell,
        budgetCost: offer.totalCost,
        marginEstimated: offer.marginAmount,
        plannedStart: project.plannedStart ? new Date(project.plannedStart) : undefined,
        plannedEnd: project.plannedEnd ? new Date(project.plannedEnd) : undefined,
        notes: project.notes || undefined,
        contacts: { create: offer.contacts.map((c) => ({ contactId: c.contactId })) }
      }
    });

    // 3) Rattachement des milestones au projet
    for (const m of offer.milestones) {
      await tx.billingMilestone.update({
        where: { id: m.id },
        data: { projectId: proj.id }
      });
    }

    // 4) Statut WON sur l'offre + closedAt
    await tx.offer.update({
      where: { id: offerId },
      data: { status: "WON", closedAt: new Date() }
    });

    return proj;
  });

  await logActivity({
    actorId: session.user.id,
    action: "OFFER_WON",
    entityType: "Offer",
    entityId: offerId,
    message: `Offre ${offer.reference} gagnée — projet ${createdProject.reference} créé via wizard`
  });
  await logActivity({
    actorId: session.user.id,
    action: "PROJECT_CREATED_FROM_OFFER",
    entityType: "Project",
    entityId: createdProject.id,
    message: `Projet ${createdProject.reference} créé depuis offre ${offer.reference}`
  });

  revalidatePath(`/offers/${offerId}`);
  revalidatePath(`/projects/${createdProject.id}`);
  revalidatePath("/projects");
  revalidatePath("/offers");
  revalidatePath("/cashflow");

  redirect(`/projects/${createdProject.id}`);
}
