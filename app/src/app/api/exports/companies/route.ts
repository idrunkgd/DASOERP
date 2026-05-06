import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET() {
  await requirePermission("companies.read");
  const rows = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const csv = toCSV(rows.map(c => ({
    name: c.name, vatNumber: c.vatNumber, status: c.status, sector: c.sector,
    size: c.size, website: c.website, source: c.source,
    street: c.street, postalCode: c.postalCode, city: c.city, country: c.country,
    createdAt: c.createdAt.toISOString().slice(0, 10)
  })));
  return csvResponse(`entreprises-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
