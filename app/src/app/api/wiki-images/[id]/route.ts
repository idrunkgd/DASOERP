import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

/**
 * Sert une image du wiki à partir de son id. Auth session requise —
 * pas d'accès public. Cache immutable un an côté navigateur (l'id
 * change à chaque nouvelle image, donc pas de risque de stale).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireSession();
  const img = await prisma.wikiImage.findUnique({
    where: { id: params.id },
    select: { data: true, mimeType: true }
  });
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(img.data, {
    status: 200,
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable"
    }
  });
}
