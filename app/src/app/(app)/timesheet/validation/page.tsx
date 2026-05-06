import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ValidationList } from "./validation-list";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ValidationPage() {
  await requirePermission("timesheet.validate");
  const entries = await prisma.timesheetEntry.findMany({
    where: { status: "SUBMITTED" },
    include: { user: true, project: true },
    orderBy: [{ user: { lastName: "asc" } }, { date: "asc" }]
  });
  return (
    <div>
      <PageHeader title="Timesheets à valider" subtitle={`${entries.length} entrée(s) en attente`} />
      <ValidationList entries={entries.map(e => ({
        id: e.id, hours: Number(e.hours), date: format(e.date, "yyyy-MM-dd"),
        activityType: e.activityType, description: e.description,
        userName: `${e.user.firstName} ${e.user.lastName}`,
        projectRef: e.project.reference, projectName: e.project.name
      }))} />
    </div>
  );
}
