"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const Schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).transform(v => v || null),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  notes: z.string().optional().nullable(),
  tags: z.string().optional().transform(v => v ? v.split(",").map(t => t.trim()).filter(Boolean) : []),
  companyId: z.string().optional().nullable().transform(v => v || null)
});

export async function createContact(formData: FormData) {
  const session = await requirePermission("contacts.write");
  const data = Schema.parse(Object.fromEntries(formData));
  const c = await prisma.contact.create({ data: { ...data, ownerId: session.user.id } });
  // Si le contact est créé avec une société : on initialise aussi le lien
  // ContactCompany (marqué principal) pour rester cohérent avec la relation N:N.
  if (data.companyId) {
    await prisma.contactCompany.create({
      data: {
        contactId: c.id, companyId: data.companyId,
        jobTitle: data.jobTitle ?? null, isPrimary: true
      }
    });
  }
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Contact", entityId: c.id, message: `Contact ${c.firstName} ${c.lastName} créé` });
  revalidatePath("/contacts");
  redirect(`/contacts/${c.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const session = await requirePermission("contacts.write");
  const before = await prisma.contact.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.contact.update({ where: { id }, data });
    // Sync du lien principal ContactCompany avec le nouveau companyId :
    //  - si companyId change (ou passe à non-null), on démote les autres
    //    principaux et on marque celui-ci principal (upsert).
    //  - si companyId passe à NULL, on démote tous les principaux (les
    //    liens secondaires restent inchangés).
    if (before.companyId !== data.companyId) {
      await tx.contactCompany.updateMany({
        where: { contactId: id, isPrimary: true },
        data: { isPrimary: false }
      });
      if (data.companyId) {
        await tx.contactCompany.upsert({
          where: { contactId_companyId: { contactId: id, companyId: data.companyId } },
          create: {
            contactId: id, companyId: data.companyId,
            jobTitle: data.jobTitle ?? null, isPrimary: true
          },
          update: { isPrimary: true }
        });
      }
    }
    return updated;
  });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "Contact", entityId: id, message: `Contact mis à jour`, before, after });
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
}

export async function deleteContact(id: string) {
  const session = await requirePermission("contacts.write");
  const before = await prisma.contact.findUniqueOrThrow({ where: { id } });
  await prisma.contact.delete({ where: { id } });
  await logActivity({ actorId: session.user.id, action: "DELETE", entityType: "Contact", entityId: id, message: "Contact supprimé", before });
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function addInteraction(contactId: string, formData: FormData) {
  const session = await requirePermission("contacts.write");
  const kind = String(formData.get("kind") || "note");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!subject) return;
  await prisma.contactInteraction.create({
    data: { contactId, userId: session.user.id, kind, subject, body }
  });
  revalidatePath(`/contacts/${contactId}`);
}

/**
 * Crée une tâche "à faire" liée à un contact — utilisé par le bouton
 * téléphone dans la liste contacts. Apparaît ensuite dans /commercial
 * (Activité commerciale) avec un badge todo + case à cocher.
 */
export async function createContactTodo(contactId: string, formData: FormData) {
  const session = await requirePermission("contacts.write");
  const assigneeId = String(formData.get("assigneeId") || "").trim() || null;
  const dueAtStr = String(formData.get("dueAt") || "").trim();
  const subject = String(formData.get("subject") || "").trim() || "À rappeler";
  const body = String(formData.get("body") || "").trim() || null;
  const dueAt = dueAtStr ? new Date(dueAtStr) : null;

  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: { firstName: true, lastName: true }
  });
  // Défaut de subject : "Rappeler {prenom nom}" si l'utilisateur n'en a pas mis
  const finalSubject = subject === "À rappeler"
    ? `Rappeler ${contact.firstName} ${contact.lastName}`
    : subject;

  const created = await prisma.contactInteraction.create({
    data: {
      contactId,
      userId: session.user.id, // créateur
      assigneeId: assigneeId ?? session.user.id, // par défaut, s'assigner à soi
      kind: "todo",
      subject: finalSubject,
      body,
      dueAt,
      // occurredAt = maintenant (date de création de la tâche) — la timeline
      // reste ordonnée par occurredAt. dueAt sert à la logique de rappel.
    }
  });
  revalidatePath("/contacts");
  revalidatePath("/commercial");
  revalidatePath(`/contacts/${contactId}`);
  return { ok: true, id: created.id };
}

/**
 * Crée une tâche générique (non liée à un contact) — ex : "commander
 * cartes de visite", "renouveler licence Notion". Apparaît dans la
 * timeline /commercial (Activité) au même titre que les tâches contact.
 */
export async function createStandaloneTask(formData: FormData) {
  const session = await requirePermission("contacts.write");
  const assigneeId = String(formData.get("assigneeId") || "").trim() || null;
  const dueAtStr = String(formData.get("dueAt") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!subject) throw new Error("Un titre est requis.");
  const dueAt = dueAtStr ? new Date(dueAtStr) : null;

  const created = await prisma.contactInteraction.create({
    data: {
      contactId: null, // tâche standalone
      userId: session.user.id,
      assigneeId: assigneeId ?? session.user.id,
      kind: "todo",
      subject,
      body,
      dueAt
    }
  });
  revalidatePath("/commercial");
  return { ok: true, id: created.id };
}

/**
 * Bascule le statut complété d'une tâche. Idempotent.
 */
export async function toggleContactTodoDone(id: string, done: boolean) {
  const session = await requirePermission("contacts.write");
  const updated = await prisma.contactInteraction.update({
    where: { id },
    data: { completedAt: done ? new Date() : null }
  });
  revalidatePath("/commercial");
  if (updated.contactId) revalidatePath(`/contacts/${updated.contactId}`);
  return { ok: true };
}

/**
 * Supprime une tâche/interaction. Utilisé pour retirer une tâche
 * annulée ou créée par erreur.
 */
export async function deleteContactInteraction(id: string) {
  await requirePermission("contacts.write");
  const before = await prisma.contactInteraction.findUniqueOrThrow({
    where: { id },
    select: { contactId: true }
  });
  await prisma.contactInteraction.delete({ where: { id } });
  revalidatePath("/commercial");
  if (before.contactId) revalidatePath(`/contacts/${before.contactId}`);
  return { ok: true };
}
