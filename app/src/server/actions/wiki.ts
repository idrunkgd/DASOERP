"use server";
// Server actions pour le wiki interne (pages markdown).
// CRUD simple, slug auto-généré depuis le titre si non fourni.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PageSchema = z.object({
  title: z.string().min(1).max(120),
  slug: z.string().max(120).optional().nullable(),
  body: z.string().max(50000).default(""),
  category: z.string().max(60).optional().nullable(),
  pinned: z.coerce.boolean().default(false)
});

export async function createWikiPage(formData: FormData) {
  const session = await requireSession();
  const raw = Object.fromEntries(formData);
  const data = PageSchema.parse({
    title: raw.title,
    slug: raw.slug || null,
    body: raw.body || "",
    category: raw.category || null,
    pinned: raw.pinned ?? "false"
  });
  const slug = await uniqueSlug(data.slug || data.title);
  const created = await prisma.wikiPage.create({
    data: {
      title: data.title,
      slug,
      body: data.body,
      category: data.category,
      pinned: data.pinned,
      authorId: session.user.id,
      updatedById: session.user.id
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "WikiPage",
    entityId: created.id,
    message: `Page wiki « ${created.title} » créée`
  });
  revalidatePath("/knowledge");
  redirect(`/knowledge/${slug}`);
}

export async function updateWikiPage(id: string, formData: FormData) {
  const session = await requireSession();
  const before = await prisma.wikiPage.findUniqueOrThrow({ where: { id } });
  const raw = Object.fromEntries(formData);
  const data = PageSchema.parse({
    title: raw.title,
    slug: raw.slug || before.slug,
    body: raw.body || "",
    category: raw.category || null,
    pinned: raw.pinned ?? "false"
  });
  let slug = data.slug ?? before.slug;
  if (slug !== before.slug) slug = await uniqueSlug(slug, id);
  const after = await prisma.wikiPage.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      body: data.body,
      category: data.category,
      pinned: data.pinned,
      updatedById: session.user.id
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "WikiPage",
    entityId: id,
    message: `Page wiki « ${after.title} » mise à jour`,
    before,
    after
  });
  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${slug}`);
  if (slug !== before.slug) {
    redirect(`/knowledge/${slug}`);
  }
}

export async function deleteWikiPage(id: string) {
  const session = await requireSession();
  const before = await prisma.wikiPage.findUniqueOrThrow({ where: { id } });
  await prisma.wikiPage.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "WikiPage",
    entityId: id,
    message: `Page wiki « ${before.title} » supprimée`
  });
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Assure l'unicité du slug en ajoutant -2, -3... si nécessaire. */
async function uniqueSlug(raw: string, excludeId?: string): Promise<string> {
  const base = slugify(raw) || "page";
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conflict = await prisma.wikiPage.findUnique({
      where: { slug: candidate }
    });
    if (!conflict || conflict.id === excludeId) return candidate;
    n++;
    candidate = `${base}-${n}`;
  }
}
