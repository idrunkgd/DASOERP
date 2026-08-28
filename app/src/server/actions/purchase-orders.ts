"use server";
/**
 * Bons de commande fournisseur (PurchaseOrder).
 *
 * Workflow :
 *   1. Admin/manager crée un PO en DRAFT avec des lignes (label, qty, prix)
 *   2. Bouton "Envoyer par email" → marque SENT + snapshot totaux + ouvre
 *      un mailto: pré-rempli côté client avec le lien vers le PDF.
 *   3. Fournisseur confirme → ACKNOWLEDGED (manuel via bouton admin)
 *   4. Marchandise reçue → RECEIVED
 *
 * Rationale : pas de SMTP configuré dans l'app, on passe par le client
 * mail natif de l'user (mailto). Il attache lui-même le PDF téléchargé.
 * Fiable, aucune infra à gérer, respect RGPD (aucun mail transactionnel
 * qui traite des données côté serveur).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nextPurchaseOrderReference } from "@/lib/references";

// ═════════════ SCHEMAS ═════════════

const LineSchema = z.object({
  label: z.string().min(1).max(300),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null),
  quantity: z.coerce.number().min(0).max(9999999),
  unit: z.string().optional().nullable().transform((v) => v?.trim() || null),
  unitPriceHt: z.coerce.number().min(0),
  vatRate: z.coerce.number().min(0).max(100).default(21)
});

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  projectId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable().optional()),
  supplierId: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable().optional()),
  supplierName: z.string().optional().nullable().transform((v) => v?.trim() || null),
  contactName: z.string().optional().nullable().transform((v) => v?.trim() || null),
  contactEmail: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  deliveryAddress: z.string().optional().nullable().transform((v) => v?.trim() || null),
  deliveryDate: z.preprocess((v) => (v === "" || v == null ? null : new Date(String(v))), z.date().nullable().optional()),
  paymentTerms: z.string().optional().nullable().transform((v) => v?.trim() || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null),
  currency: z.string().default("EUR"),
  lines: z.array(LineSchema).min(1, "Au moins une ligne est requise.")
});

function computeTotals(lines: z.infer<typeof LineSchema>[]) {
  let ht = 0, vat = 0;
  const rows = lines.map((l) => {
    const totalHt = Number((l.quantity * l.unitPriceHt).toFixed(2));
    ht += totalHt;
    vat += Number(((totalHt * l.vatRate) / 100).toFixed(2));
    return { ...l, totalHt };
  });
  return { rows, totalHt: Number(ht.toFixed(2)), totalVat: Number(vat.toFixed(2)), totalTtc: Number((ht + vat).toFixed(2)) };
}

// ═════════════ CREATE ═════════════

/**
 * Crée un bon de commande. Le formulaire client envoie les lignes en JSON
 * dans le champ "lines" (stringifié) — plus simple qu'un multipart complexe.
 */
export async function createPurchaseOrder(formData: FormData) {
  const session = await requirePermission("purchases.write");

  let linesJson: any[] = [];
  const raw = formData.get("lines");
  if (typeof raw === "string" && raw) {
    try { linesJson = JSON.parse(raw); } catch { throw new Error("Format des lignes invalide."); }
  }

  const parsed = CreateSchema.parse({
    ...Object.fromEntries(formData),
    lines: linesJson
  });

  const { rows, totalHt, totalVat, totalTtc } = computeTotals(parsed.lines);
  const reference = await nextPurchaseOrderReference();

  const po = await prisma.purchaseOrder.create({
    data: {
      reference,
      title: parsed.title,
      status: "DRAFT",
      supplierId: parsed.supplierId ?? null,
      projectId: parsed.projectId ?? null,
      supplierName: parsed.supplierName,
      contactName: parsed.contactName,
      contactEmail: parsed.contactEmail,
      deliveryAddress: parsed.deliveryAddress,
      deliveryDate: parsed.deliveryDate ?? null,
      paymentTerms: parsed.paymentTerms,
      notes: parsed.notes,
      currency: parsed.currency,
      totalHt, totalVat, totalTtc,
      createdById: session.user.id,
      lines: {
        create: rows.map((r, i) => ({
          position: i,
          label: r.label,
          description: r.description,
          quantity: r.quantity,
          unit: r.unit,
          unitPriceHt: r.unitPriceHt,
          vatRate: r.vatRate,
          totalHt: r.totalHt
        }))
      }
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "PurchaseOrder",
    entityId: po.id,
    message: `PO ${po.reference} créé — ${totalTtc.toFixed(2)} € TTC`
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${po.id}`);
}

// ═════════════ UPDATE ═════════════

export async function updatePurchaseOrder(id: string, formData: FormData) {
  const session = await requirePermission("purchases.write");

  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) throw new Error("PO introuvable.");
  if (existing.status !== "DRAFT") {
    throw new Error(`Ce PO est en statut ${existing.status} — seuls les brouillons sont modifiables.`);
  }

  let linesJson: any[] = [];
  const raw = formData.get("lines");
  if (typeof raw === "string" && raw) {
    try { linesJson = JSON.parse(raw); } catch { throw new Error("Format des lignes invalide."); }
  }

  const parsed = CreateSchema.parse({
    ...Object.fromEntries(formData),
    lines: linesJson
  });
  const { rows, totalHt, totalVat, totalTtc } = computeTotals(parsed.lines);

  await prisma.$transaction([
    prisma.purchaseOrderLine.deleteMany({ where: { orderId: id } }),
    prisma.purchaseOrder.update({
      where: { id },
      data: {
        title: parsed.title,
        supplierId: parsed.supplierId ?? null,
        supplierName: parsed.supplierName,
        contactName: parsed.contactName,
        contactEmail: parsed.contactEmail,
        deliveryAddress: parsed.deliveryAddress,
        deliveryDate: parsed.deliveryDate ?? null,
        paymentTerms: parsed.paymentTerms,
        notes: parsed.notes,
        currency: parsed.currency,
        totalHt, totalVat, totalTtc,
        lines: {
          create: rows.map((r, i) => ({
            position: i,
            label: r.label,
            description: r.description,
            quantity: r.quantity,
            unit: r.unit,
            unitPriceHt: r.unitPriceHt,
            vatRate: r.vatRate,
            totalHt: r.totalHt
          }))
        }
      }
    })
  ]);

  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "PurchaseOrder",
    entityId: id,
    message: `PO ${existing.reference} modifié`
  });

  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { ok: true };
}

// ═════════════ DELETE ═════════════

export async function deletePurchaseOrder(id: string) {
  const session = await requirePermission("purchases.write");
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return { ok: true };
  if (po.status !== "DRAFT" && po.status !== "CANCELLED") {
    throw new Error("Impossible de supprimer un PO envoyé. Annule-le d'abord.");
  }
  await prisma.purchaseOrder.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "PurchaseOrder",
    entityId: id,
    message: `PO ${po.reference} supprimé`
  });
  revalidatePath("/purchase-orders");
  return { ok: true };
}

// ═════════════ WORKFLOW ═════════════

/**
 * Marque le PO comme envoyé. À appeler depuis le client juste avant d'ouvrir
 * le mailto — ainsi le statut est cohérent même si l'user ne finalise pas
 * l'envoi mail (l'action est réversible en repassant en DRAFT).
 */
export async function markPoSent(id: string) {
  const session = await requirePermission("purchases.write");
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new Error("PO introuvable.");
  if (po.status === "SENT") return { ok: true, alreadySent: true };
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), sentById: session.user.id }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "PurchaseOrder",
    entityId: id,
    message: `PO ${po.reference} envoyé au fournisseur`
  });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { ok: true };
}

const StatusChangeSchema = z.enum(["ACKNOWLEDGED", "RECEIVED", "CANCELLED", "DRAFT"]);

export async function changePoStatus(id: string, status: string, reason?: string) {
  const session = await requirePermission("purchases.write");
  const target = StatusChangeSchema.parse(status);
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new Error("PO introuvable.");

  const data: any = { status: target };
  if (target === "ACKNOWLEDGED") data.acknowledgedAt = new Date();
  if (target === "RECEIVED") data.receivedAt = new Date();
  if (target === "CANCELLED") { data.cancelledAt = new Date(); data.cancelledReason = reason ?? null; }
  if (target === "DRAFT") { data.sentAt = null; data.sentById = null; data.acknowledgedAt = null; data.receivedAt = null; data.cancelledAt = null; }

  await prisma.purchaseOrder.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "PurchaseOrder",
    entityId: id,
    message: `PO ${po.reference} → ${target}${reason ? ` (${reason})` : ""}`
  });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { ok: true };
}
