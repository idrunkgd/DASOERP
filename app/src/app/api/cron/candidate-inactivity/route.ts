/**
 * Endpoint cron — relance des candidats inactifs depuis >4 mois.
 * À brancher sur un cron Coolify hebdomadaire (ex: lundi 8h).
 * Sécurité : header "x-cron-secret" doit matcher CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendCandidateInactivityReminders } from "@/server/services/candidate-inactivity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendCandidateInactivityReminders();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
