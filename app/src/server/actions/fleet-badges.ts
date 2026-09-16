"use server";
/**
 * FleetBadges — badges d'accès, cartes de recharge, télépéages, cartes carburant.
 * Attribués à un utilisateur et/ou un véhicule.
 *
 * Toutes les actions requièrent la permission `fleet.manage` — ce sont des
 * données admin (identifiants, abonnements, fournisseurs).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const Schema = z.object({
  id: z.string().optional().nullable(),
  type: z.enum(["ACCESS_BADGE", "RECHARGE_CARD", "TOLL_TAG", "FUEL_CARD", "PARKING_CARD", "OTHER"]),
  label: z.string().min(1, "Libellé requis").max(200),
  identifier: z.string().max(120).optional().nullable().transform((v) => v?.trim() || null),
  provider: z.string().max(120).optional().nullable().transform((v) => v?.trim() || null),
  monthlyFee: z.coerce.number().min(0).optional().nullable(),
  assignedUserId: z.string().optional().nullable().transform((v) => v || null),
  assignedVehicleId: z.string().optional().nullable().transform((v) => v || null),
  startDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  endDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  notes: z.string().max(1000).optional().nullable().transform((v) => v?.trim() || null),
  active: z.coerce.boolean().default(true)
});

export async function upsertFleetBadge(formData: FormData) {
  const session = await requirePermission("fleet.manage");
  const raw = Object.fromEntries(formData);
  // `active` arrive comme "on" ou absent (checkbox HTML)
  if (raw.active === "on") raw.active = "true" as any;
  else if (raw.active === undefined) raw.active = "false" as any;
  const data = Schema.parse(raw);

  const payload = {
    type: data.type,
    label: data.label,
    identifier: data.identifier,
    provider: data.provider,
    monthlyFee: data.monthlyFee ?? null,
    assignedUserId: data.assignedUserId,
    assignedVehicleId: data.assignedVehicleId,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes,
    active: data.active
  };

  if (data.id) {
    await prisma.fleetBadge.update({ where: { id: data.id }, data: payload });
    await logActivity({
      actorId: session.user.id, action: "UPDATE",
      entityType: "FleetBadge", entityId: data.id,
      message: `Badge/carte mis à jour : ${data.label}`
    });
  } else {
    const created = await prisma.fleetBadge.create({ data: payload });
    await logActivity({
      actorId: session.user.id, action: "CREATE",
      entityType: "FleetBadge", entityId: created.id,
      message: `Badge/carte créé : ${data.label}`
    });
  }
  revalidatePath("/fleet/badges");
  return { ok: true };
}

export async function deleteFleetBadge(id: string) {
  const session = await requirePermission("fleet.manage");
  const b = await prisma.fleetBadge.findUnique({ where: { id }, select: { id: true, label: true } });
  if (!b) throw new Error("Badge introuvable");
  await prisma.fleetBadge.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "FleetBadge", entityId: id,
    message: `Badge/carte supprimé : ${b.label}`
  });
  revalidatePath("/fleet/badges");
  return { ok: true };
}

/** Attribution rapide : réaffecter à un user et/ou véhicule sans passer par le form complet. */
export async function reassignFleetBadge(
  id: string,
  input: { assignedUserId?: string | null; assignedVehicleId?: string | null }
) {
  const session = await requirePermission("fleet.manage");
  const b = await prisma.fleetBadge.findUnique({ where: { id }, select: { id: true, label: true } });
  if (!b) throw new Error("Badge introuvable");
  await prisma.fleetBadge.update({
    where: { id },
    data: {
      assignedUserId: input.assignedUserId ?? null,
      assignedVehicleId: input.assignedVehicleId ?? null
    }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "FleetBadge", entityId: id,
    message: `Réattribution de ${b.label}`
  });
  revalidatePath("/fleet/badges");
  return { ok: true };
}
