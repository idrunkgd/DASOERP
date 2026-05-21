// Helper TVA trimestrielle belge — Dasolabs ERP
// Agrège les ventes (BillingMilestone) et achats (Purchase) sur un trimestre,
// puis remplit les cases principales de la déclaration TVA belge.

import { prisma } from "@/lib/db";

export type Quarter = 1 | 2 | 3 | 4;

export interface VatPeriod {
  year: number;
  quarter: Quarter;
  startDate: Date;
  endDate: Date;
}

export interface VatGrid {
  // Cases « grille de la déclaration »
  // (https://finances.belgium.be/fr/entreprises/tva/declaration/declaration-periodique)
  case00: number; // Opérations exonérées (non utilisé ici, à 0)
  case01: number; // Opérations à 6% (HTVA)
  case02: number; // Opérations à 12% (HTVA)
  case03: number; // Opérations à 21% (HTVA) — la plupart des prestations IT
  case44: number; // Services intracom (B2B) — info
  case45: number; // Cocontractant (info)
  case46: number; // Livraisons intracom (info)
  case47: number; // Autres opérations exonérées (info)
  case48: number; // Notes de crédit sur ventes (info)
  case49: number; // Régul ventes (info)
  // Achats / TVA déductible
  case81: number; // Biens et services (HTVA)
  case82: number; // Services divers (HTVA)
  case83: number; // Biens d'investissement (HTVA)
  case85: number; // Notes de crédit sur achats (info)
  case86: number; // Achats intracom (info)
  case87: number; // Cocontractant achats (info)
  // TVA due / déductible / solde
  case54: number; // TVA due sur opérations (à 6% / 12% / 21%)
  case55: number; // TVA due cocontractant (info)
  case56: number; // TVA due acquisitions intracom (info)
  case57: number; // TVA due importations (info)
  case59: number; // TVA déductible
  case61: number; // Régularisations en faveur Etat (info)
  case62: number; // Régularisations en faveur du déclarant (info)
  // Soldes
  case71: number; // Solde à payer à l'Etat (positif)
  case72: number; // Solde à récupérer / reporter (positif)
}

export interface VatLine {
  date: Date;
  label: string;
  company: string | null;
  amountHt: number;
  vatAmount: number;
  vatRate: number;
  /// Statut original (PLANNED, READY, TRANSMITTED, PAID pour milestones
  /// ou PLANNED, ORDERED, RECEIVED, PAID pour purchases)
  status: string;
  // Provenance pour traçabilité
  source: "milestone" | "purchase";
  id: string;
}

export interface VatReport {
  period: VatPeriod;
  grid: VatGrid;
  salesLines: VatLine[];
  purchasesLines: VatLine[];
  // Compteurs lisibles
  totalSalesHt: number;
  totalSalesVat: number;
  totalPurchasesHt: number;
  totalPurchasesVat: number;
  netDueOrCredit: number; // positif = à payer, négatif = crédit
}

const VAT_DEFAULT = 21;

export function getQuarter(date: Date): Quarter {
  const m = date.getUTCMonth(); // 0..11
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

// Récupère le taux de TVA d'une mission via raw SQL (le champ existe en base
// même si Prisma ne l'a pas dans le type, pour rester compatible avec les
// montages historiques où vatRate a été ajouté à la main).
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

/**
 * Agrège les ventes (BillingMilestone) du trimestre.
 *
 * VISION PRÉVISIONNELLE : on prend toutes les tranches NON annulées
 * (PLANNED + READY + TRANSMITTED + PAID), filtrées sur expectedAt.
 * Permet d'anticiper la TVA à payer même sur les factures pas encore émises.
 *
 * (En Belgique, la TVA est due à l'émission de la facture, pas à
 * l'encaissement, pour les prestations B2B.)
 */
export async function computeVatReport(year: number, quarter: Quarter): Promise<VatReport> {
  const period = periodForQuarter(year, quarter);

  // SALES — toutes les tranches non annulées dont l'émission tombe dans la période
  const milestones = await prisma.billingMilestone.findMany({
    where: {
      status: { not: "CANCELLED" },
      expectedAt: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true,
      label: true,
      amount: true,
      expectedAt: true,
      paidAt: true,
      status: true,
      missionId: true,
      mission: { select: { id: true, company: { select: { name: true } } } },
      offer: { select: { company: { select: { name: true } } } },
      project: { select: { company: { select: { name: true } } } },
      company: { select: { name: true } }
    }
  });

  // PURCHASES — toutes hors CANCELLED sur la période
  const purchases = await prisma.purchase.findMany({
    where: {
      status: { not: "CANCELLED" },
      purchaseDate: { gte: period.startDate, lte: period.endDate }
    },
    select: {
      id: true,
      description: true,
      amount: true,
      category: true,
      purchaseDate: true,
      status: true,
      supplier: { select: { name: true } }
    }
  });

  const missionVatRates = await getMissionVatRateMap(
    Array.from(new Set(milestones.map((m) => m.missionId).filter((x): x is string => !!x)))
  );

  // Construire les lignes de vente
  const salesLines: VatLine[] = milestones.map((m) => {
    const rate = m.missionId ? missionVatRates[m.missionId] ?? VAT_DEFAULT : VAT_DEFAULT;
    const ht = Number(m.amount);
    const vat = (ht * rate) / 100;
    const company =
      m.mission?.company?.name ??
      m.offer?.company?.name ??
      m.project?.company?.name ??
      m.company?.name ??
      null;
    return {
      date: m.expectedAt ?? m.paidAt ?? period.startDate,
      label: m.label,
      company,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      status: m.status,
      source: "milestone" as const,
      id: m.id
    };
  });

  // Construire les lignes d'achat — on suppose TVA 21% par défaut sur biens & services.
  // (À terme, on pourrait stocker vatRate sur Purchase.)
  const purchasesLines: VatLine[] = purchases.map((p) => {
    const rate = VAT_DEFAULT;
    const ht = Number(p.amount);
    const vat = (ht * rate) / 100;
    return {
      date: p.purchaseDate,
      label: p.description,
      company: p.supplier?.name ?? null,
      amountHt: ht,
      vatAmount: vat,
      vatRate: rate,
      status: p.status,
      source: "purchase" as const,
      id: p.id
    };
  });

  // Calcul de la grille
  const grid: VatGrid = {
    case00: 0,
    case01: 0,
    case02: 0,
    case03: 0,
    case44: 0,
    case45: 0,
    case46: 0,
    case47: 0,
    case48: 0,
    case49: 0,
    case81: 0,
    case82: 0,
    case83: 0,
    case85: 0,
    case86: 0,
    case87: 0,
    case54: 0,
    case55: 0,
    case56: 0,
    case57: 0,
    case59: 0,
    case61: 0,
    case62: 0,
    case71: 0,
    case72: 0
  };

  // SALES → cases 01/02/03 (par taux) + case 54 (TVA due)
  for (const l of salesLines) {
    if (l.vatRate === 6) grid.case01 += l.amountHt;
    else if (l.vatRate === 12) grid.case02 += l.amountHt;
    else if (l.vatRate === 21) grid.case03 += l.amountHt;
    else if (l.vatRate === 0) grid.case47 += l.amountHt;
    else grid.case03 += l.amountHt; // fallback
    grid.case54 += l.vatAmount;
  }

  // PURCHASES → case 81 (biens & services) + case 59 (TVA déductible)
  // Pour l'instant on met tout en 81 — on pourrait splitter par category plus tard.
  for (const l of purchasesLines) {
    grid.case81 += l.amountHt;
    grid.case59 += l.vatAmount;
  }

  // Solde net
  const due = grid.case54 + grid.case55 + grid.case56 + grid.case57 + grid.case61;
  const ded = grid.case59 + grid.case62;
  const net = due - ded;
  if (net >= 0) {
    grid.case71 = net;
    grid.case72 = 0;
  } else {
    grid.case71 = 0;
    grid.case72 = Math.abs(net);
  }

  const totalSalesHt = salesLines.reduce((s, l) => s + l.amountHt, 0);
  const totalSalesVat = salesLines.reduce((s, l) => s + l.vatAmount, 0);
  const totalPurchasesHt = purchasesLines.reduce((s, l) => s + l.amountHt, 0);
  const totalPurchasesVat = purchasesLines.reduce((s, l) => s + l.vatAmount, 0);

  return {
    period,
    grid,
    salesLines: salesLines.sort((a, b) => a.date.getTime() - b.date.getTime()),
    purchasesLines: purchasesLines.sort((a, b) => a.date.getTime() - b.date.getTime()),
    totalSalesHt,
    totalSalesVat,
    totalPurchasesHt,
    totalPurchasesVat,
    netDueOrCredit: net
  };
}
