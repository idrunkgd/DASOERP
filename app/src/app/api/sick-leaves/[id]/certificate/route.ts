import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";

/**
 * Sert le certificat médical d'un arrêt maladie.
 *
 * Nécessaire car les certificats sont stockés en data URI (base64 inline)
 * en base — un simple `<a href="data:...">` est bloqué en navigation par les
 * navigateurs récents (Chrome, Firefox) pour raisons de sécurité. On les sert
 * donc via cette route API :
 *   1. On vérifie la session + les droits (propriétaire OU users.manage)
 *   2. On décode la data URI → binaire + content-type
 *   3. On renvoie le fichier avec Content-Type correct → le browser peut
 *      l'ouvrir en visualisation inline (PDF, image) ou proposer download.
 *
 * Pour les certificats stockés en URL classique (http://…), on redirige
 * simplement.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();

  const sl = await prisma.sickLeave.findUnique({
    where: { id: params.id },
    select: { userId: true, certificateUrl: true }
  });
  if (!sl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sl.certificateUrl) return NextResponse.json({ error: "No certificate" }, { status: 404 });

  // Droits : propriétaire OU users.manage (RH)
  const isOwner = sl.userId === session.user.id;
  if (!isOwner) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("users.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Cas 1 : URL classique → redirect
  if (!sl.certificateUrl.startsWith("data:")) {
    return NextResponse.redirect(sl.certificateUrl);
  }

  // Cas 2 : data URI → parse + serve
  //   data:[<mime>][;base64],<payload>
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(sl.certificateUrl);
  if (!match) {
    return NextResponse.json({ error: "Invalid data URI" }, { status: 500 });
  }
  const mime = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const payload = match[3];

  let buffer: Buffer;
  if (isBase64) {
    buffer = Buffer.from(payload, "base64");
  } else {
    buffer = Buffer.from(decodeURIComponent(payload), "utf8");
  }

  // Extension par défaut pour Content-Disposition
  const ext = mime === "application/pdf" ? "pdf"
            : mime.startsWith("image/") ? mime.split("/")[1]
            : "bin";
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mime,
      // inline : le navigateur affiche PDF/image directement dans l'onglet
      "Content-Disposition": `inline; filename="certificat-${params.id}.${ext}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
