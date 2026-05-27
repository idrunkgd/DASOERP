"use server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { saveCompanyInfo, type CompanyInfo } from "@/lib/company-info";

const Schema = z.object({
  legalName: z.string().min(1).max(200),
  street: z.string().min(1).max(200),
  postalCode: z.string().min(1).max(20),
  city: z.string().min(1).max(100),
  country: z.string().min(1).max(100),
  vatNumber: z.string().min(1).max(50),
  bceNumber: z.string().max(50).default(""),
  email: z.string().email(),
  phone: z.string().max(50).default(""),
  iban: z.string().min(1).max(50),
  bic: z.string().max(20).default(""),
  website: z.string().max(200).default(""),
  legalNotice: z.string().max(2000).default(""),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  offerValidityDays: z.coerce.number().int().min(1).max(365).default(30)
});

export async function updateCompanyInfo(formData: FormData) {
  const session = await requirePermission("settings.manage");
  const data: CompanyInfo = Schema.parse(Object.fromEntries(formData));
  await saveCompanyInfo(data);
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Setting",
    entityId: "company_info",
    message: "Informations légales de l'entreprise mises à jour"
  });
  revalidatePath("/settings/company");
  revalidatePath("/settings");
}
