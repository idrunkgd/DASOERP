import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET() {
  await requirePermission("contacts.read");
  const rows = await prisma.contact.findMany({ include: { company: true }, orderBy: [{ lastName: "asc" }] });
  const csv = toCSV(rows.map(c => ({
    firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
    jobTitle: c.jobTitle, status: c.status, company: c.company?.name ?? "", tags: c.tags.join("|")
  })));
  return csvResponse(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
