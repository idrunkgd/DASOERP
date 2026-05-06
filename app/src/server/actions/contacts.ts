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
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "Contact", entityId: c.id, message: `Contact ${c.firstName} ${c.lastName} créé` });
  revalidatePath("/contacts");
  redirect(`/contacts/${c.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const session = await requirePermission("contacts.write");
  const before = await prisma.contact.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const after = await prisma.contact.update({ where: { id }, data });
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
