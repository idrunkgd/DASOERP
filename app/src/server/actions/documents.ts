"use server";
// Server actions du module Documents.
//
// Stockage : disque local sous DOCS_STORAGE_PATH (par défaut /data/documents).
// Chaque doc dans son sous-dossier <documentId>/, ce qui évite les collisions
// de noms et permet un cleanup atomique à la suppression.
//
// Sécurité :
//   - Toute action exige une session authentifiée.
//   - À l'upload, on rejette les fichiers > MAX_SIZE_BYTES.
//   - Le contenu n'est jamais servi via une server action — le téléchargement
//     passe par /api/documents/[id]/download qui re-vérifie l'auth.
//
// IMPORTANT : penser à augmenter `serverActions.bodySizeLimit` dans
// next.config.mjs (sinon les uploads > 4 MB sont refusés silencieusement).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";

const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const MetaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  tags: z.string().optional().nullable(), // CSV "Contrat, NDA, RH"
  expiresAt: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  offerId: z.string().optional().nullable(),
  consultantId: z.string().optional().nullable()
});

/**
 * Upload d'un nouveau document (V1 = sans parent).
 * Écrit le fichier sur disque puis crée la ligne en DB. En cas d'erreur DB
 * après l'écriture, on tente le rollback du fichier.
 */
export async function uploadDocument(formData: FormData) {
  const session = await requireSession();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("Aucun fichier fourni");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB) — max ${MAX_SIZE_BYTES / 1024 / 1024} MB`
    );
  }

  const raw = Object.fromEntries(formData);
  const meta = MetaSchema.parse({
    title: raw.title || file.name,
    description: raw.description || null,
    tags: raw.tags || null,
    expiresAt: raw.expiresAt || null,
    companyId: raw.companyId || null,
    projectId: raw.projectId || null,
    offerId: raw.offerId || null,
    consultantId: raw.consultantId || null
  });

  const tags = parseTags(meta.tags);

  // Génère un ID, prépare le chemin de stockage
  const documentId = await prisma.$transaction(async (tx) => {
    // On utilise un cuid Prisma — on récupère via une création préliminaire.
    // Plus simple : utiliser un id généré côté serveur (cuid).
    return undefined;
  }).then(() => null).catch(() => null) ?? cuid();

  const safeName = sanitizeFileName(file.name);
  const relativePath = `${documentId}/${safeName}`;
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  // Crée le dossier puis écrit le fichier
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  // Crée la ligne en DB — rollback fichier si erreur
  try {
    const created = await prisma.document.create({
      data: {
        id: documentId,
        title: meta.title,
        originalName: file.name,
        mimeType: file.type || guessMime(file.name),
        size: buffer.length,
        storagePath: relativePath,
        description: meta.description,
        tags,
        expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : null,
        companyId: meta.companyId,
        projectId: meta.projectId,
        offerId: meta.offerId,
        consultantId: meta.consultantId,
        uploadedById: session.user.id
      }
    });
    await logActivity({
      actorId: session.user.id,
      action: "CREATE",
      entityType: "Document",
      entityId: created.id,
      message: `Document « ${created.title} » uploadé (${humanSize(created.size)})`
    });
    revalidatePath("/documents");
    return created;
  } catch (e) {
    // Cleanup fichier si DB a planté
    await fs.rm(path.dirname(absolutePath), { recursive: true, force: true });
    throw e;
  }
}

/**
 * Upload d'une nouvelle VERSION d'un document existant.
 * Reprend les métadonnées du parent (title, tags, liens entités) et incrémente
 * le numéro de version.
 */
export async function uploadDocumentVersion(
  parentDocumentId: string,
  formData: FormData
) {
  const session = await requireSession();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Aucun fichier fourni");
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`Fichier trop volumineux — max ${MAX_SIZE_BYTES / 1024 / 1024} MB`);
  }

  const parent = await prisma.document.findUniqueOrThrow({
    where: { id: parentDocumentId }
  });
  if (parent.parentDocumentId) {
    throw new Error(
      "Impossible d'ajouter une version à une version (uploade sur le document racine)"
    );
  }

  // Nouvelle version = max(version) des enfants + 1
  const maxVersion = await prisma.document.aggregate({
    where: { parentDocumentId: parent.id },
    _max: { version: true }
  });
  const newVersion = Math.max(parent.version, maxVersion._max.version ?? 1) + 1;

  const documentId = cuid();
  const safeName = sanitizeFileName(file.name);
  const relativePath = `${documentId}/${safeName}`;
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  try {
    const created = await prisma.document.create({
      data: {
        id: documentId,
        title: parent.title,
        originalName: file.name,
        mimeType: file.type || guessMime(file.name),
        size: buffer.length,
        storagePath: relativePath,
        description: parent.description,
        tags: parent.tags,
        expiresAt: parent.expiresAt,
        companyId: parent.companyId,
        projectId: parent.projectId,
        offerId: parent.offerId,
        consultantId: parent.consultantId,
        parentDocumentId: parent.id,
        version: newVersion,
        uploadedById: session.user.id
      }
    });
    await logActivity({
      actorId: session.user.id,
      action: "CREATE",
      entityType: "Document",
      entityId: created.id,
      message: `Document « ${parent.title} » V${newVersion} uploadé`
    });
    revalidatePath("/documents");
    revalidatePath(`/documents/${parent.id}`);
    return created;
  } catch (e) {
    await fs.rm(path.dirname(absolutePath), { recursive: true, force: true });
    throw e;
  }
}

/**
 * Met à jour les métadonnées d'un document (titre, description, tags,
 * expiration, liens entités). Le fichier physique n'est pas touché.
 */
export async function updateDocumentMeta(id: string, formData: FormData) {
  const session = await requireSession();
  const raw = Object.fromEntries(formData);
  const meta = MetaSchema.parse({
    title: raw.title,
    description: raw.description || null,
    tags: raw.tags || null,
    expiresAt: raw.expiresAt || null,
    companyId: raw.companyId || null,
    projectId: raw.projectId || null,
    offerId: raw.offerId || null,
    consultantId: raw.consultantId || null
  });
  const before = await prisma.document.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.document.update({
    where: { id },
    data: {
      title: meta.title,
      description: meta.description,
      tags: parseTags(meta.tags),
      expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : null,
      companyId: meta.companyId,
      projectId: meta.projectId,
      offerId: meta.offerId,
      consultantId: meta.consultantId
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Document",
    entityId: id,
    message: `Document « ${updated.title} » mis à jour`,
    before,
    after: updated
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return updated;
}

/**
 * Supprime un document (et ses versions s'il s'agit du parent racine).
 * Cleanup les fichiers physiques aussi. Idempotent côté fichier.
 */
export async function deleteDocument(id: string) {
  const session = await requireSession();
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id },
    include: { versions: true }
  });

  // Si c'est le doc racine, on supprime aussi toutes les versions
  const allIds = doc.parentDocumentId ? [id] : [id, ...doc.versions.map((v) => v.id)];
  const allPaths = doc.parentDocumentId
    ? [doc.storagePath]
    : [doc.storagePath, ...doc.versions.map((v) => v.storagePath)];

  // Supprime les rows
  await prisma.document.deleteMany({ where: { id: { in: allIds } } });

  // Cleanup fichiers (best effort — on ne plante pas si déjà absents)
  for (const p of allPaths) {
    const dir = path.dirname(path.join(STORAGE_ROOT, p));
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "Document",
    entityId: id,
    message: `Document « ${doc.title} » supprimé${
      doc.parentDocumentId ? "" : ` (+ ${doc.versions.length} version(s))`
    }`
  });
  revalidatePath("/documents");
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseTags(csv?: string | null): string[] {
  if (!csv) return [];
  return Array.from(
    new Set(
      csv
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 40)
    )
  );
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._\- ]/g, "_")
    .slice(0, 200);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    txt: "text/plain",
    csv: "text/csv",
    md: "text/markdown",
    json: "application/json",
    zip: "application/zip"
  };
  return map[ext] || "application/octet-stream";
}

// Petit cuid local pour éviter d'importer une dépendance — Prisma en a un en
// interne mais on a besoin de générer l'id avant d'écrire en DB pour utiliser
// le même comme dossier de stockage.
function cuid(): string {
  return (
    "c" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}
