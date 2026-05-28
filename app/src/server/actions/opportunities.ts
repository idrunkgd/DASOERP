"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null),
  // Type : CONSULTING (T&M) ou PROJECT (forfait) — uniquement ces deux valeurs
  kind: z.enum(["CONSULTING", "PROJECT"]).default("CONSULTING"),
  // Société OBLIGATOIRE (sélectionnée dans la dropdown — créée au préalable si manquante)
  companyId: z
    .string()
    .min(1, "Sélectionne une société (crée-la d'abord si elle n'existe pas)"),
  // Contact référent OPTIONNEL mais recommandé
  contactId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null),
  ownerId: z.string().optional().nullable().transform((v) => v || null),
  estimatedValue: z.coerce.number().nonnegative().default(0),
  probability: z.coerce.number().min(0).max(100).default(20),
  expectedCloseAt: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v) : null)),
  source: z.string().optional().nullable().transform((v) => v?.trim() || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

const STAGE_DEFAULT_PROBA: Record<string, number> = {
  NEW: 10,
  QUALIFIED: 30,
  PROPOSED: 50,
  NEGOTIATING: 75,
  WON: 100,
  LOST: 0,
  CANCELLED: 0
};

export async function createOpportunity(formData: FormData) {
  const session = await requireSession();
  const data = Schema.parse(Object.fromEntries(formData));
  const created = await prisma.opportunity.create({
    data: {
      title: data.title,
      description: data.description,
      kind: data.kind,
      companyId: data.companyId,
      contactId: data.contactId,
      ownerId: data.ownerId ?? session.user.id,
      estimatedValue: data.estimatedValue,
      probability: data.probability,
      expectedCloseAt: data.expectedCloseAt ?? undefined,
      source: data.source,
      notes: data.notes
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Opportunity",
    entityId: created.id,
    message: `Opportunité « ${data.title} » créée`
  });
  revalidatePath("/test/crm");
  return { id: created.id };
}

export async function updateOpportunity(id: string, formData: FormData) {
  const session = await requireSession();
  const data = Schema.parse(Object.fromEntries(formData));
  const before = await prisma.opportunity.findUnique({ where: { id } });
  if (!before) throw new Error("Opportunité introuvable");
  const updated = await prisma.opportunity.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      kind: data.kind,
      companyId: data.companyId,
      contactId: data.contactId,
      ownerId: data.ownerId,
      estimatedValue: data.estimatedValue,
      probability: data.probability,
      expectedCloseAt: data.expectedCloseAt ?? undefined,
      source: data.source,
      notes: data.notes
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Opportunity",
    entityId: id,
    message: `Opportunité « ${data.title} » mise à jour`,
    before,
    after: updated
  });
  revalidatePath("/test/crm");
}

export async function moveOpportunityStage(
  id: string,
  newStage: "NEW" | "QUALIFIED" | "PROPOSED" | "NEGOTIATING" | "WON" | "LOST" | "CANCELLED",
  lostReason?: string
) {
  const session = await requireSession();
  const before = await prisma.opportunity.findUnique({ where: { id } });
  if (!before) throw new Error("Opportunité introuvable");

  const probability = STAGE_DEFAULT_PROBA[newStage] ?? before.probability;
  const closedAt = newStage === "WON" || newStage === "LOST" ? new Date() : null;

  await prisma.opportunity.update({
    where: { id },
    data: {
      stage: newStage,
      probability,
      closedAt,
      lostReason: newStage === "LOST" ? (lostReason ?? "Non précisé") : null
    }
  });
  await prisma.opportunityActivity.create({
    data: {
      opportunityId: id,
      userId: session.user.id,
      kind: "stage_change",
      subject: `Passage à ${newStage}`,
      body: lostReason ?? null
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "Opportunity",
    entityId: id,
    message: `Stage : ${before.stage} → ${newStage}${lostReason ? ` (${lostReason})` : ""}`
  });
  revalidatePath("/test/crm");
}

export async function deleteOpportunity(id: string) {
  const session = await requireSession();
  if (!["ADMIN", "MANAGER", "COMMERCIAL"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  await prisma.opportunity.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Opportunity",
    entityId: id,
    message: "Opportunité supprimée"
  });
  revalidatePath("/test/crm");
}

/**
 * Déplace n'importe quelle carte du kanban CRM (Opportunity / MissionRequest /
 * Offer / Project) vers un nouveau stage. Chaque entité a son propre enum
 * de statut — on mappe le stage kanban vers le statut natif.
 */
export async function moveCardStage(
  source: "opportunity" | "mission-request" | "offer" | "project",
  id: string,
  newStage: "NEW" | "QUALIFIED" | "PROPOSED" | "NEGOTIATING" | "WON" | "LOST" | "CANCELLED"
) {
  const session = await requireSession();

  if (source === "opportunity") {
    // Utilise la logique existante
    await moveOpportunityStage(id, newStage);
    return;
  }

  if (source === "mission-request") {
    const map: Record<typeof newStage, string> = {
      NEW: "NEW",
      QUALIFIED: "QUALIFYING",
      PROPOSED: "PRESENTING",
      NEGOTIATING: "PRESENTING",
      WON: "CONTRACTED",
      LOST: "LOST",
      CANCELLED: "CANCELLED"
    };
    await prisma.missionRequest.update({
      where: { id },
      data: {
        status: map[newStage] as any,
        closedAt: ["WON", "LOST", "CANCELLED"].includes(newStage) ? new Date() : null
      }
    });
  } else if (source === "offer") {
    const map: Record<typeof newStage, string> = {
      NEW: "DRAFT",
      QUALIFIED: "DRAFT",
      PROPOSED: "SENT",
      NEGOTIATING: "NEGOTIATION",
      WON: "WON",
      LOST: "LOST",
      CANCELLED: "CANCELLED"
    };
    await prisma.offer.update({
      where: { id },
      data: {
        status: map[newStage] as any,
        closedAt: ["WON", "LOST", "CANCELLED"].includes(newStage) ? new Date() : null
      }
    });
  } else if (source === "project") {
    const map: Record<typeof newStage, string> = {
      NEW: "TO_START",
      QUALIFIED: "TO_START",
      PROPOSED: "TO_START",
      NEGOTIATING: "TO_START",
      WON: "ACTIVE",
      LOST: "CANCELLED",
      CANCELLED: "CANCELLED"
    };
    await prisma.project.update({
      where: { id },
      data: { status: map[newStage] as any }
    });
  }

  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: source,
    entityId: id,
    message: `[CRM] ${source} déplacée → ${newStage}`
  });
  revalidatePath("/test/crm");
}

export async function addOpportunityActivity(
  opportunityId: string,
  formData: FormData
) {
  const session = await requireSession();
  const kind = String(formData.get("kind") ?? "note");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!subject.trim()) throw new Error("Sujet requis");
  await prisma.opportunityActivity.create({
    data: {
      opportunityId,
      userId: session.user.id,
      kind,
      subject: subject.trim(),
      body: body.trim() || null
    }
  });
  revalidatePath("/test/crm");
}
