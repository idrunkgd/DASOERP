"use server";
/**
 * CRUD des notes de suivi de mission (2 audiences : CLIENT, CONSULTANT).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const AudienceSchema = z.enum(["CLIENT", "CONSULTANT"]);

const NoteSchema = z.object({
  missionId: z.string().min(1),
  audience: AudienceSchema,
  content: z.string().min(1).max(5000)
});

export async function addMissionNote(formData: FormData) {
  const session = await requireSession();
  const data = NoteSchema.parse({
    missionId: formData.get("missionId"),
    audience: formData.get("audience"),
    content: String(formData.get("content") ?? "").trim()
  });
  const note = await (prisma as any).missionNote.create({
    data: { ...data, authorId: session.user.id }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE", entityType: "MissionNote",
    entityId: note.id, message: `Note ${data.audience} ajoutée sur mission ${data.missionId}`
  });
  revalidatePath(`/missions/${data.missionId}`);
  return { ok: true, id: note.id };
}

const UpdateSchema = z.object({ content: z.string().min(1).max(5000) });

export async function updateMissionNote(id: string, formData: FormData) {
  const session = await requireSession();
  const data = UpdateSchema.parse({ content: String(formData.get("content") ?? "").trim() });
  const before = await (prisma as any).missionNote.findUniqueOrThrow({ where: { id } });
  const note = await (prisma as any).missionNote.update({
    where: { id }, data: { content: data.content }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE", entityType: "MissionNote",
    entityId: id, message: "Note mission mise à jour", before, after: note
  });
  revalidatePath(`/missions/${note.missionId}`);
  return { ok: true };
}

export async function deleteMissionNote(id: string) {
  const session = await requireSession();
  const before = await (prisma as any).missionNote.findUnique({ where: { id } });
  if (!before) return { ok: true };
  await (prisma as any).missionNote.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE", entityType: "MissionNote",
    entityId: id, message: "Note mission supprimée", before
  });
  revalidatePath(`/missions/${before.missionId}`);
  return { ok: true };
}
