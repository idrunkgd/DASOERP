import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  await requirePermission("finance.read");
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const where: any = {};
  if (status) where.status = status as any;
  const list = await prisma.billingMilestone.findMany({
    where, include: { offer: { include: { company: true } }, project: { include: { company: true } } },
    orderBy: [{ expectedAt: "asc" }]
  });
  const csv = toCSV(list.map(m => {
    const c = m.offer?.company ?? m.project?.company;
    return {
      label: m.label,
      client: c?.name ?? "",
      vatNumber: c?.vatNumber ?? "",
      sourceType: m.offer ? "Offer" : (m.project ? "Project" : ""),
      sourceRef: m.offer?.reference ?? m.project?.reference ?? "",
      amount: Number(m.amount),
      percentage: m.percentage ? Number(m.percentage) : "",
      expectedAt: m.expectedAt?.toISOString().slice(0, 10) ?? "",
      status: m.status,
      trigger: m.trigger ?? "",
      transmittedAt: m.transmittedAt?.toISOString().slice(0, 10) ?? "",
      paidAt: m.paidAt?.toISOString().slice(0, 10) ?? "",
      comment: m.comment ?? ""
    };
  }));
  return csvResponse(`tranches-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
