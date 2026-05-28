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
 *
 * Renvoie { ok, before, after } pour debug. Le caller front log l'erreur si !ok.
 */
export async function moveCardStage(
  source: "opportunity" | "mission-request" | "offer" | "project",
  id: string,
  newStage: "NEW" | "QUALIFIED" | "PROPOSED" | "NEGOTIATING" | "WON" | "LOST" | "CANCELLED"
): Promise<{ ok: true; before: string; after: string } | { ok: false; error: string }> {
  const session = await requireSession();

  try {
    if (source === "opportunity") {
      const before = await prisma.opportunity.findUnique({
        where: { id },
        select: { stage: true }
      });
      await moveOpportunityStage(id, newStage);
      revalidatePath("/test/crm");
      return { ok: true, before: before?.stage ?? "?", after: newStage };
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
      const before = await prisma.missionRequest.findUnique({
        where: { id },
        select: { status: true, crmStage: true }
      });
      await prisma.missionRequest.update({
        where: { id },
        data: {
          // crmStage est la source de vérité pour le kanban (granularité 7 stages).
          // status reste à jour pour la logique métier (notif, dashboard, etc.).
          crmStage: newStage,
          status: map[newStage] as any,
          closedAt: ["WON", "LOST", "CANCELLED"].includes(newStage) ? new Date() : null
        }
      });
      await logActivity({
        actorId: session.user.id,
        action: "STATUS_CHANGE",
        entityType: "MissionRequest",
        entityId: id,
        message: `[CRM] ${before?.crmStage ?? before?.status} → ${newStage} (status: ${map[newStage]})`
      });
      revalidatePath("/test/crm");
      revalidatePath(`/mission-requests/${id}`);
      return { ok: true, before: before?.crmStage ?? before?.status ?? "?", after: newStage };
    }

    if (source === "offer") {
      const map: Record<typeof newStage, string> = {
        NEW: "DRAFT",
        QUALIFIED: "DRAFT",
        PROPOSED: "SENT",
        NEGOTIATING: "NEGOTIATION",
        WON: "WON",
        LOST: "LOST",
        CANCELLED: "CANCELLED"
      };
      const before = await prisma.offer.findUnique({
        where: { id },
        select: { status: true, crmStage: true }
      });
      const targetStatus = map[newStage];
      // Update direct sans cascade — moveCardStage ne crée pas de Project automatiquement.
      // Pour transformer un devis en projet, passer par /offers/[id] "Marquer gagnée".
      await prisma.offer.update({
        where: { id },
        data: {
          // crmStage est la source de vérité pour le kanban.
          // status reste cohérent pour les flows métier (envoi, signature, etc.).
          crmStage: newStage,
          status: targetStatus as any,
          closedAt: ["WON", "LOST", "CANCELLED"].includes(newStage) ? new Date() : null
        }
      });
      await logActivity({
        actorId: session.user.id,
        action: "STATUS_CHANGE",
        entityType: "Offer",
        entityId: id,
        message: `[CRM] ${before?.crmStage ?? before?.status} → ${newStage} (status: ${targetStatus})`
      });
      revalidatePath("/test/crm");
      revalidatePath(`/offers/${id}`);
      revalidatePath("/offers");
      return { ok: true, before: before?.crmStage ?? before?.status ?? "?", after: newStage };
    }

    if (source === "project") {
      const map: Record<typeof newStage, string> = {
        NEW: "TO_START",
        QUALIFIED: "TO_START",
        PROPOSED: "TO_START",
        NEGOTIATING: "TO_START",
        WON: "ACTIVE",
        LOST: "CANCELLED",
        CANCELLED: "CANCELLED"
      };
      const before = await prisma.project.findUnique({
        where: { id },
        select: { status: true, crmStage: true }
      });
      await prisma.project.update({
        where: { id },
        data: {
          // crmStage gouverne la position kanban (granularité 7 stages).
          // status garde la sémantique projet (TO_START → ACTIVE → COMPLETED).
          crmStage: newStage,
          status: map[newStage] as any
        }
      });
      await logActivity({
        actorId: session.user.id,
        action: "STATUS_CHANGE",
        entityType: "Project",
        entityId: id,
        message: `[CRM] ${before?.crmStage ?? before?.status} → ${newStage} (status: ${map[newStage]})`
      });
      revalidatePath("/test/crm");
      revalidatePath(`/projects/${id}`);
      revalidatePath("/projects");
      return { ok: true, before: before?.crmStage ?? before?.status ?? "?", after: newStage };
    }

    return { ok: false, error: `Source inconnue : ${source}` };
  } catch (e: any) {
    console.error("[moveCardStage] erreur", { source, id, newStage, error: e?.message });
    return { ok: false, error: e?.message ?? "Erreur DB" };
  }
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
