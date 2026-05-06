// Règles de calcul métier — réutilisées partout (FE et BE)
import { toNumber } from "./utils";

export interface OfferLineInput {
  quantity: number | string;
  unitSellPrice: number | string;
  unitCost: number | string;
  discountPct?: number | string | null;
  // Pour les lignes "OTHER" : si fourni, recalcule unitCost depuis sell × (1 - margin/100)
  marginPctInput?: number | string | null;
}

export interface OfferLineTotals {
  totalSell: number;
  totalCost: number;
  marginAmount: number;
  marginPct: number;
}

/**
 * Calcule les totaux d'une ligne d'offre.
 *
 * Mode 1 — service / coût direct :
 *   totalSell = qty × unitSellPrice × (1 - discount/100)
 *   totalCost = qty × unitCost
 *
 * Mode 2 — marge directe (lignes "OTHER", marginPctInput présent) :
 *   totalSell = qty × unitSellPrice × (1 - discount/100)
 *   totalCost = totalSell × (1 - marginPctInput/100)
 *
 * Dans les deux cas :
 *   margin    = totalSell - totalCost
 *   marginPct = margin / totalSell × 100   (0 si totalSell <= 0)
 */
export function computeOfferLineTotals(line: OfferLineInput): OfferLineTotals {
  const qty = toNumber(line.quantity);
  const sell = toNumber(line.unitSellPrice);
  const cost = toNumber(line.unitCost);
  const disc = toNumber(line.discountPct);
  const totalSell = round2(qty * sell * (1 - disc / 100));
  let totalCost: number;
  if (line.marginPctInput !== undefined && line.marginPctInput !== null && line.marginPctInput !== "") {
    const margin = toNumber(line.marginPctInput);
    totalCost = round2(totalSell * (1 - margin / 100));
  } else {
    totalCost = round2(qty * cost);
  }
  const marginAmount = round2(totalSell - totalCost);
  const marginPct = totalSell > 0 ? round3((marginAmount / totalSell) * 100) : 0;
  return { totalSell, totalCost, marginAmount, marginPct };
}

export interface OfferTotals {
  totalSell: number;
  totalCost: number;
  marginAmount: number;
  marginPct: number;
}

export function aggregateOfferTotals(lines: OfferLineTotals[]): OfferTotals {
  const totalSell = round2(lines.reduce((s, l) => s + l.totalSell, 0));
  const totalCost = round2(lines.reduce((s, l) => s + l.totalCost, 0));
  const marginAmount = round2(totalSell - totalCost);
  const marginPct = totalSell > 0 ? round3((marginAmount / totalSell) * 100) : 0;
  return { totalSell, totalCost, marginAmount, marginPct };
}

export interface ProjectMarginInput {
  budgetSell: number | string;
  actualTimeCost: number | string;
  actualPurchaseCost: number | string;
}

export function computeProjectMargin(p: ProjectMarginInput) {
  const budget = toNumber(p.budgetSell);
  const tcost = toNumber(p.actualTimeCost);
  const pcost = toNumber(p.actualPurchaseCost);
  const marginActual = round2(budget - tcost - pcost);
  const marginPct = budget > 0 ? round3((marginActual / budget) * 100) : 0;
  return { marginActual, marginPct };
}

/** Vérification : la somme des montants des tranches couvre exactement le total HT (tolerance 0.01€). */
export function validateMilestonesTotal(milestoneAmounts: number[], offerTotal: number): { ok: boolean; sum: number; pct: number; delta: number } {
  const sum = round2(milestoneAmounts.reduce((s, a) => s + (a || 0), 0));
  const delta = round2(sum - offerTotal);
  const pct = offerTotal > 0 ? round3((sum / offerTotal) * 100) : 0;
  return { ok: Math.abs(delta) < 0.01, sum, pct, delta };
}

export function round2(n: number): number { return Math.round(n * 100) / 100; }
export function round3(n: number): number { return Math.round(n * 1000) / 1000; }

export function buildReference(prefix: "OFF" | "PRJ", year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}
