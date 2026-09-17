/**
 * Génère le certificat PDF (côté serveur) et le sauvegarde comme Document
 * lié au consultant. Idempotent : ne crée pas de doublon si un cert existe
 * déjà pour cette combo (userId, courseId) avec un score >= seuil.
 */
import { promises as fs } from "fs";
import path from "path";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { CertificatePdfDocument } from "@/lib/certificate-pdf-template";
import { logActivity } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

// ID pseudo-cuid local — évite import externe (mirror du helper utilisé
// dans documents.ts).
function cuid(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `c${t}${r}`;
}
function certSlug(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";

export async function issueCertificateForUser(input: {
  userId: string;
  courseId: string;
  scorePercent: number;
}): Promise<{ ok: true; documentId: string; newlyIssued: boolean }> {
  const { userId, courseId, scorePercent } = input;

  const [user, course, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, certificateWording: true, isCertifying: true, passThreshold: true } }),
    prisma.document.findFirst({
      where: {
        consultantId: userId,
        tags: { has: `course:${courseId}` }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);
  if (!user || !course) throw new Error("Utilisateur ou cours introuvable");
  if (!course.isCertifying) throw new Error("Ce cours n'est pas certifiant");
  if (existing) {
    return { ok: true, documentId: existing.id, newlyIssued: false };
  }

  const personName = `${user.firstName} ${user.lastName}`.trim();
  const certNumber = `DSL-${new Date().getFullYear()}-${certSlug()}`;

  // Rendu du PDF
  const pdfBuffer = await renderToBuffer(
    CertificatePdfDocument({
      data: {
        personName,
        courseTitle: course.title,
        scorePercent,
        issuedAt: new Date(),
        certificateNumber: certNumber,
        legalWording: course.certificateWording ?? ""
      }
    }) as any
  );

  // Sauvegarde disque + Document DB (même pattern que l'upload manuel)
  const documentId = cuid();
  const safeName = `certificat-${course.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${certNumber}.pdf`;
  const relativePath = `${documentId}/${safeName}`;
  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, pdfBuffer);

  const doc = await prisma.document.create({
    data: {
      id: documentId,
      title: `Certificat — ${course.title}`,
      originalName: safeName,
      mimeType: "application/pdf",
      size: pdfBuffer.length,
      storagePath: relativePath,
      description: `Certificat de réussite — score ${scorePercent}% (seuil ${course.passThreshold}%). N° ${certNumber}.`,
      tags: ["certificat", `course:${courseId}`],
      consultantId: userId,
      uploadedById: userId
    }
  });

  await logActivity({
    actorId: userId,
    action: "CREATE",
    entityType: "Document",
    entityId: doc.id,
    message: `Certificat émis : ${course.title} (${scorePercent}%)`
  });

  // Notif in-app + email + push
  await createNotification({
    userId,
    type: "OTHER",
    title: `🎓 Certificat obtenu — ${course.title}`,
    message: `Score : ${scorePercent}%. Retrouve ton certificat dans Mes documents.`,
    href: `/me/documents`,
    entityType: "Document",
    entityId: doc.id
  });

  return { ok: true, documentId: doc.id, newlyIssued: true };
}
