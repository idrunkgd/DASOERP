"use server";
/**
 * Chartes & politiques à signer par les employés.
 *
 * Workflow :
 *   1. Admin crée un SignableDocument avec sa v1 (upload PDF) [createPolicy]
 *   2. Admin assigne la dernière version à des utilisateurs [assignPolicy]
 *      → chaque assignation = DocumentSignature status PENDING
 *   3. L'utilisateur voit ses PENDING dans /me → clic 'Signer' → il tape
 *      son nom complet en attestation "Lu et approuvé", on enregistre
 *      timestamp + IP + user-agent [signPolicy]
 *   4. Nouvelle version d'un document [uploadNewVersion] :
 *      - versionNum++ + nouveau fichier
 *      - Les SIGNED de la version précédente restent (audit), mais on peut
 *        ré-assigner à ces mêmes users pour la nouvelle version.
 *
 * Stockage disque : DOCS_STORAGE_PATH/signable/<docId>/v<n>/<safeName>
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { promises as fs } from "fs";
import path from "path";

const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB pour les chartes / politiques

// ═════════════ CRÉATION ═════════════

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null),
  category: z.string().optional().nullable().transform((v) => v?.trim() || null),
  mandatory: z.coerce.boolean().default(true),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function cuid(): string {
  return "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Crée un document à signer + sa v1 (upload du PDF). */
export async function createPolicy(formData: FormData) {
  const session = await requirePermission("policies.manage");
  const data = CreateSchema.parse(Object.fromEntries(formData));

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Le fichier PDF est requis.");
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) — max ${MAX_SIZE_BYTES / 1024 / 1024} Mo.`);
  }

  const docId = cuid();
  const safeName = sanitizeFileName(file.name);
  const rel = `signable/${docId}/v1/${safeName}`;
  const abs = path.join(STORAGE_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buffer);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.signableDocument.create({
        data: {
          id: docId,
          title: data.title,
          description: data.description,
          category: data.category,
          mandatory: data.mandatory,
          createdById: session.user.id
        }
      });
      await tx.signableDocumentVersion.create({
        data: {
          documentId: doc.id,
          versionNum: 1,
          filePath: rel,
          originalName: file.name,
          mimeType: file.type || "application/pdf",
          size: buffer.length,
          notes: data.notes,
          createdById: session.user.id
        }
      });
      return doc;
    });
    await logActivity({
      actorId: session.user.id, action: "CREATE",
      entityType: "SignableDocument", entityId: created.id,
      message: `Politique créée : ${created.title} (v1)`
    });
    revalidatePath("/policies");
    return { ok: true, id: created.id };
  } catch (e) {
    await fs.rm(path.dirname(abs), { recursive: true, force: true });
    throw e;
  }
}

/** Nouvelle version d'un document — les signatures anciennes restent (audit). */
export async function uploadNewPolicyVersion(documentId: string, formData: FormData) {
  const session = await requirePermission("policies.manage");
  const notes = String(formData.get("notes") || "").trim() || null;
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Le fichier PDF est requis.");
  if (file.size > MAX_SIZE_BYTES) throw new Error("Fichier trop volumineux (max 20 Mo).");

  const doc = await prisma.signableDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } }
  });
  const next = (doc.versions[0]?.versionNum ?? 0) + 1;

  const safeName = sanitizeFileName(file.name);
  const rel = `signable/${documentId}/v${next}/${safeName}`;
  const abs = path.join(STORAGE_ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(abs, buffer);

  try {
    const version = await prisma.signableDocumentVersion.create({
      data: {
        documentId,
        versionNum: next,
        filePath: rel,
        originalName: file.name,
        mimeType: file.type || "application/pdf",
        size: buffer.length,
        notes,
        createdById: session.user.id
      }
    });
    await logActivity({
      actorId: session.user.id, action: "UPDATE",
      entityType: "SignableDocument", entityId: documentId,
      message: `Politique « ${doc.title} » — nouvelle version v${next}`
    });
    revalidatePath("/policies");
    revalidatePath(`/policies/${documentId}`);
    return { ok: true, versionId: version.id, versionNum: next };
  } catch (e) {
    await fs.rm(path.dirname(abs), { recursive: true, force: true });
    throw e;
  }
}

export async function deletePolicy(documentId: string) {
  const session = await requirePermission("policies.manage");
  const doc = await prisma.signableDocument.findUniqueOrThrow({ where: { id: documentId } });
  await prisma.signableDocument.delete({ where: { id: documentId } });
  // Cleanup disque
  const abs = path.join(STORAGE_ROOT, "signable", documentId);
  await fs.rm(abs, { recursive: true, force: true }).catch(() => {});
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "SignableDocument", entityId: documentId,
    message: `Politique supprimée : ${doc.title}`
  });
  revalidatePath("/policies");
  return { ok: true };
}

// ═════════════ ASSIGNATION ═════════════

/**
 * Assigne la dernière version d'un document à N utilisateurs.
 * Idempotent : si (userId, versionId) existe déjà, on skip.
 * `userIds` vide OU spécial "all" = assigne à tous les users actifs (hors
 * comptes portail candidat).
 */
export async function assignPolicy(documentId: string, userIds: string[] | "all") {
  const session = await requirePermission("policies.manage");
  const doc = await prisma.signableDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNum: "desc" }, take: 1 } }
  });
  const version = doc.versions[0];
  if (!version) throw new Error("Aucune version disponible pour ce document.");

  let targets: string[];
  if (userIds === "all") {
    const all = await prisma.user.findMany({
      where: { active: true, candidateProfile: { is: null } },
      select: { id: true }
    });
    targets = all.map((u) => u.id);
  } else {
    targets = userIds;
  }
  if (targets.length === 0) return { assigned: 0, skipped: 0 };

  let assigned = 0;
  let skipped = 0;
  for (const uid of targets) {
    try {
      await prisma.documentSignature.create({
        data: {
          documentId,
          versionId: version.id,
          userId: uid,
          status: "PENDING",
          assignedById: session.user.id
        }
      });
      assigned++;
    } catch (e: any) {
      // P2002 = unique constraint : déjà assigné
      if (e?.code === "P2002") skipped++;
      else throw e;
    }
  }
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "DocumentSignature", entityId: documentId,
    message: `Politique « ${doc.title} » v${version.versionNum} assignée à ${assigned} utilisateur(s), ${skipped} déjà signataire(s)`
  });
  revalidatePath("/policies");
  revalidatePath(`/policies/${documentId}`);
  revalidatePath("/me");
  return { assigned, skipped };
}

// ═════════════ SIGNATURE ═════════════

const SignSchema = z.object({
  signatureText: z.string().min(3, "Tape ton nom complet pour signer.")
});

/**
 * Un utilisateur signe sa DocumentSignature PENDING. On capture le nom
 * qu'il tape + timestamp + IP + user-agent comme trace d'audit.
 * Sécurité : on vérifie que le userId de la signature = session.user.id.
 */
export async function signPolicy(signatureId: string, formData: FormData) {
  const session = await requireSession();
  const data = SignSchema.parse(Object.fromEntries(formData));
  const sig = await prisma.documentSignature.findUniqueOrThrow({
    where: { id: signatureId },
    include: { document: { select: { title: true } } }
  });
  if (sig.userId !== session.user.id) {
    throw new Error("Cette signature ne t'appartient pas.");
  }
  if (sig.status === "SIGNED") {
    throw new Error("Ce document est déjà signé.");
  }
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "inconnue";
  const ua = h.get("user-agent") ?? "inconnu";

  await prisma.documentSignature.update({
    where: { id: signatureId },
    data: {
      status: "SIGNED",
      signedAt: new Date(),
      signatureText: data.signatureText.trim(),
      signatureIp: ip.slice(0, 100),
      signatureUA: ua.slice(0, 500)
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "DocumentSignature", entityId: signatureId,
    message: `Signature apposée : ${sig.document.title} par ${data.signatureText}`
  });
  revalidatePath("/me");
  revalidatePath("/policies");
  revalidatePath(`/policies/${sig.documentId}`);
  return { ok: true };
}

export async function declinePolicy(signatureId: string, reason: string) {
  const session = await requireSession();
  const sig = await prisma.documentSignature.findUniqueOrThrow({ where: { id: signatureId } });
  if (sig.userId !== session.user.id) throw new Error("Cette signature ne t'appartient pas.");
  if (sig.status === "SIGNED") throw new Error("Ce document est déjà signé.");

  await prisma.documentSignature.update({
    where: { id: signatureId },
    data: {
      status: "DECLINED",
      declinedAt: new Date(),
      declinedReason: reason.trim() || null
    }
  });
  revalidatePath("/me");
  revalidatePath("/policies");
  revalidatePath(`/policies/${sig.documentId}`);
  return { ok: true };
}
