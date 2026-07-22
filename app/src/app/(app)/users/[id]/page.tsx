import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { ReviewsPanel } from "./reviews-panel";
import { ResetPasswordButton } from "./reset-password-button";
import { UserExperiencesPanel } from "../../me/user-experiences-panel";
import { userPlannedHoursForWeek } from "@/server/services/load-service";
import { redirect } from "next/navigation";
import { FileDown, Eye } from "lucide-react";

export default async function UserDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  // Vérification basée sur les permissions effectives (groupe + overrides), pas sur le rôle.
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isSelf = session.user.id === params.id;
  const isAdmin = perms.includes("users.manage");
  const isManager = perms.includes("timesheet.validate");
  if (!isAdmin && !isSelf && !isManager) redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { experiences: { orderBy: { startDate: "desc" } } }
  });
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
        actions={
          // Deux boutons : Aperçu (inline=1, ouvre le PDF dans l'onglet)
          // et Exporter (téléchargement direct). Le contrôle strict d'accès
          // est côté route API.
          <>
            <Link
              href={`/api/exports/cv-pdf?userId=${user.id}&inline=1`}
              target="_blank" rel="noopener noreferrer"
              className="btn-ghost btn-sm"
            >
              <Eye className="w-4 h-4" /> Aperçu CV
            </Link>
            <Link
              href={`/api/exports/cv-pdf?userId=${user.id}`}
              className="btn-secondary btn-sm"
            >
              <FileDown className="w-4 h-4" /> Exporter le CV
            </Link>
          </>
        }
      />
      <div className="space-y-6">
        {/* Bouton dédié reset password — isolé du form principal pour rester
            fonctionnel même si le form général plante à cause d'une colonne
            en retard sur la migration DB. */}
        {isAdmin && (
          <div className="flex justify-end">
            <ResetPasswordButton userId={user.id} />
          </div>
        )}
        {isAdmin && <UserForm initial={user} skillCatalog={skillCatalog} />}

        {/* Expériences pro : miroir de la fiche candidat. Éditables par
            soi-même OU un admin/manager (contrôle côté server action).
            Utilisées comme CV sur les propositions consultant PDF. */}
        <UserExperiencesPanel
          userId={user.id}
          experiences={user.experiences.map((e) => ({
            id: e.id,
            companyName: e.companyName,
            jobTitle: e.jobTitle,
            startDate: e.startDate.toISOString(),
            endDate: e.endDate ? e.endDate.toISOString() : null,
            description: e.description
          }))}
        />

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
