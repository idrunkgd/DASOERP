"use server";
/**
 * Server actions pour les sites d'une société (CompanySite).
 * Un site = une usine, un dépôt, un siège, un bureau rattaché à une Company.
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parse(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    name: fd.get("name")?.toString().trim() || "",
    siteType: get("siteType"),
    street: get("street"),
    postalCode: get("postalCode"),
    city: get("city"),
    country: get("country") ?? "Belgique",
    phone: get("phone"),
    email: get("email"),
    establishmentUnit: get("establishmentUnit"),
    verificationStatus: get("verificationStatus"),
    sourceUrl: get("sourceUrl"),
    notes: get("notes"),
    isPrimary: fd.get("isPrimary") === "on"
  };
}

export async function createCompanySite(companyId: string, fd: FormData) {
  const session = await requirePermission("companies.write");
  const data = parse(fd);
  if (!data.name) throw new Error("Le nom du site est obligatoire");

  // Un seul site primary par société — on reset les autres si besoin
  if (data.isPrimary) {
    await (prisma as any).companySite.updateMany({
      where: { companyId }, data: { isPrimary: false }
    });
  }

  const created = await (prisma as any).companySite.create({
    data: { ...data, companyId }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "CompanySite",
    entityId: created.id,
    message: `Site créé : ${data.name}`
  });

  revalidatePath(`/companies/${companyId}`);
  redirect(`/companies/${companyId}`);
}

export async function updateCompanySite(siteId: string, fd: FormData) {
  const session = await requirePermission("companies.write");
  const data = parse(fd);
  if (!data.name) throw new Error("Le nom du site est obligatoire");

  const existing = await (prisma as any).companySite.findUnique({ where: { id: siteId } });
  if (!existing) throw new Error("Site introuvable");

  if (data.isPrimary && !existing.isPrimary) {
    await (prisma as any).companySite.updateMany({
      where: { companyId: existing.companyId }, data: { isPrimary: false }
    });
  }

  await (prisma as any).companySite.update({
    where: { id: siteId }, data
  });

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "CompanySite",
    entityId: siteId,
    message: `Site modifié : ${data.name}`
  });

  revalidatePath(`/companies/${existing.companyId}`);
  redirect(`/companies/${existing.companyId}`);
}

export async function deleteCompanySite(siteId: string) {
  const session = await requirePermission("companies.write");
  const existing = await (prisma as any).companySite.findUnique({ where: { id: siteId } });
  if (!existing) return;
  await (prisma as any).companySite.delete({ where: { id: siteId } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "CompanySite",
    entityId: siteId,
    message: `Site supprimé : ${existing.name}`
  });
  revalidatePath(`/companies/${existing.companyId}`);
  redirect(`/companies/${existing.companyId}`);
}
