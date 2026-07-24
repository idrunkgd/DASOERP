"use server";
/**
 * Flotte véhicules — CRUD Vehicle + LeasingContract + VehicleAssignment.
 *
 * Sync cashflow : à la création/maj/suppression d'un LeasingContract, on
 * upsert automatiquement une RecurringExpense (catégorie "Leasing véhicules")
 * avec les dates de contrat comme bornes. Suppression du contrat = suppression
 * de la ligne cashflow. Idempotent, safe à rejouer.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const DEFAULT_LEASING_CATEGORY = "Leasing véhicules";
const MAX_PHOTO_BYTES = 1_400_000; // ~1 Mo base64

/// ----------- Vehicle -----------

const VehicleSchema = z.object({
  plate: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  brand: z.string().min(1),
  model: z.string().min(1),
  vin: z.string().optional().nullable().transform((v) => v?.trim() || null),
  category: z.enum(["LEASING", "OWNED"]),
  status: z.enum(["ACTIVE", "RETURNED", "SOLD", "ARCHIVED"]).default("ACTIVE"),
  photoUrl: z.string().optional().nullable().transform((v) => {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (t.length > MAX_PHOTO_BYTES) throw new Error("Photo trop volumineuse (>1 Mo).");
    return t;
  }),
  commissioningDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  releaseDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createVehicle(formData: FormData) {
  const session = await requirePermission("fleet.manage");
  const data = VehicleSchema.parse(Object.fromEntries(formData));
  const v = await prisma.vehicle.create({ data });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "Vehicle", entityId: v.id,
    message: `Véhicule ajouté : ${v.plate} · ${v.brand} ${v.model} (${v.category})`
  });
  revalidatePath("/fleet");
  return { ok: true, id: v.id };
}

export async function updateVehicle(id: string, formData: FormData) {
  const session = await requirePermission("fleet.manage");
  const data = VehicleSchema.parse(Object.fromEntries(formData));
  await prisma.vehicle.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "Vehicle", entityId: id,
    message: `Véhicule mis à jour : ${data.plate}`
  });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${id}`);
  return { ok: true };
}

export async function deleteVehicle(id: string) {
  const session = await requirePermission("fleet.manage");
  // Cascade : le contrat leasing et les attributions sont supprimés.
  // On enlève aussi la RecurringExpense associée si présente.
  const contract = await prisma.leasingContract.findUnique({ where: { vehicleId: id } });
  if (contract?.recurringExpenseId) {
    await prisma.recurringExpense.delete({ where: { id: contract.recurringExpenseId } }).catch(() => {});
  }
  const v = await prisma.vehicle.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "Vehicle", entityId: id,
    message: `Véhicule supprimé : ${v.plate}`
  });
  revalidatePath("/fleet");
  return { ok: true };
}

/// ----------- LeasingContract avec sync cashflow -----------

const ContractSchema = z.object({
  vehicleId: z.string().min(1),
  lessor: z.string().min(1),
  contractRef: z.string().optional().nullable().transform((v) => v?.trim() || null),
  startDate: z.string(),
  endDate: z.string(),
  monthlyAmount: z.coerce.number().positive(),
  kmIncludedYear: z.coerce.number().int().nonnegative().optional().nullable(),
  cashflowCategory: z.string().optional().nullable().transform((v) => v?.trim() || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

/**
 * Crée ou met à jour le contrat leasing d'un véhicule + synchronise la
 * ligne RecurringExpense correspondante dans le cashflow.
 */
export async function upsertLeasingContract(formData: FormData) {
  const session = await requirePermission("fleet.manage");
  const data = ContractSchema.parse(Object.fromEntries(formData));
  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: { id: data.vehicleId }, select: { id: true, plate: true, brand: true, model: true }
  });
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("Date de fin avant date de début.");

  const existing = await prisma.leasingContract.findUnique({
    where: { vehicleId: data.vehicleId }
  });

  const recurringLabel = `Leasing ${vehicle.plate} · ${data.lessor}`;
  // Catégorie cashflow : celle fournie par le user (ex: "voiture") sinon défaut
  const cashflowCat = data.cashflowCategory || DEFAULT_LEASING_CATEGORY;

  // Étape 1 : upsert la RecurringExpense dans le cashflow
  let recurringExpenseId = existing?.recurringExpenseId ?? null;
  if (recurringExpenseId) {
    await prisma.recurringExpense.update({
      where: { id: recurringExpenseId },
      data: {
        label: recurringLabel,
        category: cashflowCat,
        defaultAmount: data.monthlyAmount,
        startDate: start,
        endDate: end,
        isActive: true
      }
    });
  } else {
    const re = await prisma.recurringExpense.create({
      data: {
        label: recurringLabel,
        category: cashflowCat,
        defaultAmount: data.monthlyAmount,
        isIncome: false,
        frequency: "MONTHLY",
        startDate: start,
        endDate: end,
        isActive: true,
        createdById: session.user.id,
        notes: `Auto-généré depuis le contrat leasing du véhicule ${vehicle.plate}`
      }
    });
    recurringExpenseId = re.id;
  }

  // Étape 2 : upsert le LeasingContract avec le lien vers la RecurringExpense
  const contract = existing
    ? await prisma.leasingContract.update({
        where: { vehicleId: data.vehicleId },
        data: { ...data, startDate: start, endDate: end, recurringExpenseId, monthlyAmount: data.monthlyAmount }
      })
    : await prisma.leasingContract.create({
        data: { ...data, startDate: start, endDate: end, recurringExpenseId, monthlyAmount: data.monthlyAmount }
      });

  await logActivity({
    actorId: session.user.id, action: existing ? "UPDATE" : "CREATE",
    entityType: "LeasingContract", entityId: contract.id,
    message: `Contrat leasing ${vehicle.plate} : ${data.monthlyAmount}€/mois · ${data.lessor} · sync cashflow OK`
  });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${data.vehicleId}`);
  revalidatePath("/cashflow");
  return { ok: true };
}

export async function deleteLeasingContract(vehicleId: string) {
  const session = await requirePermission("fleet.manage");
  const existing = await prisma.leasingContract.findUnique({ where: { vehicleId } });
  if (!existing) throw new Error("Pas de contrat leasing.");
  if (existing.recurringExpenseId) {
    await prisma.recurringExpense.delete({ where: { id: existing.recurringExpenseId } }).catch(() => {});
  }
  await prisma.leasingContract.delete({ where: { vehicleId } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "LeasingContract", entityId: existing.id,
    message: `Contrat leasing supprimé (véhicule ${vehicleId}) + ligne cashflow retirée`
  });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  revalidatePath("/cashflow");
  return { ok: true };
}

/// ----------- VehicleAssignment -----------

const AssignSchema = z.object({
  vehicleId: z.string().min(1),
  userId: z.string().min(1),
  startDate: z.string(),
  startKm: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

/**
 * Attribue un véhicule à un utilisateur. Ferme automatiquement
 * l'attribution active précédente (s'il y en a une) à la veille de startDate.
 *
 * Deux règles métier :
 *   1. Un utilisateur ne peut avoir qu'UN seul véhicule attribué à la fois.
 *      Si le user a déjà une attribution active sur un autre véhicule, on
 *      refuse. Il faut d'abord clôturer l'ancienne (rendre le véhicule).
 *   2. La date d'attribution ne peut pas être antérieure à la date de départ
 *      du contrat leasing (si LEASING) ou date de mise en service (si OWNED).
 *      Impossible d'attribuer une voiture qu'on n'a pas encore reçue.
 */
export async function assignVehicle(formData: FormData) {
  const session = await requirePermission("fleet.manage");
  const data = AssignSchema.parse(Object.fromEntries(formData));
  const start = new Date(data.startDate);

  // Charge le véhicule + son contrat pour valider les dates
  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: { id: data.vehicleId },
    include: { leasingContract: { select: { startDate: true } } }
  });

  // Règle 2 : date d'attribution ≥ début du contrat / mise en service
  const earliest = vehicle.leasingContract?.startDate ?? vehicle.commissioningDate;
  if (earliest && start < earliest) {
    const dateStr = earliest.toISOString().slice(0, 10);
    throw new Error(
      vehicle.leasingContract
        ? `Date d'attribution trop tôt : le contrat leasing commence le ${dateStr}.`
        : `Date d'attribution trop tôt : le véhicule a été mis en service le ${dateStr}.`
    );
  }

  // Règle 1 : le user ne peut pas déjà avoir un autre véhicule attribué
  const existingUserAssignment = await prisma.vehicleAssignment.findFirst({
    where: {
      userId: data.userId,
      endDate: null,
      vehicleId: { not: data.vehicleId }
    },
    include: { vehicle: { select: { plate: true, brand: true, model: true } } }
  });
  if (existingUserAssignment) {
    const v = existingUserAssignment.vehicle;
    throw new Error(
      `Ce collaborateur a déjà un véhicule attribué : ${v.plate} (${v.brand} ${v.model}). ` +
      `Clôture d'abord son attribution actuelle avant de lui en donner un autre.`
    );
  }

  // Ferme l'attribution en cours SUR CE VÉHICULE (endDate = NULL) le jour d'avant
  const previousDay = new Date(start);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  await prisma.vehicleAssignment.updateMany({
    where: { vehicleId: data.vehicleId, endDate: null },
    data: { endDate: previousDay }
  });

  const a = await prisma.vehicleAssignment.create({
    data: {
      vehicleId: data.vehicleId,
      userId: data.userId,
      startDate: start,
      startKm: data.startKm ?? null,
      notes: data.notes
    }
  });
  const user = await prisma.user.findUnique({ where: { id: data.userId }, select: { firstName: true, lastName: true } });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "VehicleAssignment", entityId: a.id,
    message: `Véhicule attribué à ${user?.firstName} ${user?.lastName} depuis le ${data.startDate}`
  });
  revalidatePath(`/fleet/${data.vehicleId}`);
  revalidatePath("/fleet");
  return { ok: true };
}

/**
 * Termine l'attribution active (met endDate = aujourd'hui ou date fournie).
 */
export async function unassignVehicle(vehicleId: string, endDateStr?: string, endKm?: number) {
  const session = await requirePermission("fleet.manage");
  const end = endDateStr ? new Date(endDateStr) : new Date();
  const updated = await prisma.vehicleAssignment.updateMany({
    where: { vehicleId, endDate: null },
    data: { endDate: end, endKm: endKm ?? null }
  });
  if (updated.count === 0) throw new Error("Pas d'attribution active à clôturer.");
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "VehicleAssignment", entityId: vehicleId,
    message: `Attribution clôturée au ${end.toISOString().slice(0, 10)}`
  });
  revalidatePath(`/fleet/${vehicleId}`);
  revalidatePath("/fleet");
  return { ok: true };
}
