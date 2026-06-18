import { prisma } from "@/lib/db";
import { requireSession, ROLE_LABELS, getUserAccessGroupName, DEFAULT_GROUP_NAME, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./profile-form";
import { CandidateCvForm } from "./cv-form";
import { ExperiencesPanel } from "./experiences-panel";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyProfile() {
  const session = await requireSession();
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isAdmin = sessionPerms.includes("users.manage");

  const [me, groupName, skillCatalog, candidateProfile] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    getUserAccessGroupName(session.user.id),
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.candidate.findUnique({
      where: { portalUserId: session.user.id },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    })
  ]);

  const isCandidatePortal = !!candidateProfile;

  return (
    <div>
      <PageHeader
        title={isCandidatePortal ? "Mon CV" : "Mon profil"}
        subtitle={isCandidatePortal
          ? "Complétez votre CV — vos informations sont directement visibles par notre équipe."
          : "Vos informations personnelles et identifiants"}
        actions={
          <a href="/me/tests" className="btn-secondary text-sm">
            🎓 Mes tests techniques
          </a>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <aside className="space-y-4">
          <div className="card p-5 flex flex-col items-center text-center">
            <PersonAvatar firstName={me.firstName} lastName={me.lastName} photoUrl={me.photoUrl} size={140} className="rounded-2xl shadow-card" />
            <h2 className="font-semibold text-midnight-900 mt-3">{me.firstName} {me.lastName}</h2>
            <p className="text-xs text-midnight-500">{me.email}</p>
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Identité Dasolabs</h3>
            {!isCandidatePortal && (
              <div className="flex justify-between"><span className="text-midnight-500">Rôle (fonction)</span><span>{ROLE_LABELS[me.role]}</span></div>
            )}
            <div className="flex justify-between"><span className="text-midnight-500">Groupe d'accès</span><span className={"font-medium " + (groupName === DEFAULT_GROUP_NAME ? "text-amber-700" : "text-indigoaccent")}>{groupName}</span></div>
            {!isCandidatePortal && (
              <div className="flex justify-between"><span className="text-midnight-500">Date d'entrée</span><span>{me.joinedAt ? formatDate(me.joinedAt) : "—"}</span></div>
            )}
            {/* Infos financières visibles uniquement par les admins */}
            {isAdmin && me.dailyCost && <div className="flex justify-between"><span className="text-midnight-500">Taux jour</span><span className="tabular-nums">{formatCurrency(me.dailyCost)}</span></div>}
            {isAdmin && me.weeklyCapacityH && <div className="flex justify-between"><span className="text-midnight-500">Capacité</span><span>{Number(me.weeklyCapacityH).toFixed(0)}h/sem</span></div>}
          </div>

          {!isCandidatePortal && groupName === DEFAULT_GROUP_NAME && (
            <div className="card p-4 text-xs border-amber-200 bg-amber-50/50 text-amber-900">
              <p className="font-medium mb-1">Vous êtes en groupe Visiteur</p>
              <p>Vous n'avez pas encore d'accès aux modules. Contactez un administrateur pour obtenir un groupe d'accès adapté à votre fonction.</p>
            </div>
          )}

          {isCandidatePortal && (
            <div className="card p-4 text-xs border-indigoaccent/30 bg-indigoaccent/5 text-midnight-900">
              <p className="font-medium mb-1">Bienvenue 👋</p>
              <p>Cette page est votre espace personnel. Tout ce que vous renseignez ici nous aide à vous proposer les meilleures missions. Pensez à mettre votre profil à jour régulièrement.</p>
            </div>
          )}
        </aside>

        <div className="lg:col-span-2">
          {isCandidatePortal ? (
            <div className="space-y-6">
              <CandidateCvForm candidateId={candidateProfile.id} initial={candidateProfile as any} skillCatalog={skillCatalog} />
              <ExperiencesPanel
                candidateId={candidateProfile.id}
                experiences={(candidateProfile.experiences ?? []).map(e => ({
                  id: e.id,
                  companyName: e.companyName,
                  jobTitle: e.jobTitle,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate ? e.endDate.toISOString() : null,
                  description: e.description
                }))}
              />
            </div>
          ) : (
            <ProfileForm initial={me as any} skillCatalog={skillCatalog} />
          )}
        </div>
      </div>
    </div>
  );
}
