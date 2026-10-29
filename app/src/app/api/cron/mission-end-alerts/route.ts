/**
 * Endpoint cron sécurisé — envoie le digest email des missions se terminant
 * dans les 90 jours. À appeler via un cron externe (Coolify scheduled task,
 * Vercel cron, GitHub Actions...).
 *
 * Sécurité : header "x-cron-secret" doit matcher CRON_SECRET.
 * Fréquence recommandée : chaque lundi 8h.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendMissionEndDigest } from "@/server/services/mission-end-alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendMissionEndDigest();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
