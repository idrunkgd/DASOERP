"use server";
/**
 * Wiki formation — édition markdown des articles.
 *
 * Réservé aux admins (`users.manage`). Chaque édition met à jour
 * `updatedById` pour la traçabilité affichée dans le header de l'article.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const UpdateSchema = z.object({
  content: z.string().min(1, "Contenu vide"),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional()
});

export async function updateWikiArticle(id: string, data: z.infer<typeof UpdateSchema>) {
  const session = await requirePermission("users.manage");
  const parsed = UpdateSchema.parse(data);
  const existing = await prisma.wikiArticle.findUnique({
    where: { id },
    select: { title: true, categoryId: true, category: { select: { key: true } }, slug: true }
  });
  if (!existing) throw new Error("Article introuvable");

  await prisma.wikiArticle.update({
    where: { id },
    data: {
      content: parsed.content,
      title: parsed.title,
      description: parsed.description,
      updatedById: session.user.id
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "WikiArticle", entityId: id,
    message: `Article wiki mis à jour : ${parsed.title ?? existing.title}`
  });
  revalidatePath(`/formation/${existing.category.key}/${existing.slug}`);
  revalidatePath(`/formation/${existing.category.key}`);
  return { ok: true };
}
