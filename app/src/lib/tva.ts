// Helper TVA trimestrielle belge — Dasolabs ERP
//
// Agrège :
//   - VENTES : BillingMilestone (ventes prévisionnelles, vision PLANNED + READY
//     + TRANSMITTED + INVOICED + PAID, sauf CANCELLED) → cases 01/02/03 + 54
//   - ACHATS, trois sources cumulées :
//       • SupplierInvoice (factures fournisseurs)
//       • ExpenseReport   (notes de frais consultants, statuts APPROVED + PAID)
//       • Purchase        (achats projet)
//     Avec déduction belge (50 % voitures, 0 % restau/hôtel/représentation/
//     gros cadeaux, 100 % le reste, override possible par ligne) et ventilation
//     en case 81 / 82 / 83 selon la nature.
//
// Avant ce fix :
//   - SupplierInvoice et ExpenseReport étaient complètement ignorés
//   - Purchase utilisait 21 % hardcodé sans champ TVA en base
//   - Tout allait en case 81 même les voitures et investissements
//   - 100 % de déduction sur tout, même restau / voiture → over-déduction

import { prisma } from "@/lib/db";
import {
  SUPPLIER_INVOICE_VAT_RULES,
  EXPENSE_REPORT_VAT_RULES,
  PURCHASE_VAT_RULES,
  effectiveDeductibleRate,
  vatBoxForCategory,
  type VatBox
} from "@/lib/belgian-vat-rules";

export type Quarter = 1 | 2 | 3 | 4;

export interface VatPeriod {
  year: number;
  quarter: Quarter;
  startDate: Date;
  endDate: Date;
}

export interface VatGrid {
  // Ventes
  case00: number; case01: number; case02: number; case03: number;
  case44: number; case45: number; case46: number; case47: number;
  case48: number; case49: number;
  // Achats (HTVA ventilé)
  case81: number; case82: number; case83: number;
  case85: number; case86: number; case87: number;
  // TVA
  case54: number; case55: number; case56: number; case57: number;
  case59: number; case61: number; case62: number;
  case71: number; case72: number;
}

export interface VatLine {
  date: Date;
  label: string;
  company: string | null;
  amountHt: number;
  vatAmount: number;
  vatRate: number;
  /// Taux effectif de déduction (0 à 1) — pour les achats. 1 par défaut pour ventes.
  deductibleRate: number;
  /// TVA effectivement déductible = vatAmount × deductibleRate (achats uniquement).
  deductibleVat: number;
  /// Case de la grille où l'HTVA est imputé (81/82/83 pour achats, 01/02/03/47 pour ventes).
  vatBox: VatBox | number;
  /// Catégorie originale (pour traçabilité).
  category: string | null;
  status: string;
  source: "milestone" | "purchase" | "supplier_invoice" | "expense_report";
  id: string;
}

export interface VatReport {
  period: VatPeriod;
  grid: VatGrid;
  salesLines: VatLine[];
  purchasesLines: VatLine[];
  totalSalesHt: number;
  totalSalesVat: number;
  totalPurchasesHt: number;
  totalPurchasesVat: number;
  /// TVA effectivement déductible (après application des taux de déduction).
  totalDeductibleVat: number;
  netDueOrCredit: number;
}

const VAT_DEFAULT = 21;

export function getQuarter(date: Date): Quarter {
  const m = date.getUTCMonth();
  if (m <= 2) return 1;
  if (m <= 5) return 2;
  if (m <= 8) return 3;
  return 4;
}

export function periodForQuarter(year: number, quarter: Quarter): VatPeriod {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const startDate = new Date(Date.UTC(year, startMonth, 1));
  const endDate = new Date(Date.UTC(year, endMonth + 1, 0, 23, 59, 59, 999));
  return { year, quarter, startDate, endDate };
}

async function getMissionVatRateMap(missionIds: string[]): Promise<Record<string, number>> {
  if (missionIds.length === 0) return {};
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; vatRate: number | null }[]>(
      `SELECT id, "vatRate" FROM "Mission" WHERE id IN (${missionIds.map((_, i) => `$${i + 1}`).join(",")})`,
      ...missionIds
    );
    const m: Record<string, number> = {};
    for (const r of rows) {
      const v = Number(r.vatRate);
      m[r.id] = Number.isFinite(v) && v > 0 ? v : VAT_DEFAULT;
    }
    return m;
  } catch {
    return {};
  }
}

export async function computeVatReport(year: number, quarter: Quarter): Promise<VatReport> {
  const period = periodForQuarter(year, quarter);

  // ─── VENTES ──────────────────────────────────────────────────────────────
  const milestones = await prisma.billingMilestone.findMany({
    where: {
      status: { not: "CANCELLED" },
      expectedAt: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true, label: true, amount: true, expectedAt: true, paidAt: true,
      status: true, missionId: true,
      mission: { select: { id: true, company: { select: { name: true } } } },
      offer: { select: { company: { select: { name: true } } } },
      project: { select: { company: { select: { name: true } } } },
      company: { select: { name: true } }
    }
  });

  const missionVatRates = await getMissionVatRateMap(
    Array.from(new Set(milestones.map((m) => m.missionId).filter((x): x is string => !!x)))
  );

  const salesLines: VatLine[] = milestones.map((m) => {
    const rate = m.missionId ? missionVatRates[m.missionId] ?? VAT_DEFAULT : VAT_DEFAULT;
    const ht = Number(m.amount);
    const vat = (ht * rate) / 100;
    const company =
      m.mission?.company?.name ??
      m.offer?.company?.name ??
      m.project?.company?.name ??
      m.company?.name ?? null;
    const box = rate === 6 ? 1 : rate === 12 ? 2 : rate === 0 ? 47 : 3;
    return {
      date: m.expectedAt ?? m.paidAt ?? period.startDate,
      label: m.label,
      company,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      deductibleRate: 1,
      deductibleVat: 0,
      vatBox: box,
      category: null,
      status: m.status,
      source: "milestone" as const,
      id: m.id
    };
  });

  // ─── ACHATS — source 1 : Purchase (achats projet) ───────────────────────
  const purchases = await prisma.purchase.findMany({
    where: {
      status: { not: "CANCELLED" },
      purchaseDate: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true, description: true, amount: true, category: true,
      vatRate: true, vatAmount: true, vatDeductibleRateOverride: true,
      purchaseDate: true, status: true,
      supplier: { select: { name: true } }
    }
  });

  const purchaseLines: VatLine[] = purchases.map((p) => {
    const ht = Number(p.amount);
    const rate = Number(p.vatRate);
    // Fallback : si vatAmount n'a pas encore été recalculé après la migration,
    // on calcule à la volée.
    const vat = Number(p.vatAmount) || (ht * rate) / 100;
    const override = p.vatDeductibleRateOverride !== null ? Number(p.vatDeductibleRateOverride) : null;
    const dRate = effectiveDeductibleRate(PURCHASE_VAT_RULES, p.category, override);
    const box = vatBoxForCategory(PURCHASE_VAT_RULES, p.category);
    return {
      date: p.purchaseDate,
      label: p.description,
      company: p.supplier?.name ?? null,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      deductibleRate: dRate,
      deductibleVat: vat * dRate,
      vatBox: box,
      category: p.category,
      status: p.status,
      source: "purchase" as const,
      id: p.id
    };
  });

  // ─── ACHATS — source 2 : SupplierInvoice (factures fournisseurs) ─────────
  // On exclut DRAFT (pas encore validé) et CANCELLED.
  const supplierInvoices = await prisma.supplierInvoice.findMany({
    where: {
      status: { notIn: ["DRAFT", "CANCELLED"] },
      invoiceDate: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true, supplierName: true, invoiceDate: true,
      amountHt: true, vatRate: true, vatAmount: true,
      category: true, vatDeductibleRateOverride: true,
      status: true, invoiceNumber: true,
      supplierCompany: { select: { name: true } }
    }
  });

  const supplierInvoiceLines: VatLine[] = supplierInvoices.map((s) => {
    const ht = Number(s.amountHt);
    const vat = Number(s.vatAmount);
    const rate = Number(s.vatRate);
    const override = s.vatDeductibleRateOverride !== null ? Number(s.vatDeductibleRateOverride) : null;
    const dRate = effectiveDeductibleRate(SUPPLIER_INVOICE_VAT_RULES, s.category, override);
    const box = vatBoxForCategory(SUPPLIER_INVOICE_VAT_RULES, s.category);
    const label = s.invoiceNumber ? `${s.invoiceNumber} — ${s.supplierName}` : s.supplierName;
    return {
      date: s.invoiceDate,
      label,
      company: s.supplierCompany?.name ?? s.supplierName,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      deductibleRate: dRate,
      deductibleVat: vat * dRate,
      vatBox: box,
      category: s.category,
      status: s.status,
      source: "supplier_invoice" as const,
      id: s.id
    };
  });

  // ─── ACHATS — source 3 : ExpenseReport (notes de frais consultants) ─────
  // On ne compte que APPROVED + PAID (DRAFT / SUBMITTED / REJECTED exclus).
  const expenses = await prisma.expenseReport.findMany({
    where: {
      status: { in: ["APPROVED", "PAID"] },
      date: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true, description: true, date: true,
      amountHt: true, vatRate: true, vatAmount: true,
      category: true, vatDeductibleRateOverride: true,
      status: true,
      user: { select: { firstName: true, lastName: true } }
    }
  });

  const expenseLines: VatLine[] = expenses.map((e) => {
    const ht = Number(e.amountHt);
    const vat = Number(e.vatAmount);
    const rate = Number(e.vatRate);
    const override = e.vatDeductibleRateOverride !== null ? Number(e.vatDeductibleRateOverride) : null;
    const dRate = effectiveDeductibleRate(EXPENSE_REPORT_VAT_RULES, e.category, override);
    const box = vatBoxForCategory(EXPENSE_REPORT_VAT_RULES, e.category);
    const author = `${e.user.firstName} ${e.user.lastName}`;
    return {
      date: e.date,
      label: e.description,
      company: author,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      deductibleRate: dRate,
      deductibleVat: vat * dRate,
      vatBox: box,
      category: e.category,
      status: e.status,
      source: "expense_report" as const,
      id: e.id
    };
  });

  const purchasesLines = [...purchaseLines, ...supplierInvoiceLines, ...expenseLines];

  // ─── Calcul de la grille ─────────────────────────────────────────────────
  const grid: VatGrid = {
    case00: 0, case01: 0, case02: 0, case03: 0,
    case44: 0, case45: 0, case46: 0, case47: 0, case48: 0, case49: 0,
    case81: 0, case82: 0, case83: 0,
    case85: 0, case86: 0, case87: 0,
    case54: 0, case55: 0, case56: 0, case57: 0,
    case59: 0, case61: 0, case62: 0, case71: 0, case72: 0
  };

  // VENTES → cases 01/02/03/47 + case 54 (TVA due)
  for (const l of salesLines) {
    if (l.vatBox === 1) grid.case01 += l.amountHt;
    else if (l.vatBox === 2) grid.case02 += l.amountHt;
    else if (l.vatBox === 3) grid.case03 += l.amountHt;
    else if (l.vatBox === 47) grid.case47 += l.amountHt;
    else grid.case03 += l.amountHt;
    grid.case54 += l.vatAmount;
  }

  // ACHATS → cases 81/82/83 (HTVA) + case 59 (TVA effectivement déductible)
  for (const l of purchasesLines) {
    if (l.vatBox === 81) grid.case81 += l.amountHt;
    else if (l.vatBox === 82) grid.case82 += l.amountHt;
    else if (l.vatBox === 83) grid.case83 += l.amountHt;
    else grid.case82 += l.amountHt; // fallback
    grid.case59 += l.deductibleVat;
  }

  // Solde
  const due = grid.case54 + grid.case55 + grid.case56 + grid.case57 + grid.case61;
  const ded = grid.case59 + grid.case62;
  const net = due - ded;
  if (net >= 0) { grid.case71 = net; grid.case72 = 0; }
  else { grid.case71 = 0; grid.case72 = Math.abs(net); }

  const totalSalesHt = salesLines.reduce((s, l) => s + l.amountHt, 0);
  const totalSalesVat = salesLines.reduce((s, l) => s + l.vatAmount, 0);
  const totalPurchasesHt = purchasesLines.reduce((s, l) => s + l.amountHt, 0);
  const totalPurchasesVat = purchasesLines.reduce((s, l) => s + l.vatAmount, 0);
  const totalDeductibleVat = purchasesLines.reduce((s, l) => s + l.deductibleVat, 0);

  return {
    period, grid,
    salesLines: salesLines.sort((a, b) => a.date.getTime() - b.date.getTime()),
    purchasesLines: purchasesLines.sort((a, b) => a.date.getTime() - b.date.getTime()),
    totalSalesHt, totalSalesVat, totalPurchasesHt, totalPurchasesVat,
    totalDeductibleVat,
    netDueOrCredit: net
  };
}
