"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { callLlmWithMedia, extractJson } from "@/lib/llm";

// ─────────────────────────────────────────────────────────────
// OCR PARSING
// ─────────────────────────────────────────────────────────────

const OcrSchema = z.object({
  supplierName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(), // YYYY-MM-DD
  dueDate: z.string().nullable(),
  amountHt: z.number().nullable(),
  vatRate: z.number().nullable(),
  vatAmount: z.number().nullable(),
  amountTtc: z.number().nullable(),
  currency: z.string().nullable()
});

export type ParsedSupplierInvoice = z.infer<typeof OcrSchema>;

/**
 * Parse une facture fournisseur (PDF ou image) via OCR Gemini.
 * Renvoie { supplierName, invoiceNumber, dates, montants, taux TVA, currency }.
 */
export async function parseSupplierInvoice(dataUri: string): Promise<{
  ok: boolean;
  error?: string;
  data?: ParsedSupplierInvoice;
  provider?: string;
}> {
  await requireSession();

  const prompt = `Tu analyses une facture fournisseur belge ou européenne (probablement en français, néerlandais ou anglais). Extrais les informations au format JSON strict :
{
  "supplierName": "nom du fournisseur (émetteur de la facture) ou null",
  "invoiceNumber": "numéro de facture ou null",
  "invoiceDate": "date d'émission YYYY-MM-DD ou null",
  "dueDate": "date d'échéance YYYY-MM-DD ou null",
  "amountHt": nombre HTVA (sans TVA) ou null,
  "vatRate": taux TVA en % (6, 12 ou 21 en Belgique) ou null,
  "vatAmount": montant TVA ou null,
  "amountTtc": nombre TTC (avec TVA) ou null,
  "currency": "EUR par défaut, sinon code ISO (USD, GBP...)"
}
Règles :
- Si tu vois "Total HT 100 € / TVA 21 € / Total TTC 121 €" → amountHt=100, vatRate=21, vatAmount=21, amountTtc=121
- Si seul le TTC est visible : essaie de déduire HTVA et TVA depuis le taux mentionné
- Pour des factures multi-lignes, donne les totaux globaux
- Réponds UNIQUEMENT le JSON, rien d'autre.`;

  const result = await callLlmWithMedia({
    prompt,
    dataUri,
    task: "cv", // utilise le modèle de qualité (Sonnet/Gemini) car structures plus complexes que les tickets
    maxTokens: 1000
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const raw = JSON.parse(extractJson(result.text));
    const parsed = OcrSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: `${result.provider} : structure inattendue` };
    }
    return { ok: true, data: parsed.data, provider: result.provider };
  } catch {
    return { ok: false, error: `${result.provider} : JSON invalide` };
  }
}

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  supplierName: z.string().min(1).max(200),
  /// Optionnel : id Company existant (matching auto)
  supplierCompanyId: z.string().optional().nullable().transform((v) => v || null),
  invoiceNumber: z.string().optional().nullable().transform((v) => v?.trim() || null),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  amountHt: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().min(0).max(50).default(21),
  /// Si fourni, override le calcul. Sinon on calcule (amountHt × vatRate / 100).
  vatAmount: z.coerce.number().optional().nullable(),
  /// Si fourni, override. Sinon amountHt + vatAmount.
  amountTtc: z.coerce.number().optional().nullable(),
  currency: z.string().default("EUR"),
  pdfUrl: z.string().optional().nullable().transform((v) => v || null),
  ocrPayload: z.string().optional().nullable(),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null),
  source: z.enum(["manual", "email", "api"]).default("manual")
});

export async function createSupplierInvoice(formData: FormData) {
  const session = await requireSession();
  const raw = Object.fromEntries(formData);
  const data = CreateSchema.parse(raw);

  // Si aucun supplierCompanyId fourni, on tente un match fuzzy par nom
  let companyId = data.supplierCompanyId;
  if (!companyId && data.supplierName) {
    const found = await prisma.company.findFirst({
      where: {
        name: { contains: data.supplierName, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (found) companyId = found.id;
  }

  const vatAmount = data.vatAmount ?? (data.amountHt * data.vatRate) / 100;
  const amountTtc = data.amountTtc ?? data.amountHt + vatAmount;

  const created = await prisma.supplierInvoice.create({
    data: {
      supplierName: data.supplierName,
      supplierCompanyId: companyId,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      amountHt: data.amountHt,
      vatRate: data.vatRate,
      vatAmount,
      amountTtc,
      currency: data.currency,
      pdfUrl: data.pdfUrl,
      ocrPayload: data.ocrPayload ? (JSON.parse(data.ocrPayload) as any) : undefined,
      status: "PENDING",
      source: data.source,
      notes: data.notes,
      createdById: session.user.id
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "SupplierInvoice",
    entityId: created.id,
    message: `Facture fournisseur « ${data.supplierName} ${data.invoiceNumber ?? ""} » créée (${amountTtc.toFixed(2)} € TTC)`
  });
  revalidatePath("/test/supplier-invoices");
  return { id: created.id };
}

export async function markSupplierInvoicePaid(id: string) {
  const session = await requireSession();
  if (!["ADMIN", "FINANCE", "MANAGER"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  const inv = await prisma.supplierInvoice.findUnique({ where: { id } });
  if (!inv) throw new Error("Facture introuvable");
  await prisma.supplierInvoice.update({
    where: { id },
    data: {
      status: inv.status === "PAID" ? "PENDING" : "PAID",
      paidAt: inv.status === "PAID" ? null : new Date()
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "SupplierInvoice",
    entityId: id,
    message: inv.status === "PAID" ? "Facture marquée non payée" : "Facture marquée payée"
  });
  revalidatePath("/test/supplier-invoices");
  revalidatePath("/cashflow");
}

export async function deleteSupplierInvoice(id: string) {
  const session = await requireSession();
  if (!["ADMIN", "FINANCE", "MANAGER"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  await prisma.supplierInvoice.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "SupplierInvoice",
    entityId: id,
    message: "Facture fournisseur supprimée"
  });
  revalidatePath("/test/supplier-invoices");
}

export async function updateSupplierInvoiceStatus(
  id: string,
  status: "DRAFT" | "PENDING" | "PAID" | "DISPUTED" | "CANCELLED"
) {
  const session = await requireSession();
  if (!["ADMIN", "FINANCE", "MANAGER"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  await prisma.supplierInvoice.update({
    where: { id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "SupplierInvoice",
    entityId: id,
    message: `Statut changé : ${status}`
  });
  revalidatePath("/test/supplier-invoices");
}
