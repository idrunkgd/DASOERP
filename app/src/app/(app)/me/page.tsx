import { prisma } from "@/lib/db";
import { requireSession, ROLE_LABELS, getUserAccessGroupName, DEFAULT_GROUP_NAME, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./profile-form";
import { CandidateCvForm } from "./cv-form";
import { ExperiencesPanel } from "./experiences-panel";
import { UserExperiencesPanel } from "./user-experiences-panel";
import { SickLeaveBlock } from "./sick-leave-form";
import { FileDown, Eye } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyProfile() {
  const session = await requireSession();
  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isAdmin = sessionPerms.includes("users.manage");

  const [me, groupName, skillCatalog, candidateProfile, sickLeaves] = await Promise.all([
    // Inclut les expériences pro pour l'espace "Mon CV" côté consultant interne
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    }),
    getUserAccessGroupName(session.user.id),
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.candidate.findUnique({
      where: { portalUserId: session.user.id },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    }),
    prisma.sickLeave.findMany({
      where: { userId: session.user.id },
      orderBy: { startDate: "desc" },
      take: 30
    })
  ]);
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const sickLeavesUi = sickLeaves.map((l) => {
    const startIso = l.startDate.toISOString().slice(0, 10);
    const endIso = l.endDate.toISOString().slice(0, 10);
    return {
      id: l.id,
      startDate: startIso,
      endDate: endIso,
      reason: l.reason,
      certificateUrl: l.certificateUrl,
      isActive: startIso <= todayIso && todayIso <= endIso
    };
  });

  const isCandidatePortal = !!candidateProfile;

  return (
    <div>
      <PageHeader
        title={isCandidatePortal ? "Mon CV" : "Mon profil"}
        subtitle={isCandidatePortal
          ? "Complétez votre CV — vos informations sont directement visibles par notre équipe."
          : "Vos informations personnelles et identifiants"}
        actions={
          <>
            {/* Aperçu + Export CV : disponibles pour portail candidat ET
                consultant interne. L'aperçu (inline=1) ouvre le PDF sans
                le télécharger, pour vérifier le rendu avant envoi. */}
            {(() => {
              const cvQuery = isCandidatePortal
                ? `candidateId=${candidateProfile!.id}`
                : `userId=${session.user.id}`;
              return (
                <>
                  <a
                    href={`/api/exports/cv-pdf?${cvQuery}&inline=1`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn-ghost text-sm inline-flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> Aperçu
                  </a>
                  <a
                    href={`/api/exports/cv-pdf?${cvQuery}`}
                    className="btn-secondary text-sm inline-flex items-center gap-1"
                  >
                    <FileDown className="w-4 h-4" /> Exporter mon CV
                  </a>
                </>
              );
            })()}
            <a href="/me/tests" className="btn-secondary text-sm">
              🎓 Mes tests techniques
            </a>
          </>
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
            <div className="space-y-6">
              <ProfileForm initial={me as any} skillCatalog={skillCatalog} />
              {/* Expériences pro du consultant interne — utilisées comme CV
                  sur les propositions consultant PDF envoyées aux clients. */}
              <UserExperiencesPanel
                userId={me.id}
                experiences={me.experiences.map((e) => ({
                  id: e.id,
                  companyName: e.companyName,
                  jobTitle: e.jobTitle,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate ? e.endDate.toISOString() : null,
                  description: e.description
                }))}
              />
              <SickLeaveBlock existingLeaves={sickLeavesUi} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
