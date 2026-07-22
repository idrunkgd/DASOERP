"use server";
/**
 * Wiki formation — édition markdown des articles + upload d'images.
 *
 * Réservé aux admins (`users.manage`). Chaque édition met à jour
 * `updatedById` pour la traçabilité affichée dans le header de l'article.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 Mo suffit pour une capture
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const UpdateSchema = z.object({
  content: z.string().min(1, "Contenu vide"),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional()
});

/**
 * Marque l'article comme "vérifié aujourd'hui contre la version actuelle
 * de l'ERP". Le badge "à revoir" disparaît. Sans lien avec l'édition du
 * contenu : on peut vérifier sans modifier.
 */
export async function markArticleReviewed(id: string) {
  const session = await requirePermission("users.manage");
  await prisma.wikiArticle.update({
    where: { id },
    data: { lastReviewedAt: new Date(), updatedById: session.user.id }
  });
  const existing = await prisma.wikiArticle.findUnique({
    where: { id }, select: { category: { select: { key: true } }, slug: true }
  });
  if (existing) {
    revalidatePath(`/formation/${existing.category.key}/${existing.slug}`);
    revalidatePath(`/formation/${existing.category.key}`);
  }
  return { ok: true };
}

/**
 * Upload une image pour le wiki. Retourne l'URL à insérer dans le markdown.
 * Le payload FormData contient "file" (Blob) et "filename" (String).
 */
export async function uploadWikiImage(formData: FormData) {
  const session = await requirePermission("users.manage");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fichier manquant.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Image trop lourde (max ${MAX_IMAGE_BYTES / 1024 / 1024} Mo).`);
  if (!ALLOWED_MIME.has(file.type)) throw new Error(`Format non supporté : ${file.type}. PNG/JPEG/GIF/WEBP uniquement.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const img = await prisma.wikiImage.create({
    data: {
      filename: file.name || "image",
      mimeType: file.type,
      sizeBytes: buf.length,
      data: buf,
      uploadedById: session.user.id
    },
    select: { id: true }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "WikiImage", entityId: img.id,
    message: `Image wiki uploadée (${file.name}, ${Math.round(file.size / 1024)} Ko)`
  });
  return { ok: true, id: img.id, url: `/api/wiki-images/${img.id}` };
}

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
