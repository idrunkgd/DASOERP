// Téléchargement d'un document.
// Auth obligatoire (re-check côté serveur, pas de signed URL).
// Le fichier est lu depuis disque et streamé au client.
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();

  const doc = await prisma.document.findUnique({
    where: { id: params.id }
  });
  if (!doc) {
    return new Response("Document introuvable", { status: 404 });
  }

  const absolutePath = path.join(STORAGE_ROOT, doc.storagePath);

  // Vérifie que le chemin résolu reste sous STORAGE_ROOT (anti path traversal).
  const resolvedRoot = path.resolve(STORAGE_ROOT);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(resolvedRoot)) {
    return new Response("Chemin invalide", { status: 400 });
  }

  let stats;
  try {
    stats = await stat(absolutePath);
  } catch {
    return new Response(
      "Fichier physique introuvable — il a peut-être été supprimé manuellement",
      { status: 404 }
    );
  }

  // Décide inline (preview navigateur) vs attachment (download) selon le type.
  // PDF et images : inline (le navigateur sait afficher). Autres : attachment.
  const inlineMime = /^(application\/pdf|image\/|text\/)/i.test(doc.mimeType);
  const disposition = inlineMime ? "inline" : "attachment";

  // Encode le filename original en RFC 5987 pour gérer les accents
  const encodedName = encodeURIComponent(doc.originalName);

  // Log (non bloquant)
  logActivity({
    actorId: session.user.id,
    action: "VIEW",
    entityType: "Document",
    entityId: doc.id,
    message: `Téléchargement de « ${doc.title} »`
  }).catch(() => {});

  // Stream du fichier vers la response (compatible Next 14)
  const nodeStream = createReadStream(absolutePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(stats.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-cache"
    }
  });
}
