import { describe, it, expect } from "vitest";
import { computeOfferLineTotals, aggregateOfferTotals, computeProjectMargin, buildReference, validateMilestonesTotal } from "@/lib/calc";

describe("computeOfferLineTotals", () => {
  it("calcule total vente avec remise", () => {
    const t = computeOfferLineTotals({ quantity: 10, unitSellPrice: 100, unitCost: 60, discountPct: 10 });
    expect(t.totalSell).toBe(900);
    expect(t.totalCost).toBe(600);
    expect(t.marginAmount).toBe(300);
    // marge % = 300 / 900 * 100 = 33.333
    expect(t.marginPct).toBeCloseTo(33.333, 2);
  });

  it("gère totalSell = 0 sans division par zéro", () => {
    const t = computeOfferLineTotals({ quantity: 0, unitSellPrice: 100, unitCost: 50, discountPct: 0 });
    expect(t.totalSell).toBe(0);
    expect(t.marginPct).toBe(0);
  });

  it("accepte des strings (saisie formulaire)", () => {
    const t = computeOfferLineTotals({ quantity: "5", unitSellPrice: "200", unitCost: "100", discountPct: "0" });
    expect(t.totalSell).toBe(1000);
    expect(t.marginAmount).toBe(500);
  });

  it("remise 100% donne 0", () => {
    const t = computeOfferLineTotals({ quantity: 1, unitSellPrice: 500, unitCost: 0, discountPct: 100 });
    expect(t.totalSell).toBe(0);
    expect(t.marginAmount).toBe(0);
  });
});

describe("aggregateOfferTotals", () => {
  it("agrège plusieurs lignes correctement", () => {
    const lines = [
      { totalSell: 1000, totalCost: 600, marginAmount: 400, marginPct: 40 },
      { totalSell: 2000, totalCost: 1500, marginAmount: 500, marginPct: 25 }
    ];
    const t = aggregateOfferTotals(lines);
    expect(t.totalSell).toBe(3000);
    expect(t.totalCost).toBe(2100);
    expect(t.marginAmount).toBe(900);
    expect(t.marginPct).toBeCloseTo(30, 2);
  });

  it("retourne 0% si rien", () => {
    const t = aggregateOfferTotals([]);
    expect(t.totalSell).toBe(0);
    expect(t.marginPct).toBe(0);
  });
});

describe("computeProjectMargin", () => {
  it("marge réelle = budget - coût temps - coût achats", () => {
    const m = computeProjectMargin({ budgetSell: 50000, actualTimeCost: 18000, actualPurchaseCost: 4000 });
    expect(m.marginActual).toBe(28000);
    expect(m.marginPct).toBeCloseTo(56, 2);
  });

  it("peut être négative en dépassement", () => {
    const m = computeProjectMargin({ budgetSell: 10000, actualTimeCost: 12000, actualPurchaseCost: 1500 });
    expect(m.marginActual).toBe(-3500);
  });
});

describe("OfferLine — mode marge directe (OTHER)", () => {
  it("calcule le coût à partir de la marge%", () => {
    // Vente HT = 10 × 100 × (1 - 0%) = 1000
    // Coût = 1000 × (1 - 30%) = 700
    // Marge € = 300, marge% = 30
    const t = computeOfferLineTotals({ quantity: 10, unitSellPrice: 100, unitCost: 0, discountPct: 0, marginPctInput: 30 });
    expect(t.totalSell).toBe(1000);
    expect(t.totalCost).toBe(700);
    expect(t.marginAmount).toBe(300);
    expect(t.marginPct).toBeCloseTo(30, 2);
  });

  it("ignore unitCost si marginPctInput présent", () => {
    const t = computeOfferLineTotals({ quantity: 1, unitSellPrice: 1000, unitCost: 999, discountPct: 0, marginPctInput: 50 });
    expect(t.totalCost).toBe(500); // 1000 × (1 - 50%)
  });
});

describe("validateMilestonesTotal", () => {
  it("valide pile 100%", () => {
    const v = validateMilestonesTotal([3000, 4000, 3000], 10000);
    expect(v.ok).toBe(true);
    expect(v.pct).toBeCloseTo(100, 1);
  });
  it("détecte un manque", () => {
    const v = validateMilestonesTotal([3000, 4000], 10000);
    expect(v.ok).toBe(false);
    expect(v.delta).toBe(-3000);
  });
  it("détecte un excès", () => {
    const v = validateMilestonesTotal([3000, 4000, 4000], 10000);
    expect(v.ok).toBe(false);
    expect(v.delta).toBe(1000);
  });
  it("tolère 1 cent de différence (arrondis)", () => {
    const v = validateMilestonesTotal([33.33, 33.33, 33.34], 100);
    expect(v.ok).toBe(true);
  });
});

describe("buildReference", () => {
  it("formate avec padding 4 chiffres", () => {
    expect(buildReference("OFF", 2026, 1)).toBe("OFF-2026-0001");
    expect(buildReference("PRJ", 2026, 137)).toBe("PRJ-2026-0137");
    expect(buildReference("OFF", 2026, 9999)).toBe("OFF-2026-9999");
  });
});
