"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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
}> {
  await requireSession();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY non configurée" };

  // Extraire le mediaType et le base64
  const match = dataUri.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) return { ok: false, error: "Format d'image non supporté (PNG/JPEG/WebP requis)" };
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const base64 = match[3];

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

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt }
            ]
          }
        ]
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, error: `API Claude : ${resp.status} ${errText.slice(0, 200)}` };
    }
    const json = (await resp.json()) as any;
    const text: string = json?.content?.[0]?.text ?? "";
    // Parser le JSON éventuellement entouré de ```json
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    const parsed = OcrResponseSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      return { ok: false, error: "Réponse Claude non parsable" };
    }
    return { ok: true, data: parsed.data };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}
