import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

/**
 * Nombre de signatures PENDING pour l'utilisateur courant. Utilisé par le
 * badge sur l'item sidebar "Chartes & politiques" (poll toutes les 60s).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const count = await prisma.documentSignature.count({
      where: { userId: session.user.id, status: "PENDING" }
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
