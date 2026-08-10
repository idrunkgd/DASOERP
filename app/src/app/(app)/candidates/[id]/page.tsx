import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { CandidateForm } from "../candidate-form";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { RecruitButton } from "./recruit-button";
import { CandidatePortalButton } from "./portal-button";
import { HiringInterviewsPanel } from "./hiring-interviews";
import { ClientInterviewsPanel, type AppWithInterviews } from "./client-interviews-panel";
import { BackfillCvButton } from "./backfill-cv-button";
import { SubjectContractsPanel } from "@/components/contracts/subject-contracts-panel";
import { ExperiencesPanel } from "../../me/experiences-panel";
import { CandidateTestsSection } from "./tests-section";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle2, MessageSquare, FileDown, Eye, User as UserIcon, FileText, Briefcase, FileSignature } from "lucide-react";
import { SalaryScenariosPanel } from "./salary-scenarios-panel";
import { PersonTabsNav, type PersonTab } from "@/components/ui/person-tabs-nav";

type CandidateTab = "general" | "cv" | "recruitment" | "contracts";

export default async function CandidateDetail({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  await requirePermission("consulting.read");
  const session = await requireSession();
  const tab: CandidateTab = (["general", "cv", "recruitment", "contracts"].includes(searchParams.tab ?? "")
    ? searchParams.tab
    : "general") as CandidateTab;
  const [c, skillCatalog, candidateContracts, contractTemplates] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: params.id },
      include: {
        applications: {
          include: {
            missionRequest: { include: { company: true } },
            interviews: { orderBy: { scheduledAt: "desc" } },
            offer: true
          },
          orderBy: { presentedAt: "desc" }
        },
        convertedToUser: { select: { id: true, email: true, firstName: true, lastName: true, active: true, joinedAt: true, leftAt: true } },
        portalUser: { select: { id: true, email: true, active: true } },
        hiringInterviews: { orderBy: { scheduledAt: "desc" } },
        experiences: { orderBy: { startDate: "desc" } },
        salaryScenarios: {
          orderBy: { createdAt: "desc" },
          include: { createdBy: { select: { firstName: true, lastName: true } } }
        }
      }
    }),
    prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.contract.findMany({
      where: { candidateId: params.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, title: true, status: true, startDate: true, endDate: true }
    }),
    prisma.contractTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);
  if (!c) notFound();

  const sessionPerms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canRecruit = sessionPerms.includes("users.manage");
  const canApplyScenarios = sessionPerms.includes("consulting.write");
  const canManageContracts = sessionPerms.includes("contracts.manage");
  const canReadContracts = sessionPerms.includes("contracts.read");

  // Aplatit tous les entretiens à travers toutes les missions (plus pratique pour avoir la vue globale)
  const allInterviews = c.applications.flatMap(a =>
    a.interviews.map(i => ({
      ...i,
      missionRef: a.missionRequest.reference,
      missionTitle: a.missionRequest.title,
      missionId: a.missionRequest.id,
      companyName: a.missionRequest.company.name,
      applicationStatus: a.status
    }))
  ).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const KIND_LABEL: Record<string, string> = {
    PHONE: "Téléphone", VIDEO: "Visio", ON_SITE: "Sur site", TECHNICAL: "Technique", HR: "RH"
  };

  // Email pour l'embauche (devient consultant Dasolabs : prenom.nom@dasolabs.com)
  const suggestedEmail = `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@dasolabs.com`.replace(/[^a-z.@]/g, "");
  // Email pour le portail candidat (reste candidat externe : ext.prenom@dasolabs.be)
  const suggestedPortalEmail = `ext.${c.firstName.toLowerCase()}@dasolabs.be`.replace(/[^a-z.@]/g, "");

  return (
    <div>
      <PageHeader
        title={`${c.firstName} ${c.lastName}`}
        breadcrumb={[{ label: "Candidats", href: "/candidates" }, { label: `${c.firstName} ${c.lastName}` }]}
        subtitle={c.seniority ?? undefined}
        actions={
          <>
            {/* Aperçu CV — ouvre le PDF dans le navigateur sans télécharger,
                pour vérifier le rendu avant envoi. */}
            <Link
              href={`/api/exports/cv-pdf?candidateId=${c.id}&inline=1`}
              target="_blank" rel="noopener noreferrer"
              className="btn-ghost btn-sm"
            >
              <Eye className="w-4 h-4" /> Aperçu CV
            </Link>
            {/* Export CV standalone : indépendant d'une offre, un vrai CV
                du candidat au format Dasolabs pour envoi hors process. */}
            <Link
              href={`/api/exports/cv-pdf?candidateId=${c.id}`}
              className="btn-secondary btn-sm"
            >
              <FileDown className="w-4 h-4" /> Exporter le CV
            </Link>
            {!c.portalUser && canRecruit && c.status !== "ARCHIVED" && (
              <CandidatePortalButton candidateId={c.id} suggestedEmail={suggestedPortalEmail} />
            )}
            {!c.convertedToUser && canRecruit && c.status !== "ARCHIVED" && (
              <RecruitButton candidateId={c.id} suggestedEmail={suggestedEmail} />
            )}
          </>
        }
      />

      {c.convertedToUser && (
        <div className="card p-4 mb-5 flex items-start gap-3 border-emerald-200 bg-emerald-50/50">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
          <div className="text-sm flex-1">
            <div className="font-medium text-midnight-900">Candidat recruté chez Dasolabs</div>
            <div className="text-midnight-700">
              Compte consultant : <Link href={`/consultants/${c.convertedToUser.id}`} className="text-indigoaccent hover:underline">{c.convertedToUser.firstName} {c.convertedToUser.lastName}</Link> — {c.convertedToUser.email}
              {c.convertedToUser.joinedAt && <span className="text-midnight-500"> · entrée {formatDate(c.convertedToUser.joinedAt)}</span>}
              {c.convertedToUser.leftAt && <span className="text-red-700"> · parti {formatDate(c.convertedToUser.leftAt)}</span>}
              {!c.convertedToUser.active && !c.convertedToUser.leftAt && <span className="text-amber-700"> · compte inactif</span>}
            </div>
            <div className="text-xs text-midnight-500 mt-1">Cette fiche n'apparaît plus dans la liste candidats par défaut (exclusivité Candidat / Consultant).</div>
          </div>
          {canRecruit && c.experiences.length > 0 && (
            <BackfillCvButton
              candidateId={c.id}
              hint={`${c.experiences.length} expérience${c.experiences.length > 1 ? "s" : ""} sur la fiche candidat — clic pour les copier vers le consultant si elles manquent.`}
            />
          )}
        </div>
      )}

      {c.portalUser && (
        <div className="card p-4 mb-5 flex items-start gap-3 border-indigoaccent/30 bg-indigoaccent/5">
          <span className="w-5 h-5 shrink-0 mt-0.5 grid place-items-center rounded-full bg-indigoaccent/20 text-indigoaccent text-xs font-semibold">CV</span>
          <div className="text-sm flex-1">
            <div className="font-medium text-midnight-900">Portail candidat actif</div>
            <div className="text-midnight-700">Compte de connexion : <span className="font-mono">{c.portalUser.email}</span> {!c.portalUser.active && <span className="text-amber-700"> · inactif</span>}</div>
            <div className="text-xs text-midnight-500 mt-1">Le candidat peut se connecter et compléter son profil. Les modifications qu'il fait alimentent directement cette fiche.</div>
          </div>
        </div>
      )}

      {c.status === "ARCHIVED" && !c.convertedToUser && (
        <div className="card p-4 mb-5 border-midnight-200 bg-midnight-50 text-sm">
          <span className="font-medium">Candidat archivé.</span> Cette fiche n'apparaît plus dans la liste par défaut. Modifiez le statut pour la rendre disponible à nouveau.
        </div>
      )}

      {/* Onglets — préserve les autres params (?edit=xxx…) */}
      {(() => {
        const CANDIDATE_TABS: PersonTab[] = [
          { key: "general",     label: "Général",     icon: UserIcon },
          { key: "cv",          label: "CV & Package", icon: FileText,
            badge: c.experiences.length || c.salaryScenarios.length
              ? c.experiences.length + c.salaryScenarios.length
              : undefined },
          { key: "recruitment", label: "Recrutement", icon: Briefcase,
            badge: c.applications.length + c.hiringInterviews.length || undefined },
          { key: "contracts",   label: "Contrats",    icon: FileSignature,
            badge: candidateContracts.length || undefined }
        ];
        return <PersonTabsNav tabs={CANDIDATE_TABS} current={tab} />;
      })()}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === "general" && (
            <CandidateForm initial={c as any} skillCatalog={skillCatalog} />
          )}

          {tab === "cv" && (
            <>
              <ExperiencesPanel
                candidateId={c.id}
                experiences={c.experiences.map(e => ({
                  id: e.id,
                  companyName: e.companyName,
                  jobTitle: e.jobTitle,
                  startDate: e.startDate.toISOString(),
                  endDate: e.endDate ? e.endDate.toISOString() : null,
                  description: e.description
                }))}
              />
              <SalaryScenariosPanel
                candidateId={c.id}
                canApply={canApplyScenarios}
                candidateCurrentDailyCost={c.dailyCost ? Number(c.dailyCost) : null}
                scenarios={c.salaryScenarios.map((s: any) => ({
                  id: s.id,
                  label: s.label,
                  grossMonthly: Number(s.grossMonthly),
                  workingDaysPerWeek: Number(s.workingDaysPerWeek),
                  totalAnnualCost: Number(s.totalAnnualCost),
                  costPerDay: Number(s.costPerDay),
                  billableRate: Number(s.billableRate),
                  soldDailyRate: Number(s.soldDailyRate),
                  targetMarginPct: Number(s.targetMarginPct),
                  createdAt: s.createdAt.toISOString(),
                  createdBy: s.createdBy
                }))}
              />
            </>
          )}

          {tab === "recruitment" && (
            <>
              <HiringInterviewsPanel
                candidateId={c.id}
                interviews={c.hiringInterviews.map(i => ({
                  id: i.id, scheduledAt: i.scheduledAt.toISOString(), kind: i.kind,
                  interviewers: i.interviewers, location: i.location, feedback: i.feedback, outcome: i.outcome
                }))}
              />
              <CandidateTestsSection candidateId={c.id} />
              <section className="card p-5">
                <h2 className="font-semibold mb-3">Présentations sur missions ({c.applications.length})</h2>
                {c.applications.length === 0 ? (
                  <p className="text-sm text-midnight-500">Pas encore présenté sur une mission.</p>
                ) : (
                  <table className="table-base">
                    <thead><tr><th>Mission</th><th>Client</th><th className="text-right">Tarif proposé</th><th>Statut</th><th>Présenté</th><th className="text-right">Entretiens</th></tr></thead>
                    <tbody>
                      {c.applications.map(a => (
                        <tr key={a.id}>
                          <td><Link href={`/mission-requests/${a.missionRequest.id}`} className="font-medium hover:underline">{a.missionRequest.reference}</Link><div className="text-xs text-midnight-500">{a.missionRequest.title}</div></td>
                          <td className="text-midnight-700">{a.missionRequest.company.name}</td>
                          <td className="text-right tabular-nums">{a.proposedDailyRate ? formatCurrency(a.proposedDailyRate) : "—"}</td>
                          <td><StatusBadge status={a.status} /></td>
                          <td className="text-xs text-midnight-500">{formatDate(a.presentedAt)}</td>
                          <td className="text-right tabular-nums">{a.interviews.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
              <ClientInterviewsPanel
                applications={c.applications.map<AppWithInterviews>((a) => ({
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
            </>
          )}

          {tab === "contracts" && canReadContracts && (
            <SubjectContractsPanel
              contracts={candidateContracts}
              templates={contractTemplates}
              subject={{ kind: "candidate", id: c.id, label: `${c.firstName} ${c.lastName}` }}
              canManage={canManageContracts}
            />
          )}
          {tab === "contracts" && !canReadContracts && (
            <div className="card p-6 text-sm text-midnight-500 italic">
              Tu n'as pas la permission pour voir les contrats de ce candidat.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5 flex flex-col items-center text-center">
            <PersonAvatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.photoUrl} size={160} className="rounded-2xl shadow-card" />
            <h2 className="font-semibold text-midnight-900 mt-3">{c.firstName} {c.lastName}</h2>
            {c.seniority && <p className="text-xs text-midnight-500">{c.seniority}{c.yearsExperience ? ` · ${c.yearsExperience} ans d'XP` : ""}</p>}
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Coordonnées</h3>
            <Row k="Email" v={c.email ?? "—"} />
            <Row k="Téléphone" v={c.phone ?? "—"} />
            <Row k="LinkedIn" v={c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" className="text-indigoaccent hover:underline">Profil</a> : "—"} />
            <Row k="Ville" v={c.city ?? "—"} />
            <Row k="Source" v={c.source ?? "—"} />
            <hr />
            <Row k="Cout / j" v={c.dailyCost ? formatCurrency(c.dailyCost) : "—"} />
            <Row k="Tarif min souhaité" v={c.minDailyRate ? formatCurrency(c.minDailyRate) : "—"} />
            <Row k="Disponible" v={c.availableFrom ? formatDate(c.availableFrom) : "—"} />
            <Row k="Statut" v={<StatusBadge status={c.status === "ACTIVE" ? "ACTIVE_CT" : c.status} />} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 text-right">{v}</span></div>;
}
