// Endpoint healthcheck pour Docker/Coolify.
// Vérifie que le serveur Next.js répond ET que la DB est joignable.
// Si Postgres tombe, le container est marqué "unhealthy" → Coolify le redémarre.
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch (e: any) {
    return NextResponse.json(
      { status: "degraded", db: "down", error: String(e?.message ?? e) },
      { status: 503 }
    );
  }
}
