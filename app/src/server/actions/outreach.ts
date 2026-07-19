"use server";
/**
 * Server actions du module Prospection (chasseuse de têtes).
 *
 * Une OutreachInteraction représente UN message envoyé (ou reçu) à une
 * personne : soit un candidat existant, soit un contact d'entreprise
 * existant, soit un profil "freeform" (LinkedIn URL, nom seul...).
 *
 * Le champ nextActionAt permet de planifier une relance : la sourceuse
 * verra sa liste du jour dans un widget dédié.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const CreateSchema = z.object({
  direction: z.enum(["OUTBOUND", "INBOUND"]).default("OUTBOUND"),
  channel: z.enum(["LINKEDIN", "EMAIL", "PHONE", "MEETING", "OTHER"]),
  purpose: z.enum(["SOURCE_CANDIDATE", "SELL_TO_CLIENT", "OTHER"]),

  // Cible polymorphe (XOR appliqué côté server)
  candidateId: z.string().optional().nullable().transform((v) => v || null),
  contactId:   z.string().optional().nullable().transform((v) => v || null),
  freeformName:        z.string().optional().nullable().transform((v) => v?.trim() || null),
  freeformCompany:     z.string().optional().nullable().transform((v) => v?.trim() || null),
  freeformJobTitle:    z.string().optional().nullable().transform((v) => v?.trim() || null),
  freeformLinkedinUrl: z.string().optional().nullable().transform((v) => v?.trim() || null),
  freeformEmail:       z.string().optional().nullable().transform((v) => v?.trim() || null),

  templateId: z.string().optional().nullable().transform((v) => v || null),
  subject:    z.string().optional().nullable().transform((v) => v?.trim() || null),
  body:       z.string().optional().nullable().transform((v) => v?.trim() || null),

  status: z.enum(["SENT", "READ", "REPLIED_POSITIVE", "REPLIED_NEGATIVE", "NO_RESPONSE", "BOUNCED"]).default("SENT"),

  // Prochaine action : yyyy-mm-dd + note
  nextActionAt:   z.string().optional().nullable().transform((v) => v || null),
  nextActionNote: z.string().optional().nullable().transform((v) => v?.trim() || null),

  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

/**
 * Crée une interaction. La sourceuse (session.user) est owner par défaut.
 * Applique l'invariant "un seul target" : candidat OU contact OU freeform.
 */
export async function createOutreach(formData: FormData) {
  const session = await requirePermission("consulting.write");
  const data = CreateSchema.parse(Object.fromEntries(formData));

  const targets = [data.candidateId, data.contactId, data.freeformName].filter(Boolean).length;
  if (targets === 0) throw new Error("Choisis un candidat, un contact, ou renseigne un nom en libre.");
  if (targets > 1) throw new Error("Une seule cible à la fois (candidat, contact, ou libre).");

  const created = await prisma.outreachInteraction.create({
    data: {
      ownerId: session.user.id,
      direction: data.direction,
      channel: data.channel,
      purpose: data.purpose,
      candidateId: data.candidateId,
      contactId: data.contactId,
      freeformName: data.freeformName,
      freeformCompany: data.freeformCompany,
      freeformJobTitle: data.freeformJobTitle,
      freeformLinkedinUrl: data.freeformLinkedinUrl,
      freeformEmail: data.freeformEmail,
      templateId: data.templateId,
      subject: data.subject,
      body: data.body,
      status: data.status,
      nextActionAt: data.nextActionAt ? new Date(data.nextActionAt) : null,
      nextActionNote: data.nextActionNote,
      notes: data.notes
    }
  });
  revalidatePath("/prospection");
  return { ok: true, id: created.id };
}

export async function setOutreachStatus(
  id: string,
  status: "SENT" | "READ" | "REPLIED_POSITIVE" | "REPLIED_NEGATIVE" | "NO_RESPONSE" | "BOUNCED",
  responseNote?: string
) {
  await requirePermission("consulting.write");
  await prisma.outreachInteraction.update({
    where: { id },
    data: {
      status,
      respondedAt: status.startsWith("REPLIED") ? new Date() : undefined,
      responseNote: responseNote ?? undefined
    }
  });
  revalidatePath("/prospection");
  return { ok: true };
}

export async function updateNextAction(id: string, nextActionAt: string | null, note?: string | null) {
  await requirePermission("consulting.write");
  await prisma.outreachInteraction.update({
    where: { id },
    data: {
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
      nextActionNote: note ?? null,
      // Si on remet une action à faire, on décoche done
      nextActionDone: nextActionAt ? false : true
    }
  });
  revalidatePath("/prospection");
  return { ok: true };
}

export async function markNextActionDone(id: string) {
  await requirePermission("consulting.write");
  await prisma.outreachInteraction.update({
    where: { id }, data: { nextActionDone: true }
  });
  revalidatePath("/prospection");
  return { ok: true };
}

export async function deleteOutreach(id: string) {
  await requirePermission("consulting.write");
  await prisma.outreachInteraction.delete({ where: { id } });
  revalidatePath("/prospection");
  return { ok: true };
}
