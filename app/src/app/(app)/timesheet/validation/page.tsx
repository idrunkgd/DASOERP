import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ValidationList } from "./validation-list";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ValidationPage() {
  await requirePermission("timesheet.validate");
  // Une entrée timesheet peut cibler un projet, une mission OU un centre de coût.
  // On inclut les 3 pour pouvoir afficher la référence et le nom dans n'importe
  // quel cas.
  const entries = await prisma.timesheetEntry.findMany({
    where: { status: "SUBMITTED" },
    include: { user: true, project: true, mission: true, costCenter: true },
    orderBy: [{ user: { lastName: "asc" } }, { date: "asc" }]
  });
  return (
    <div>
      <PageHeader title="Timesheets à valider" subtitle={`${entries.length} entrée(s) en attente`} />
      <ValidationList entries={entries.map(e => {
        // On choisit la cible disponible : projet d'abord, sinon mission, sinon
        // centre de coût. Si tout est null (cas dégénéré), on affiche "—".
        const target = e.project
          ? { ref: e.project.reference, name: e.project.name }
          : e.mission
            ? { ref: e.mission.reference, name: e.mission.title }
            : e.costCenter
              ? { ref: e.costCenter.code, name: e.costCenter.name }
              : { ref: "—", name: "Sans cible" };
        return {
          id: e.id, hours: Number(e.hours), date: format(e.date, "yyyy-MM-dd"),
          activityType: e.activityType, description: e.description,
          userName: `${e.user.firstName} ${e.user.lastName}`,
          projectRef: target.ref, projectName: target.name
        };
      })} />
    </div>
  );
}
