"use server";
// Server actions pour la gestion des liens vers les applications externes
// utilisées par Dasolabs (Hetzner, Vercel, GitHub, etc.).
// L'édition est réservée aux ADMINs ; la lecture se fait directement côté
// page via Prisma puisque tout user connecté peut voir la liste.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  name: z.string().min(1, "Nom requis").max(60),
  url: z.string().min(1, "URL requise").max(500).refine(
    (v) => /^https?:\/\//i.test(v),
    "L'URL doit commencer par http(s)://"
  ),
  description: z.string().max(280).optional().nullable(),
  position: z.coerce.number().int().default(0)
});

// On garde la fonction sous ce nom pour la sémantique, mais aujourd'hui
// elle accepte tout utilisateur authentifié. Si on veut re-restreindre plus
// tard, c'est ici qu'on rajoute le check de rôle.
async function requireAdmin() {
  return requireSession();
}

export async function createAppLink(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const data = Schema.parse({
    name: raw.name,
    url: raw.url,
    description: raw.description || null,
    position: raw.position ?? 0
  });
  const created = await prisma.appLink.create({
    data: { ...data, createdById: session.user.id }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "AppLink",
    entityId: created.id,
    message: `Lien app « ${created.name} » créé`,
    after: created
  });
  revalidatePath("/app-links");
}

export async function updateAppLink(id: string, formData: FormData) {
  const session = await requireAdmin();
  const before = await prisma.appLink.findUniqueOrThrow({ where: { id } });
  const raw = Object.fromEntries(formData);
  const data = Schema.parse({
    name: raw.name,
    url: raw.url,
    description: raw.description || null,
    position: raw.position ?? before.position
  });
  const after = await prisma.appLink.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "AppLink",
    entityId: id,
    message: `Lien app « ${after.name} » mis à jour`,
    before,
    after
  });
  revalidatePath("/app-links");
}

export async function deleteAppLink(id: string) {
  const session = await requireAdmin();
  const before = await prisma.appLink.findUniqueOrThrow({ where: { id } });
  await prisma.appLink.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "AppLink",
    entityId: id,
    message: `Lien app « ${before.name} » supprimé`,
    before
  });
  revalidatePath("/app-links");
}
