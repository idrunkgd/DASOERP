/**
 * Endpoint cron sécurisé — envoie les rappels de tous les événements du
 * calendrier qui ont lieu demain. À brancher sur un cron Coolify quotidien
 * (7h ou 8h le matin, tous les jours ouvrés).
 *
 * Sécurité : header "x-cron-secret" doit matcher CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendCalendarRemindersForTomorrow } from "@/server/services/calendar-reminders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendCalendarRemindersForTomorrow();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
