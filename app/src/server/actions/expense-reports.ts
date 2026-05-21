"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { callLlmWithMedia, extractJson } from "@/lib/llm";

const TVA_DEFAULT = 21;

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum([
    "TRANSPORT",
    "MEAL",
    "ACCOMMODATION",
    "SUPPLIES",
    "SOFTWARE",
    "TRAINING",
    "OTHER"
  ]),
  description: z.string().min(1).max(500),
  amountHt: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().min(0).max(50).default(TVA_DEFAULT),
  missionId: z.string().optional().nullable().transform((v) => v || null),
  projectId: z.string().optional().nullable().transform((v) => v || null),
  receiptUrl: z.string().optional().nullable().transform((v) => v || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function createExpenseReport(formData: FormData) {
  const session = await requireSession();
  const data = Schema.parse(Object.fromEntries(formData));
  const vatAmount = (data.amountHt * data.vatRate) / 100;
  const amountTtc = data.amountHt + vatAmount;

  const created = await prisma.expenseReport.create({
    data: {
      userId: session.user.id,
      missionId: data.missionId,
      projectId: data.projectId,
      date: new Date(data.date),
      category: data.category,
      description: data.description,
      amountHt: data.amountHt,
      vatAmount,
      vatRate: data.vatRate,
      amountTtc,
      receiptUrl: data.receiptUrl,
      notes: data.notes,
      status: "DRAFT"
    }
  });

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "ExpenseReport",
    entityId: created.id,
    message: `Note de frais « ${data.description} » créée (${amountTtc.toFixed(2)} € TTC)`
  });
  revalidatePath("/test/expenses");
  return { id: created.id };
}

export async function submitExpenseReport(id: string) {
  const session = await requireSession();
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");
  // Seul l'auteur peut soumettre
  if (report.userId !== session.user.id) throw new Error("Forbidden");
  if (report.status !== "DRAFT") throw new Error("Note déjà soumise");
  await prisma.expenseReport.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "ExpenseReport",
    entityId: id,
    message: "Note de frais soumise"
  });
  revalidatePath("/test/expenses");
}

export async function approveExpenseReport(id: string, approve: boolean, rejectionReason?: string) {
  const session = await requireSession();
  if (!["ADMIN", "MANAGER", "FINANCE"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");
  if (report.status !== "SUBMITTED") throw new Error("La note doit être SUBMITTED");
  await prisma.expenseReport.update({
    where: { id },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      approvedById: session.user.id,
      approvedAt: new Date(),
      rejectionReason: approve ? null : (rejectionReason ?? "Non précisé")
    }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "ExpenseReport",
    entityId: id,
    message: approve ? "Note approuvée" : `Note refusée (${rejectionReason ?? "n/a"})`
  });
  revalidatePath("/test/expenses");
}

export async function markExpensePaid(id: string) {
  const session = await requireSession();
  if (!["ADMIN", "FINANCE"].includes(session.user.role)) throw new Error("Forbidden");
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");
  if (report.status !== "APPROVED") throw new Error("La note doit être APPROVED");
  await prisma.expenseReport.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "ExpenseReport",
    entityId: id,
    message: "Note remboursée"
  });
  revalidatePath("/test/expenses");
}

export async function deleteExpenseReport(id: string) {
  const session = await requireSession();
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");
  const isOwner = report.userId === session.user.id;
  const isAdmin = ["ADMIN", "FINANCE"].includes(session.user.role);
  if (!isOwner && !isAdmin) throw new Error("Forbidden");
  if (report.status !== "DRAFT" && !isAdmin) {
    throw new Error("Note déjà soumise — suppression réservée aux admin");
  }
  await prisma.expenseReport.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "ExpenseReport",
    entityId: id,
    message: `Note de frais supprimée`
  });
  revalidatePath("/test/expenses");
}

/**
 * OCR via Claude API.
 * Reçoit une image en base64 (data URI ou raw b64) et renvoie les champs extraits :
 *   { date, amountTtc, amountHt, vatRate, vatAmount, vendor, description }
 *
 * Utilise ANTHROPIC_API_KEY si présent ; sinon retourne null (le user remplit
 * à la main). Aucune dépendance npm — fetch() direct.
 */
const OcrResponseSchema = z.object({
  date: z.string().nullable(),
  amountTtc: z.number().nullable(),
  amountHt: z.number().nullable(),
  vatRate: z.number().nullable(),
  vatAmount: z.number().nullable(),
  vendor: z.string().nullable(),
  description: z.string().nullable(),
  category: z
    .enum([
      "TRANSPORT",
      "MEAL",
      "ACCOMMODATION",
      "SUPPLIES",
      "SOFTWARE",
      "TRAINING",
      "OTHER"
    ])
    .nullable()
});

export async function ocrReceipt(dataUri: string): Promise<{
  ok: boolean;
  error?: string;
  data?: z.infer<typeof OcrResponseSchema>;
  provider?: string;
}> {
  await requireSession();

  const prompt = `Tu analyses un ticket de caisse ou une facture. Extrais ces champs au format JSON strict :
{
  "date": "YYYY-MM-DD ou null",
  "amountTtc": nombre ou null,
  "amountHt": nombre ou null,
  "vatRate": nombre (6, 12 ou 21 en Belgique) ou null,
  "vatAmount": nombre ou null,
  "vendor": "nom du commerçant ou null",
  "description": "courte description (ex: 'Repas restaurant Bxl')",
  "category": "TRANSPORT|MEAL|ACCOMMODATION|SUPPLIES|SOFTWARE|TRAINING|OTHER"
}
Réponds UNIQUEMENT le JSON, rien d'autre.`;

  const result = await callLlmWithMedia({
    prompt,
    dataUri,
    task: "ocr",
    maxTokens: 500
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsedRaw = JSON.parse(extractJson(result.text));
    const parsed = OcrResponseSchema.safeParse(parsedRaw);
    if (!parsed.success) {
      return { ok: false, error: `${result.provider} : structure inattendue` };
    }
    return { ok: true, data: parsed.data, provider: result.provider };
  } catch {
    return { ok: false, error: `${result.provider} : JSON invalide` };
  }
}
