/**
 * Endpoint appelé par le boundary d'erreur global (app/error.tsx et
 * global-error.tsx) pour reporter les erreurs client dans AppLog.
 *
 * Payload attendu :
 *   { message: string; stack?: string; path?: string; meta?: object }
 *
 * Auth : facultative. On tente de récupérer la session pour attacher
 * userId ; sinon on log l'erreur en anonyme.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAppError } from "@/lib/app-log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* body vide, on log quand même */ }

  let userId: string | null = null;
  try {
    const session = await getServerSession(authOptions);
    userId = session?.user?.id ?? null;
  } catch { /* pas d'auth, tant pis */ }

  await logAppError({
    level: body?.level === "WARN" ? "WARN" : "ERROR",
    message: String(body?.message ?? "(client error, no message)"),
    stack: body?.stack ? String(body.stack) : null,
    path: body?.path ? String(body.path) : null,
    userId,
    meta: body?.meta && typeof body.meta === "object" ? body.meta : null
  });

  return NextResponse.json({ ok: true });
}
