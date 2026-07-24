"use server";
/**
 * Favoris utilisateur (topbar). Chaque user peut épingler jusqu'à
 * MAX_FAVORITES raccourcis. Idempotent : addFavorite est upsert
 * sur (userId, href).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

// Cap métier. Non exporté : dans un fichier "use server", seules des fonctions
// async peuvent l'être. Le client hardcode la même valeur (composant FavoritesBar).
const MAX_FAVORITES = 10;

const AddSchema = z.object({
  label: z.string().min(1).max(60).transform((v) => v.trim()),
  href: z.string().min(1).max(500).transform((v) => v.trim()),
  icon: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function listFavorites() {
  const session = await requireSession();
  return prisma.userFavorite.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function addFavorite(formData: FormData) {
  const session = await requireSession();
  const data = AddSchema.parse(Object.fromEntries(formData));

  // Enforce max côté serveur
  const count = await prisma.userFavorite.count({ where: { userId: session.user.id } });
  const existing = await prisma.userFavorite.findUnique({
    where: { userId_href: { userId: session.user.id, href: data.href } }
  });
  if (!existing && count >= MAX_FAVORITES) {
    throw new Error(`Maximum ${MAX_FAVORITES} favoris. Retire-en un avant d'en ajouter un autre.`);
  }

  await prisma.userFavorite.upsert({
    where: { userId_href: { userId: session.user.id, href: data.href } },
    create: {
      userId: session.user.id,
      label: data.label,
      href: data.href,
      icon: data.icon,
      sortOrder: count
    },
    update: {
      label: data.label,
      icon: data.icon
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeFavorite(id: string) {
  const session = await requireSession();
  // On limite à ses propres favoris (defense-in-depth vs cURL)
  await prisma.userFavorite.deleteMany({
    where: { id, userId: session.user.id }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
