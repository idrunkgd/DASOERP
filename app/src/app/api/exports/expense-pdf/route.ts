/**
 * Export PDF d'une note de frais pour envoi au comptable.
 * GET /api/exports/expense-pdf?id=<expenseReportId>[&inline=1]
 *
 * L'auteur peut toujours télécharger sa propre note ; un tiers doit avoir
 * expenses.approve (les managers/finance qui gèrent la centralisation).
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { ExpensePdf, type ExpensePdfData } from "@/lib/expense-pdf-template";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const report = await prisma.expenseReport.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
      mission: { select: { reference: true, title: true } },
      project: { select: { reference: true, name: true } },
      costCenter: { select: { code: true, name: true } }
    }
  });
  if (!report) return new Response("Not found", { status: 404 });

  const isOwner = report.userId === session.user.id;
  if (!isOwner) {
    const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
    if (!perms.includes("expenses.approve")) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const data: ExpensePdfData = {
    id: report.id,
    date: report.date.toISOString(),
    category: report.category,
    description: report.description,
    amountHt: Number(report.amountHt),
    vatAmount: Number(report.vatAmount),
    vatRate: Number(report.vatRate),
    amountTtc: Number(report.amountTtc),
    status: report.status,
    authorName: `${report.user.firstName} ${report.user.lastName}`.trim(),
    missionRef: report.mission
      ? `${report.mission.reference} — ${report.mission.title}`
      : null,
    projectRef: report.project
      ? `${report.project.reference} — ${report.project.name}`
      : null,
    costCenterRef: report.costCenter
      ? `${report.costCenter.code} — ${report.costCenter.name}`
      : null,
    attendees: Array.isArray(report.attendees)
      ? (report.attendees as any[]).map((a) => ({
          name: String(a?.name ?? ""),
          isInternal: !!a?.userId
        })).filter((a) => a.name)
      : null,
    approvedByName: report.approvedBy
      ? `${report.approvedBy.firstName} ${report.approvedBy.lastName}`.trim()
      : null,
    approvedAt: report.approvedAt?.toISOString() ?? null,
    paidAt: report.paidAt?.toISOString() ?? null,
    receiptDataUri: report.receiptUrl,
    notes: report.notes
  };

  try {
    const buffer = await renderToBuffer(React.createElement(ExpensePdf, { data }));
    const u8 = new Uint8Array(buffer);
    const filename = `Note-de-frais-${report.id.slice(-8).toUpperCase()}.pdf`;
    return new Response(u8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(u8.length),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e: any) {
    console.error("Expense PDF failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
