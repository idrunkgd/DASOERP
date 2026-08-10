import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { ReviewsPanel } from "./reviews-panel";
import { ClientInterviewsPanel, type AppWithInterviews } from "../../candidates/[id]/client-interviews-panel";
import { SubjectContractsPanel } from "@/components/contracts/subject-contracts-panel";
import { ResetPasswordButton } from "./reset-password-button";
import { UserExperiencesPanel } from "../../me/user-experiences-panel";
import { userPlannedHoursForWeek } from "@/server/services/load-service";
import { redirect } from "next/navigation";
import { FileDown, Eye } from "lucide-react";
import { PersonTabsNav, type PersonTab } from "@/components/ui/person-tabs-nav";

type UserTab = "general" | "cv" | "missions" | "rh" | "contracts";

export default async function UserDetail({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const session = await requireSession();
  const tab: UserTab = (["general", "cv", "missions", "rh", "contracts"].includes(searchParams.tab ?? "")
    ? searchParams.tab
    : "general") as UserTab;
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

  // Reviews + projets disponibles + catalogue compétences + présentations client + contrats
  const [reviews, projects, skillCatalog, applications, contracts, contractTemplates] = await Promise.all([
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
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    // Missions sur lesquelles ce consultant a été présenté (comme User) — avec
    // tous ses entretiens client (1 par tour du process client).
    prisma.missionApplication.findMany({
      where: { consultantId: user.id },
      include: {
        missionRequest: { include: { company: { select: { name: true } } } },
        interviews: { orderBy: { scheduledAt: "asc" } }
      },
      orderBy: { presentedAt: "desc" }
    }),
    prisma.contract.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, title: true, status: true, startDate: true, endDate: true }
    }),
    prisma.contractTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  const canManageReviews = isAdmin || isManager;
  const canManageContracts = perms.includes("contracts.manage");
  const canReadContracts = perms.includes("contracts.read");
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
      {/* Onglets */}
      {(() => {
        const USER_TABS: PersonTab[] = [
          { key: "general",   label: "Général",  icon: "user" },
          { key: "cv",        label: "CV",       icon: "file",
            badge: user.experiences.length || undefined },
          { key: "missions",  label: "Missions", icon: "briefcase",
            badge: applications.length || undefined },
          { key: "rh",        label: "RH",       icon: "check",
            badge: reviews.length || undefined },
          { key: "contracts", label: "Contrats", icon: "contract",
            badge: contracts.length || undefined }
        ];
        return <PersonTabsNav tabs={USER_TABS} current={tab} />;
      })()}

      <div className="space-y-6">
        {tab === "general" && (
          <>
            {isAdmin && (
              <div className="flex justify-end">
                <ResetPasswordButton userId={user.id} />
              </div>
            )}
            {isAdmin && <UserForm initial={user} skillCatalog={skillCatalog} />}
            {!isAdmin && (
              <div className="card p-6 text-sm text-midnight-500 italic">
                Édition du profil réservée aux administrateurs.
              </div>
            )}
          </>
        )}

        {tab === "cv" && (
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
        )}

        {tab === "missions" && (
          <ClientInterviewsPanel
            applications={applications.map<AppWithInterviews>((a) => ({
              applicationId: a.id,
              missionRequestId: a.missionRequest.id,
              missionRef: a.missionRequest.reference,
              missionTitle: a.missionRequest.title,
              companyName: a.missionRequest.company.name,
              status: a.status,
              interviews: a.interviews.map((iv) => ({
                id: iv.id,
                scheduledAt: iv.scheduledAt,
                kind: iv.kind,
                interviewers: iv.interviewers,
                location: iv.location,
                feedback: iv.feedback,
                outcome: iv.outcome
              }))
            }))}
          />
        )}

        {tab === "rh" && (
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
        )}

        {tab === "contracts" && canReadContracts && (
          <SubjectContractsPanel
            contracts={contracts}
            templates={contractTemplates}
            subject={{ kind: "user", id: user.id, label: `${user.firstName} ${user.lastName}` }}
            canManage={canManageContracts}
          />
        )}
        {tab === "contracts" && !canReadContracts && (
          <div className="card p-6 text-sm text-midnight-500 italic">
            Tu n'as pas la permission pour voir les contrats.
          </div>
        )}
      </div>
    </div>
  );
}
