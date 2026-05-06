"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const CompanySchema = z.object({
  name: z.string().min(1, "Nom requis"),
  vatNumber: z.string().optional().nullable().transform(v => v?.trim() || null),
  website: z.string().optional().nullable().transform(v => v?.trim() || null),
  sector: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  status: z.enum(["PROSPECT", "CLIENT", "PARTNER", "SUPPLIER"]),
  source: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function createCompany(formData: FormData) {
  const session = await requirePermission("companies.write");
  const data = CompanySchema.parse(Object.fromEntries(formData));
  const c = await prisma.company.create({ data: { ...data, ownerId: session.user.id } });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "Company", entityId: c.id,
    message: `Entreprise ${c.name} créée`
  });
  revalidatePath("/companies");
  redirect(`/companies/${c.id}`);
}

export async function updateCompany(id: string, formData: FormData) {
  const session = await requirePermission("companies.write");
  const before = await prisma.company.findUniqueOrThrow({ where: { id } });
  const data = CompanySchema.parse(Object.fromEntries(formData));
  const after = await prisma.company.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "Company", entityId: id,
    message: `Entreprise ${after.name} modifiée`, before, after
  });
  revalidatePath(`/companies/${id}`);
  revalidatePath("/companies");
}

export async function deleteCompany(id: string) {
  const session = await requirePermission("companies.write");
  const before = await prisma.company.findUniqueOrThrow({ where: { id } });
  const c = await prisma.company.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "Company", entityId: id,
    message: `Entreprise ${c.name} supprimée`, before
  });
  revalidatePath("/companies");
  redirect("/companies");
}
