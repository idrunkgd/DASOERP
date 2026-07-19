"use server";
/**
 * Server actions bancaires : création de connexion GoCardless, callback
 * OAuth, synchronisation des transactions, rapprochement manuel avec
 * ajustement optionnel du cashflow.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import {
  createRequisition, getRequisition, getAccountDetails,
  getAccountTransactions, transactionDedupeId
} from "@/lib/gocardless";

/**
 * Démarre le flow d'autorisation pour une nouvelle banque.
 * Renvoie l'URL vers laquelle rediriger l'utilisateur (portail ING pour
 * s'identifier et donner son consentement PSD2).
 */
export async function startBankAuthorization(opts: {
  institutionId: string;      // ex. "ING_BBRUBEBB"
  institutionName: string;    // ex. "ING"
}): Promise<{ authorizationUrl: string; connectionId: string }> {
  const session = await requirePermission("finance.write");
  // Crée d'abord la BankConnection côté nous, puis la requisition GoCardless
  // en passant son ID en reference — permet de retrouver la connexion au
  // callback même sans state OAuth explicite.
  const connection = await prisma.bankConnection.create({
    data: {
      institutionId: opts.institutionId,
      institutionName: opts.institutionName,
      requisitionId: "pending",
      status: "PENDING",
      createdById: session.user.id
    }
  });
  const redirectUri =
    process.env.GOCARDLESS_REDIRECT_URI ??
    "http://localhost:3000/api/bank/callback";
  const req = await createRequisition({
    institutionId: opts.institutionId,
    redirectUri,
    reference: connection.id
  });
  await prisma.bankConnection.update({
    where: { id: connection.id },
    data: { requisitionId: req.id, authorizationUrl: req.link }
  });
  return { authorizationUrl: req.link, connectionId: connection.id };
}

/**
 * Callback appelé après que l'utilisateur ait donné son consentement.
 * Récupère la requisition, ses account_ids, et crée les BankAccount
 * correspondants avec leurs détails (IBAN, etc.).
 */
export async function finalizeBankAuthorization(connectionId: string) {
  const session = await requirePermission("finance.write");
  const connection = await prisma.bankConnection.findUniqueOrThrow({
    where: { id: connectionId }
  });
  if (connection.requisitionId === "pending") {
    throw new Error("Cette connexion n'a jamais atteint GoCardless.");
  }
  const req = await getRequisition(connection.requisitionId);
  // Selon status GoCardless, on met la connexion LINKED ou ERROR
  const status = req.status === "LN" ? "LINKED" : req.status === "EX" ? "EXPIRED" : "PENDING";
  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { status: status as any }
  });
  if (status !== "LINKED") return { linked: false };

  // Crée les BankAccount pour chaque account_id renvoyé
  for (const accountId of req.accounts) {
    const existing = await prisma.bankAccount.findUnique({ where: { accountId } });
    if (existing) continue;
    let details: any = {};
    try {
      const d = await getAccountDetails(accountId);
      details = d.account ?? {};
    } catch (e) {
      // Certaines banques ne renvoient pas de détails — on laisse vide
    }
    await prisma.bankAccount.create({
      data: {
        connectionId,
        accountId,
        iban: details.iban ?? null,
        currency: details.currency ?? "EUR",
        name: details.name ?? details.product ?? null,
        ownerName: details.ownerName ?? null
      }
    });
  }
  revalidatePath("/finance/bank");
  return { linked: true, accountCount: req.accounts.length };
}

/**
 * Rapatrie les transactions d'un compte depuis GoCardless. Dédup sur
 * (accountId, internalTransactionId) — safe à rejouer autant qu'on veut.
 */
export async function syncBankAccountTransactions(bankAccountId: string): Promise<{
  imported: number; skipped: number;
}> {
  await requirePermission("finance.write");
  const account = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    include: { connection: true }
  });
  let imported = 0;
  let skipped = 0;
  try {
    const txs = await getAccountTransactions(account.accountId);
    for (const tx of txs) {
      const dedupeId = transactionDedupeId(tx);
      const amount = Number(tx.transactionAmount.amount);   // signé : négatif = débit
      const counterpartyName = amount < 0
        ? tx.creditorName ?? null       // débit → on paye qqun
        : tx.debtorName ?? null;         // crédit → on reçoit de qqun
      const counterpartyIban = amount < 0
        ? tx.creditorAccount?.iban ?? null
        : tx.debtorAccount?.iban ?? null;
      const remittance =
        tx.remittanceInformationUnstructured ??
        tx.remittanceInformationUnstructuredArray?.join(" ") ??
        null;
      try {
        await prisma.bankTransaction.create({
          data: {
            accountId: account.id,
            internalTransactionId: dedupeId,
            bookingDate: new Date(tx.bookingDate),
            valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
            amount,
            currency: tx.transactionAmount.currency,
            counterpartyName,
            counterpartyIban,
            remittanceInfo: remittance
          }
        });
        imported++;
      } catch (e: any) {
        // Unique violation → déjà importée
        if (e?.code === "P2002") { skipped++; continue; }
        throw e;
      }
    }
    await prisma.bankConnection.update({
      where: { id: account.connectionId },
      data: { lastSyncAt: new Date(), lastSyncError: null }
    });
  } catch (e: any) {
    await prisma.bankConnection.update({
      where: { id: account.connectionId },
      data: { lastSyncError: String(e?.message ?? e) }
    });
    throw e;
  }
  revalidatePath("/finance/bank");
  return { imported, skipped };
}

/**
 * Rapproche une transaction bancaire avec une entrée du cashflow.
 * Trois cibles possibles (une seule à la fois) :
 *   - RecurringExpenseMonth : dépense récurrente d'un mois
 *   - OneOffCashflowEntry   : dépense ou recette ponctuelle
 *   - BillingMilestone      : facture client (recette)
 *
 * Si `adjustAmount = true` et que le montant bancaire diffère du prévu,
 * on met à jour l'entrée cible pour refléter la réalité.
 */
export async function reconcileBankTransaction(opts: {
  transactionId: string;
  target:
    | { type: "recurring_month"; id: string }
    | { type: "one_off"; id: string }
    | { type: "milestone"; id: string };
  adjustAmount: boolean;
}): Promise<{ ok: true; adjusted: boolean; newAmount: number | null }> {
  const session = await requirePermission("finance.write");
  const tx = await prisma.bankTransaction.findUniqueOrThrow({
    where: { id: opts.transactionId }
  });
  // Montant absolu (les BillingMilestone et OneOff/Recurring stockent en positif)
  const bankAmount = Math.abs(Number(tx.amount));

  let adjusted = false;
  let newAmount: number | null = null;

  await prisma.$transaction(async (dbtx) => {
    const now = new Date();
    // 1. Update BankTransaction
    const data: any = {
      status: "RECONCILED",
      reconciledAt: now,
      reconciledById: session.user.id,
      matchedRecurringMonthId: null,
      matchedOneOffId: null,
      matchedMilestoneId: null
    };
    if (opts.target.type === "recurring_month") data.matchedRecurringMonthId = opts.target.id;
    if (opts.target.type === "one_off")         data.matchedOneOffId = opts.target.id;
    if (opts.target.type === "milestone")       data.matchedMilestoneId = opts.target.id;
    await dbtx.bankTransaction.update({ where: { id: tx.id }, data });

    // 2. Marque la cible comme payée (statut) + ajuste le montant si demandé
    if (opts.target.type === "recurring_month") {
      const month = await dbtx.recurringExpenseMonth.findUniqueOrThrow({
        where: { id: opts.target.id },
        include: { recurringExpense: { select: { defaultAmount: true } } }
      });
      const current = Number(month.amountOverride ?? month.recurringExpense.defaultAmount);
      const updates: any = { status: "PAID", paidAt: now };
      if (opts.adjustAmount && Math.abs(current - bankAmount) > 0.01) {
        updates.amountOverride = bankAmount;
        adjusted = true;
        newAmount = bankAmount;
      }
      await dbtx.recurringExpenseMonth.update({
        where: { id: opts.target.id }, data: updates
      });
    } else if (opts.target.type === "one_off") {
      const oneoff = await dbtx.oneOffCashflowEntry.findUniqueOrThrow({
        where: { id: opts.target.id }
      });
      const current = Number(oneoff.amount);
      const updates: any = { status: "PAID", paidAt: now };
      if (opts.adjustAmount && Math.abs(current - bankAmount) > 0.01) {
        updates.amount = bankAmount;
        adjusted = true;
        newAmount = bankAmount;
      }
      await dbtx.oneOffCashflowEntry.update({
        where: { id: opts.target.id }, data: updates
      });
    } else {
      // BillingMilestone (recette client) : on marque payé
      const ms = await dbtx.billingMilestone.findUniqueOrThrow({
        where: { id: opts.target.id }
      });
      const currentHt = Number(ms.amount);
      // Note : BankTransaction est en TVAC, milestone en HTVA. On n'ajuste
      // pas automatiquement le HTVA à partir du TVAC (ambiguité TVA). On
      // ne fait que marquer PAID. L'ajustement HTVA reste manuel.
      const updates: any = { status: "PAID", paidAt: now };
      await dbtx.billingMilestone.update({
        where: { id: ms.id }, data: updates
      });
    }
  });

  revalidatePath("/finance/bank");
  revalidatePath("/cashflow");
  return { ok: true, adjusted, newAmount };
}

/**
 * Retire un rapprochement (défait le lien). N'annule PAS le statut PAID
 * de la cible côté cashflow — l'utilisateur peut le faire manuellement.
 */
export async function unreconcileBankTransaction(transactionId: string) {
  await requirePermission("finance.write");
  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      status: "UNRECONCILED",
      matchedRecurringMonthId: null,
      matchedOneOffId: null,
      matchedMilestoneId: null,
      reconciledAt: null,
      reconciledById: null
    }
  });
  revalidatePath("/finance/bank");
  return { ok: true };
}

export async function ignoreBankTransaction(transactionId: string, reason?: string) {
  await requirePermission("finance.write");
  await prisma.bankTransaction.update({
    where: { id: transactionId },
    data: {
      status: "IGNORED",
      notes: reason ?? null
    }
  });
  revalidatePath("/finance/bank");
  return { ok: true };
}
