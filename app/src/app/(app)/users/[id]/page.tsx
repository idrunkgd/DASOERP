import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { ReviewsPanel } from "./reviews-panel";
import { userPlannedHoursForWeek } from "@/server/services/load-service";
import { redirect } from "next/navigation";

export default async function UserDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  // Vérification basée sur les permissions effectives (groupe + overrides), pas sur le rôle.
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isSelf = session.user.id === params.id;
  const isAdmin = perms.includes("users.manage");
  const isManager = perms.includes("timesheet.validate");
  if (!isAdmin && !isSelf && !isManager) redirect("/dashboard");

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  const planned = await userPlannedHoursForWeek(user.id, new Date());

  // Reviews + projets disponibles + catalogue compétences
  const [reviews, projects, skillCatalog] = await Promise.all([
    prisma.consultantReview.findMany({
      where: { subjectId: user.id },
      include: { conductedBy: true, project: true },
      orderBy: { scheduledAt: "desc" }
    }),
    prisma.project.findMany({
      where: { status: { in: ["TO_START","ACTIVE","ON_HOLD","COMPLETED"] } },
      orderBy: { reference: "desc" },
      select: { id: true, reference: true, name: true }
    }),
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] })
  ]);

  const canManageReviews = isAdmin || isManager;
  const showPrivateNotes = canManageReviews && !isSelf || isAdmin;

  return (
    <div>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        breadcrumb={[{ label: "Utilisateurs", href: "/users" }, { label: `${user.firstName} ${user.lastName}` }]}
        subtitle={`Charge planifiée semaine en cours : ${planned.toFixed(1)}h / ${Number(user.weeklyCapacityH).toFixed(0)}h`}
      />
      <div className="space-y-6">
        {isAdmin && <UserForm initial={user} skillCatalog={skillCatalog} />}

        <ReviewsPanel
          userId={user.id}
          reviews={reviews.map(r => ({
            id: r.id,
            scheduledAt: r.scheduledAt.toISOString(),
            kind: r.kind,
            outcome: r.outcome,
            feedback: r.feedback,
            privateNotes: r.privateNotes,
            goals: r.goals,
            projectId: r.projectId,
            project: r.project ? { id: r.project.id, reference: r.project.reference, name: r.project.name } : null,
            conductedBy: r.conductedBy ? { firstName: r.conductedBy.firstName, lastName: r.conductedBy.lastName } : null
          }))}
          projects={projects}
          canManage={canManageReviews}
          showPrivate={showPrivateNotes}
        />
      </div>
    </div>
  );
}
