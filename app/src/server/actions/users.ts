"use server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const Schema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["ADMIN","MANAGER","COMMERCIAL","CONSULTANT","FINANCE"]),
  active: z.coerce.boolean().default(true),
  // Profil consultant
  photoUrl: z.string().optional().nullable().transform(v => {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (t.length > 1_400_000) throw new Error("Photo trop volumineuse (>1 Mo)");
    return t;
  }),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  seniority: z.string().optional().nullable(),
  yearsExperience: z.coerce.number().int().nonnegative().optional().nullable(),
  spokenLanguages: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  // Coûts internes
  hourlyCost:    z.coerce.number().nonnegative().optional(),
  dailyCost:     z.coerce.number().nonnegative().optional(),
  weeklyCapacityH: z.coerce.number().nonnegative().default(38),
  skills: z.string().optional().transform(v => v ? v.split(",").map(s => s.trim()).filter(Boolean) : []),
  joinedAt: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  leftAt:   z.string().optional().nullable().transform(v => v ? new Date(v) : null),
  password: z.string().optional()
});

export async function createUserAction(formData: FormData) {
  const session = await requirePermission("users.manage");
  const data = Schema.parse(Object.fromEntries(formData));
  if (!data.password || data.password.length < 8) throw new Error("Mot de passe initial requis (8 caractères min)");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const { password, ...rest } = data;
  const u = await prisma.user.create({ data: { ...rest, passwordHash } });
  await logActivity({ actorId: session.user.id, action: "CREATE", entityType: "User", entityId: u.id, message: `Utilisateur ${u.email} créé` });
  revalidatePath("/users");
  redirect(`/users/${u.id}`);
}

export async function updateUserAction(id: string, formData: FormData) {
  const session = await requirePermission("users.manage");
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const data = Schema.parse(Object.fromEntries(formData));
  const { password, ...rest } = data;
  const updateData: any = { ...rest };
  if (password && password.length >= 8) updateData.passwordHash = await bcrypt.hash(password, 10);
  const after = await prisma.user.update({ where: { id }, data: updateData });
  // On retire les hashes du diff
  const { passwordHash: _b, ...beforeSafe } = before as any;
  const { passwordHash: _a, ...afterSafe } = after as any;
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "User", entityId: id, message: "Utilisateur mis à jour", before: beforeSafe, after: afterSafe });
  revalidatePath(`/users/${id}`); revalidatePath("/users");
}

export async function setUserActive(id: string, active: boolean) {
  const session = await requirePermission("users.manage");
  await prisma.user.update({ where: { id }, data: { active } });
  await logActivity({ actorId: session.user.id, action: "UPDATE", entityType: "User", entityId: id, message: active ? "Utilisateur réactivé" : "Utilisateur désactivé" });
  revalidatePath(`/users/${id}`); revalidatePath("/users");
}
