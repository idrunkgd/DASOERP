"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
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
  const session = await requirePermission("expenses.write");
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
  revalidatePath("/expenses");
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
  revalidatePath("/expenses");
}

export async function approveExpenseReport(id: string, approve: boolean, rejectionReason?: string) {
  const session = await requirePermission("expenses.approve");
  const report = await prisma.expenseReport.findUnique({
    where: { id },
    include: { user: { select: { firstName: true, lastName: true } } }
  });
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

  // À l'APPROBATION on planifie automatiquement une sortie de cash dans le
  // cashflow, datée du DERNIER jour du mois de la dépense. Ex : ticket du
  // 15/03 → sortie prévue au 31/03. Idempotent : si une entrée liée existe
  // déjà (ré-approbation après refus), on la met à jour au lieu d'en créer
  // une deuxième. Sur REJECTED on retire l'entrée éventuellement présente.
  if (approve) {
    const d = new Date(report.date);
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const authorName = `${report.user.firstName} ${report.user.lastName}`.trim();
    const label = `${report.description} — ${authorName}`.slice(0, 200);
    await prisma.oneOffCashflowEntry.upsert({
      where: { expenseReportId: id },
      create: {
        label,
        category: "Notes de frais",
        amount: report.amountTtc,
        date: endOfMonth,
        kind: "EXPENSE",
        status: "PLANNED",
        expenseReportId: id,
        createdById: session.user.id
      },
      update: {
        label,
        amount: report.amountTtc,
        date: endOfMonth,
        // Si la note repasse par APPROVED après un cycle, on remet à PLANNED
        // sauf si l'utilisateur avait déjà marqué payé côté cashflow (auquel
        // cas on respecte son marquage manuel).
        // Le status n'est PAS écrasé pour préserver un éventuel PAID manuel.
      }
    });
  } else {
    await prisma.oneOffCashflowEntry.deleteMany({
      where: { expenseReportId: id }
    });
  }

  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "ExpenseReport",
    entityId: id,
    message: approve ? "Note approuvée (+ cashflow planifié)" : `Note refusée (${rejectionReason ?? "n/a"})`
  });
  revalidatePath("/expenses");
  revalidatePath("/cashflow");
}

export async function markExpensePaid(id: string) {
  const session = await requirePermission("finance.write");
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");
  if (report.status !== "APPROVED") throw new Error("La note doit être APPROVED");
  await prisma.expenseReport.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() }
  });
  // Synchronise le cashflow : la sortie planifiée devient PAID pour que
  // le solde bancaire réel se mette à jour et que la ligne verdisse dans
  // le panneau "Ce mois-ci".
  await prisma.oneOffCashflowEntry.updateMany({
    where: { expenseReportId: id },
    data: { status: "PAID", paidAt: new Date() }
  });
  await logActivity({
    actorId: session.user.id,
    action: "STATUS_CHANGE",
    entityType: "ExpenseReport",
    entityId: id,
    message: "Note remboursée (+ cashflow marqué payé)"
  });
  revalidatePath("/expenses");
  revalidatePath("/cashflow");
}

export async function deleteExpenseReport(id: string) {
  const session = await requirePermission("expenses.write");
  const report = await prisma.expenseReport.findUnique({ where: { id } });
  if (!report) throw new Error("Note introuvable");

  // Règles :
  //  - L'auteur peut TOUJOURS supprimer sa propre note (même APPROVED/PAID) :
  //    c'est son tracking perso, à lui de gérer ses erreurs.
  //  - Un tiers doit avoir expenses.approve pour intervenir sur une note qui
  //    n'est pas la sienne (ex: manager qui nettoie une note oubliée).
  const isOwner = report.userId === session.user.id;
  if (!isOwner) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("expenses.approve")) {
      throw new Error("Suppression réservée à l'auteur ou à un approbateur");
    }
  }

  // Nettoyage du OneOffCashflowEntry lié si présent (créé auto au APPROVED).
  // Idempotent : si aucune entrée liée, ne fait rien.
  await prisma.oneOffCashflowEntry.deleteMany({
    where: { expenseReportId: id }
  });

  await prisma.expenseReport.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id,
    action: "DELETE",
    entityType: "ExpenseReport",
    entityId: id,
    message: `Note de frais supprimée`
  });
  revalidatePath("/expenses");
  revalidatePath("/cashflow");
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
