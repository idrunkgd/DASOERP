import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";

/**
 * POST /api/push/subscribe
 * Body : PushSubscriptionJSON du browser
 *   { endpoint, keys: { p256dh, auth } }
 * Upsert par endpoint (unique) — on peut ré-appeler sans risque.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  const ua = req.headers.get("user-agent") ?? null;
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      userId: session.user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: ua
    },
    update: {
      userId: session.user.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: ua,
      lastUsedAt: new Date()
    }
  });
  return NextResponse.json({ ok: true, id: sub.id });
}

export async function DELETE(req: Request) {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint requis" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id }
  });
  return NextResponse.json({ ok: true });
}
