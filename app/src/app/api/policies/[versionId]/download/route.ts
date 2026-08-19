/**
 * Téléchargement d'une version PDF de politique. Auth check : le user
 * doit avoir policies.read ET (soit policies.manage soit être signataire
 * assigné à cette version).
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";

const STORAGE_ROOT = process.env.DOCS_STORAGE_PATH || "/data/documents";

export async function GET(_req: NextRequest, { params }: { params: { versionId: string } }) {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!perms.includes("policies.read")) return new NextResponse("Forbidden", { status: 403 });

  const version = await prisma.signableDocumentVersion.findUnique({
    where: { id: params.versionId },
    include: { document: true }
  });
  if (!version) return new NextResponse("Not found", { status: 404 });

  // Autorisation : soit policies.manage, soit être assigné à cette version
  const canManage = perms.includes("policies.manage");
  if (!canManage) {
    const sig = await prisma.documentSignature.findFirst({
      where: { versionId: params.versionId, userId: session.user.id }
    });
    if (!sig) return new NextResponse("Forbidden", { status: 403 });
  }

  const abs = path.join(STORAGE_ROOT, version.filePath);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return new NextResponse("File missing on disk", { status: 500 });
  }
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": version.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(version.originalName)}"`
    }
  });
}
