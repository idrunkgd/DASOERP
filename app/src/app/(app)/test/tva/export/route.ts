import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { computeVatReport, type Quarter } from "@/lib/tva";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!["ADMIN", "MANAGER", "FINANCE"].includes(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year") ?? new Date().getUTCFullYear());
  const quarter = Number(sp.get("quarter") ?? 1) as Quarter;
  const report = await computeVatReport(year, quarter);

  const rows: string[] = [];
  rows.push("Type;Date;Société;Libellé;HTVA;TVA;Taux");
  for (const l of report.salesLines) {
    rows.push(
      [
        "Vente",
        l.date.toISOString().slice(0, 10),
        escapeCsv(l.company ?? ""),
        escapeCsv(l.label),
        l.amountHt.toFixed(2),
        l.vatAmount.toFixed(2),
        `${l.vatRate}%`
      ].join(";")
    );
  }
  for (const l of report.purchasesLines) {
    rows.push(
      [
        "Achat",
        l.date.toISOString().slice(0, 10),
        escapeCsv(l.company ?? ""),
        escapeCsv(l.label),
        l.amountHt.toFixed(2),
        l.vatAmount.toFixed(2),
        `${l.vatRate}%`
      ].join(";")
    );
  }
  const csv = "﻿" + rows.join("\n"); // BOM pour Excel
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tva-${year}-T${quarter}.csv"`
    }
  });
}

function escapeCsv(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
