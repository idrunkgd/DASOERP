"use server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { promoteCandidateToConsultant, offboardConsultant, createCandidatePortalAccount } from "@/server/services/recruitment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PromoteSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(8, "Mot de passe initial : 8 caractères minimum"),
  role: z.enum(["CONSULTANT","MANAGER","COMMERCIAL","FINANCE"]).default("CONSULTANT"),
  joinedAt: z.string().optional().nullable().transform(v => v ? new Date(v) : new Date()),
  weeklyCapacityH: z.coerce.number().nonnegative().default(38)
});

export async function promoteCandidateAction(candidateId: string, formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = PromoteSchema.parse(Object.fromEntries(formData));
  const user = await promoteCandidateToConsultant({
    actorId: session.user.id, candidateId, ...data
  });
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/consultants");
  revalidatePath("/users");
  redirect(`/consultants/${user.id}`);
}

const OffboardSchema = z.object({
  keepInPool: z.coerce.boolean().default(false),
  reason: z.string().optional().nullable()
});

const PortalSchema = z.object({
  email: z.string().email(),
  tempPassword: z.string().min(8, "Mot de passe initial : 8 caractères minimum")
});

export async function createCandidatePortalAction(candidateId: string, formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = PortalSchema.parse(Object.fromEntries(formData));
  await createCandidatePortalAccount({ actorId: session.user.id, candidateId, ...data });
  revalidatePath(`/candidates/${candidateId}`);
}

export async function offboardConsultantAction(userId: string, formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = OffboardSchema.parse(Object.fromEntries(formData));
  await offboardConsultant({ actorId: session.user.id, userId, ...data });
  revalidatePath(`/consultants/${userId}`);
  revalidatePath("/consultants");
  revalidatePath("/candidates");
  redirect("/consultants");
}
