"use server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, read: false },
    data: { read: true, readAt: new Date() }
  });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const session = await requireSession();
  const res = await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true, readAt: new Date() }
  });
  revalidatePath("/notifications");
  return { ok: true, count: res.count };
}

export async function deleteNotification(id: string) {
  const session = await requireSession();
  await prisma.notification.deleteMany({
    where: { id, userId: session.user.id }
  });
  revalidatePath("/notifications");
  return { ok: true };
}
