import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ReviewsPanel } from "../../users/[id]/reviews-panel";
import { OffboardButton } from "./offboard-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { userPlannedHoursForWeek } from "@/server/services/load-service";
import { getConsultantMissionStatus } from "@/server/services/mission-status";
import { ROLE_LABELS } from "@/lib/rbac";
import { Plane, CalendarCheck, CalendarClock as CalIcon, Pencil, FileText, MessageSquare, Wallet, Car, HeartPulse } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { computeLeaveBalance } from "@/lib/leave-balance";
import { PersonTabsNav, type PersonTab } from "@/components/ui/person-tabs-nav";

type ConsultantTab = "profile" | "compensation" | "rh";

export default async function ConsultantDetail({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const session = await requireSession();
  const tab: ConsultantTab = (["profile", "compensation", "rh"].includes(searchParams.tab ?? "")
    ? searchParams.tab
    : "profile") as ConsultantTab;
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  if (!perms.includes("consulting.read")) notFound();

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      projectMemberships: { include: { project: { include: { company: true } } } },
      recruitedFromCandidate: { select: { id: true, firstName: true, lastName: true, source: true } },
      missionApplications: {
        include: { missionRequest: { include: { company: true } }, interviews: { orderBy: { scheduledAt: "desc" } }, mission: true },
        orderBy: { presentedAt: "desc" }
      }
    }
  });
  if (!user) notFound();

  const isAdmin = perms.includes("users.manage");
  const isManager = perms.includes("timesheet.validate");
  const canManage = isAdmin || isManager;

  // Données RH sensibles : chargées seulement si canManage
  // Source de vérité rémunération = dernière simulation de package
  // (CandidateSalaryScenario) créée pour le candidat d'origine — pas la
  // PayrollEmployee (qui n'est configurée qu'après signature du contrat).
  const originCandidateId = user.recruitedFromCandidate?.id ?? null;
  const [reviews, projects, planned, mission, salaryScenario, activeVehicle, leaveBalance, recentLeaves, recentSickLeaves] = await Promise.all([
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
    userPlannedHoursForWeek(user.id, new Date()),
    getConsultantMissionStatus(user.id),
    canManage && originCandidateId
      ? prisma.candidateSalaryScenario.findFirst({
          where: { candidateId: originCandidateId },
          orderBy: { createdAt: "desc" }
        })
      : null,
    canManage ? prisma.vehicleAssignment.findFirst({
      where: { userId: user.id, endDate: null },
      include: {
        vehicle: {
          include: { leasingContract: { select: { monthlyAmount: true, lessor: true, endDate: true } } }
        }
      }
    }) : null,
    canManage ? computeLeaveBalance(user.id) : null,
    canManage ? prisma.leaveRequest.findMany({
      where: { userId: user.id, status: { in: ["SUBMITTED", "APPROVED"] } },
      orderBy: { startDate: "desc" },
      take: 10,
      select: { id: true, type: true, status: true, startDate: true, endDate: true, days: true, reason: true }
    }) : [],
    canManage ? prisma.sickLeave.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
      take: 10,
      select: { id: true, startDate: true, endDate: true, certificateUrl: true, notes: true, reason: true }
    }) : []
  ]);

  const activeProjects = user.projectMemberships.filter(m => ["TO_START","ACTIVE","ON_HOLD"].includes(m.project.status));

  // Aplatit tous les entretiens client à travers toutes les missions (vue globale)
  const allInterviews = user.missionApplications.flatMap(a =>
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

  return (
    <div>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        breadcrumb={[{ label: "Consultants", href: "/consultants" }, { label: `${user.firstName} ${user.lastName}` }]}
        subtitle={
          <span>
            {ROLE_LABELS[user.role]} ·{" "}
            {user.active
              ? <span className="badge-success">Actif</span>
              : <span className="badge-neutral">Parti{user.leftAt ? ` depuis ${formatDate(user.leftAt)}` : ""}</span>}
            {user.recruitedFromCandidate && (
              <> · <Link href={`/candidates/${user.recruitedFromCandidate.id}`} className="text-midnight-500 hover:text-indigoaccent hover:underline" title="Voir la fiche candidat à l'origine du recrutement">
                <FileText className="w-3 h-3 inline" /> fiche candidat d'origine
              </Link></>
            )}
          </span>
        }
        actions={
          <>
            {isAdmin && (
              <Link href={`/users/${user.id}`} className="btn-primary btn-sm flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Modifier le profil
              </Link>
            )}
            {isAdmin && user.active && <OffboardButton userId={user.id} fullName={`${user.firstName} ${user.lastName}`} />}
          </>
        }
      />

      {user.active && <MissionStatusBanner mission={mission} />}

      {/* Onglets — visibles seulement si l'utilisateur peut voir les RH */}
      {canManage && (
        <PersonTabsNav
          current={tab}
          tabs={[
            { key: "profile",      label: "Profil",       icon: "user" },
            { key: "compensation", label: "Rémunération", icon: "briefcase",
              badge: (salaryScenario || activeVehicle) ? "•" : undefined },
            { key: "rh",           label: "Congés & maladie", icon: "check",
              badge: (recentLeaves.length + recentSickLeaves.length) || undefined }
          ]}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <aside className="space-y-4">
          <div className="card p-5 flex flex-col items-center text-center">
            <PersonAvatar firstName={user.firstName} lastName={user.lastName} photoUrl={user.photoUrl} size={160} className="rounded-2xl shadow-card" />
            <h2 className="font-semibold text-midnight-900 mt-3">{user.firstName} {user.lastName}</h2>
            {user.seniority && <p className="text-xs text-midnight-500">{user.seniority}{user.yearsExperience ? ` · ${user.yearsExperience} ans d'XP` : ""}</p>}
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Coordonnées</h3>
            <Row k="Email" v={user.email} />
            <Row k="Téléphone" v={user.phone ?? "—"} />
            <Row k="LinkedIn" v={user.linkedinUrl ? <a href={user.linkedinUrl} target="_blank" className="text-indigoaccent hover:underline">Profil</a> : "—"} />
            <Row k="Ville" v={user.city ?? "—"} />
            <hr />
            <Row k="Date d'entrée" v={user.joinedAt ? formatDate(user.joinedAt) : "—"} />
            {user.leftAt && <Row k="Date de sortie" v={formatDate(user.leftAt)} />}
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Charge & taux</h3>
            <Row k="Cout / h" v={user.hourlyCost ? formatCurrency(user.hourlyCost) : "—"} />
            <Row k="Cout / j" v={user.dailyCost ? formatCurrency(user.dailyCost) : "—"} />
            <Row k="Capacité" v={`${Number(user.weeklyCapacityH).toFixed(0)}h/sem`} />
            <Row k="Charge planifiée" v={`${planned.toFixed(1)}h cette semaine`} />
            <Row k="Projets actifs" v={activeProjects.length} />
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Compétences & langues</h3>
            <div className="flex flex-wrap gap-1">
              {user.skills.length === 0 && <span className="text-midnight-500 text-xs">—</span>}
              {user.skills.map(s => <span key={s} className="badge-info text-[11px]">{s}</span>)}
            </div>
            {user.spokenLanguages.length > 0 && (
              <div className="text-xs text-midnight-700 mt-2">
                <span className="text-midnight-500">Langues : </span>{user.spokenLanguages.join(", ")}
              </div>
            )}
          </div>
        </aside>

        <div className="lg:col-span-2 space-y-6">
          {/* ═══════ Onglet PROFIL — projets, entretiens, placements, reviews ═══════ */}
          {tab === "profile" && (
          <>
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Projets ({user.projectMemberships.length})</h2>
            {user.projectMemberships.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucune affectation projet.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Réf</th><th>Projet</th><th>Client</th><th>Rôle</th><th>Statut</th></tr></thead>
                <tbody>
                  {user.projectMemberships.map(m => (
                    <tr key={m.projectId}>
                      <td className="font-mono text-xs">{m.project.reference}</td>
                      <td><Link href={`/projects/${m.project.id}`} className="hover:underline">{m.project.name}</Link></td>
                      <td>{m.project.company.name}</td>
                      <td className="text-xs">{m.roleLabel ?? "—"}</td>
                      <td><span className="badge-info">{m.project.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Entretiens client (placement) ({allInterviews.length})</h2>
            </div>
            {allInterviews.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucun entretien client à ce jour. Les entretiens sont créés depuis la fiche d'une demande de mission, dans la zone "Présentations".</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Date</th><th>Mission</th><th>Type</th><th>Interviewer(s)</th><th>Issue</th><th>Feedback</th></tr></thead>
                <tbody>
                  {allInterviews.map(i => (
                    <tr key={i.id} className="align-top">
                      <td className="text-xs text-midnight-700">{formatDate(i.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        <Link href={`/mission-requests/${i.missionId}`} className="font-medium hover:underline">{i.missionRef}</Link>
                        <div className="text-xs text-midnight-500">{i.companyName} — {i.missionTitle}</div>
                      </td>
                      <td className="text-xs">{KIND_LABEL[i.kind] ?? i.kind}</td>
                      <td className="text-xs text-midnight-700">{i.interviewers ?? "—"}</td>
                      <td>
                        <span className={"badge-" + (i.outcome === "PASSED" ? "success" : i.outcome === "FAILED" ? "danger" : i.outcome === "CANCELLED" ? "neutral" : "warning")}>
                          {i.outcome}
                        </span>
                      </td>
                      <td className="text-xs text-midnight-700 max-w-md whitespace-pre-wrap">{i.feedback ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Placement sur mission ({user.missionApplications.length})</h2>
            {user.missionApplications.length === 0 ? (
              <p className="text-sm text-midnight-500">Pas encore présenté(e) sur une demande de mission. Allez sur une demande puis ajoutez-le/la dans la liste des candidats.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Demande</th><th>Client</th><th className="text-right">Tarif</th><th>Statut</th><th>Présenté</th><th className="text-right">Entretiens</th><th>Mission</th></tr></thead>
                <tbody>
                  {user.missionApplications.map(a => (
                    <tr key={a.id}>
                      <td><Link href={`/mission-requests/${a.missionRequest.id}`} className="font-medium hover:underline">{a.missionRequest.reference}</Link><div className="text-xs text-midnight-500">{a.missionRequest.title}</div></td>
                      <td className="text-midnight-700">{a.missionRequest.company.name}</td>
                      <td className="text-right tabular-nums">{a.proposedDailyRate ? formatCurrency(a.proposedDailyRate) : "—"}</td>
                      <td><span className={"badge-" + (a.status === "SELECTED" ? "success" : a.status === "REJECTED" ? "danger" : "info")}>{a.status}</span></td>
                      <td className="text-xs text-midnight-500">{formatDate(a.presentedAt)}</td>
                      <td className="text-right tabular-nums">{a.interviews.length}</td>
                      <td className="text-xs">
                        {a.mission
                          ? <Link href={`/missions/${a.mission.id}`} className="text-indigoaccent hover:underline">{a.mission.reference}</Link>
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <ReviewsPanel
            userId={user.id}
            reviews={reviews.map(r => ({
              id: r.id,
              scheduledAt: r.scheduledAt.toISOString(),
              kind: r.kind, outcome: r.outcome,
              feedback: r.feedback, privateNotes: r.privateNotes, goals: r.goals,
              projectId: r.projectId,
              project: r.project ? { id: r.project.id, reference: r.project.reference, name: r.project.name } : null,
              conductedBy: r.conductedBy ? { firstName: r.conductedBy.firstName, lastName: r.conductedBy.lastName } : null
            }))}
            projects={projects}
            canManage={canManage}
            showPrivate={canManage && session.user.id !== user.id}
          />
          </>
          )}

          {/* ═══════ Onglet RÉMUNÉRATION — salaire (simulation) + voiture ═══════ */}
          {tab === "compensation" && canManage && (
            <>
              <section className="card p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigoaccent" /> Rémunération
                </h2>
                {salaryScenario ? (
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between text-xs text-midnight-500 border-b border-border pb-2">
                      <span>
                        Simulation « <strong>{salaryScenario.label}</strong> » créée le {formatDate(salaryScenario.createdAt)}
                      </span>
                      {originCandidateId && (
                        <Link href={`/candidates/${originCandidateId}?tab=cv`}
                          className="text-indigoaccent hover:underline">
                          Voir sur la fiche candidat →
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-midnight-900 mb-2 text-xs uppercase tracking-wide">Salaire</h3>
                        <Row k="Brut mensuel" v={<strong>{formatCurrency(Number(salaryScenario.grossMonthly))}</strong>} />
                        <Row k="Mois payés / an" v={String(Number(salaryScenario.monthsPerYear)).replace(".", ",")} />
                        <Row k="Charges patronales" v={`${Number(salaryScenario.employerChargesPct)} %`} />
                        <Row k="Régime hebdo" v={`${Number(salaryScenario.workingDaysPerWeek)} j/sem`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-midnight-900 mb-2 text-xs uppercase tracking-wide">Sortie annuelle</h3>
                        <Row k="Coût total" v={<strong>{formatCurrency(Number(salaryScenario.totalAnnualCost))}</strong>} />
                        <Row k="Coût / jour" v={formatCurrency(Number(salaryScenario.costPerDay))} />
                        <Row k="TJM cible marge" v={formatCurrency(Number(salaryScenario.billableRate))} />
                        {Number(salaryScenario.soldDailyRate) > 0 && (
                          <Row k="TJM vendu client" v={formatCurrency(Number(salaryScenario.soldDailyRate))} />
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border pt-3">
                      <h3 className="font-semibold text-midnight-900 mb-2 text-xs uppercase tracking-wide">Avantages</h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <Row k="Voiture (TCO / mois)" v={formatCurrency(Number(salaryScenario.carMonthlyTco))} />
                        <Row k="Chèques-repas / jour" v={formatCurrency(Number(salaryScenario.mealVoucherEmployerPerDay))} />
                        <Row k="Éco-chèques / an" v={formatCurrency(Number(salaryScenario.ecoVouchersAnnual))} />
                        <Row k="Assurance groupe" v={`${Number(salaryScenario.groupInsurancePct)} %`} />
                        <Row k="Hospitalisation / mois" v={formatCurrency(Number(salaryScenario.hospitalInsuranceMonthly))} />
                        <Row k="GSM + internet / mois" v={formatCurrency(Number(salaryScenario.phoneInternetMonthly))} />
                        <Row k="Frais représ. nets / mois" v={formatCurrency(Number(salaryScenario.netExpensesMonthly))} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-midnight-500 italic">
                    Aucune simulation de package pour ce consultant.
                    {originCandidateId ? (
                      <> Va sur <Link href={`/candidates/${originCandidateId}?tab=cv`} className="text-indigoaccent hover:underline">sa fiche candidat</Link> pour en créer une.</>
                    ) : (
                      <> Ce consultant n'a pas de candidat d'origine — la simulation n'est possible que via une fiche candidat.</>
                    )}
                  </p>
                )}
              </section>

              <section className="card p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-indigoaccent" /> Voiture de société
                </h2>
                {activeVehicle ? (
                  <div className="space-y-2 text-sm">
                    <Row
                      k="Véhicule"
                      v={<Link href={`/fleet/${activeVehicle.vehicle.id}`} className="text-indigoaccent hover:underline">
                        {activeVehicle.vehicle.plate} · {activeVehicle.vehicle.brand} {activeVehicle.vehicle.model}
                      </Link>}
                    />
                    <Row k="Type" v={activeVehicle.vehicle.category === "LEASING" ? "Leasing" : "Propriété"} />
                    {activeVehicle.vehicle.leasingContract && (
                      <>
                        <Row k="Leaseur" v={activeVehicle.vehicle.leasingContract.lessor} />
                        <Row
                          k="Mensualité TVAC"
                          v={<strong>{formatCurrency(Number(activeVehicle.vehicle.leasingContract.monthlyAmount))}</strong>}
                        />
                        <Row k="Fin de contrat" v={formatDate(activeVehicle.vehicle.leasingContract.endDate)} />
                      </>
                    )}
                    <Row k="Attribué depuis" v={formatDate(activeVehicle.startDate)} />
                    {activeVehicle.startKm && <Row k="Km au départ" v={`${activeVehicle.startKm.toLocaleString("fr-BE")} km`} />}
                  </div>
                ) : (
                  <p className="text-sm text-midnight-500 italic">
                    Aucun véhicule attribué.
                    <Link href="/fleet" className="text-indigoaccent hover:underline ml-1">Attribuer depuis /fleet →</Link>
                  </p>
                )}
              </section>
            </>
          )}

          {/* ═══════ Onglet CONGÉS & MALADIE ═══════ */}
          {tab === "rh" && canManage && (
            <>
              <section className="card p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-indigoaccent" /> Congés {leaveBalance?.year ?? new Date().getFullYear()}
                </h2>
                {leaveBalance && (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="border border-border rounded p-3 text-center">
                        <div className="text-[10px] text-midnight-500 uppercase tracking-wide">Légaux</div>
                        <div className="text-2xl font-bold text-midnight-900">
                          {leaveBalance.annualLegal.remaining.toFixed(1)}
                        </div>
                        <div className="text-[11px] text-midnight-500">/ {leaveBalance.annualLegal.entitled.toFixed(0)} j</div>
                      </div>
                      <div className="border border-border rounded p-3 text-center">
                        <div className="text-[10px] text-midnight-500 uppercase tracking-wide">RTT</div>
                        <div className="text-2xl font-bold text-midnight-900">
                          {leaveBalance.rtt.remaining.toFixed(1)}
                        </div>
                        <div className="text-[11px] text-midnight-500">/ {leaveBalance.rtt.entitled.toFixed(0)} j</div>
                      </div>
                      <div className="border border-border rounded p-3 text-center">
                        <div className="text-[10px] text-midnight-500 uppercase tracking-wide">Reportés</div>
                        <div className="text-2xl font-bold text-midnight-900">
                          {leaveBalance.carriedOver.remaining.toFixed(1)}
                        </div>
                        <div className="text-[11px] text-midnight-500">/ {leaveBalance.carriedOver.entitled.toFixed(0)} j</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                      <span className="text-sm text-midnight-700">Solde total restant</span>
                      <span className="text-lg font-bold text-indigoaccent">
                        {leaveBalance.total.remaining.toFixed(1)} / {leaveBalance.total.entitled.toFixed(0)} j
                      </span>
                    </div>
                    {leaveBalance.total.pending > 0 && (
                      <p className="text-xs text-amber-700 mb-3">
                        ⏳ {leaveBalance.total.pending.toFixed(1)}j en attente d'approbation
                      </p>
                    )}
                  </>
                )}

                {recentLeaves.length === 0 ? (
                  <p className="text-sm text-midnight-500 italic">Aucune demande récente.</p>
                ) : (
                  <>
                    <h3 className="text-xs text-midnight-500 uppercase tracking-wide mb-2">Dernières demandes</h3>
                    <table className="table-base text-sm">
                      <thead><tr><th>Période</th><th>Type</th><th className="text-right">Jours</th><th>Statut</th><th>Motif</th></tr></thead>
                      <tbody>
                        {recentLeaves.map((l) => (
                          <tr key={l.id}>
                            <td className="text-xs">
                              {formatDate(l.startDate, { day: "2-digit", month: "short" })}
                              {l.startDate.getTime() !== l.endDate.getTime() && ` → ${formatDate(l.endDate, { day: "2-digit", month: "short" })}`}
                            </td>
                            <td className="text-xs">{l.type}</td>
                            <td className="text-right tabular-nums">{Number(l.days).toFixed(1)}</td>
                            <td>
                              <span className={"badge-" + (l.status === "APPROVED" ? "success" : "warning") + " text-[10px]"}>
                                {l.status === "APPROVED" ? "Validé" : "En attente"}
                              </span>
                            </td>
                            <td className="text-xs text-midnight-700 truncate max-w-xs">{l.reason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <div className="mt-3 text-right">
                  <Link href="/leaves" className="text-xs text-indigoaccent hover:underline">
                    Voir tous les congés →
                  </Link>
                </div>
              </section>

              <section className="card p-5">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-red-600" /> Arrêts maladie
                </h2>
                {recentSickLeaves.length === 0 ? (
                  <p className="text-sm text-midnight-500 italic">Aucun arrêt maladie enregistré.</p>
                ) : (
                  <table className="table-base text-sm">
                    <thead><tr><th>Période</th><th className="text-right">Jours</th><th>Certificat</th><th>Notes</th></tr></thead>
                    <tbody>
                      {recentSickLeaves.map((s) => {
                        const days = Math.max(1, Math.round((s.endDate.getTime() - s.startDate.getTime()) / 86400000) + 1);
                        return (
                          <tr key={s.id}>
                            <td className="text-xs">
                              {formatDate(s.startDate, { day: "2-digit", month: "short", year: "numeric" })}
                              {s.startDate.getTime() !== s.endDate.getTime() && ` → ${formatDate(s.endDate, { day: "2-digit", month: "short" })}`}
                            </td>
                            <td className="text-right tabular-nums">{days}</td>
                            <td className="text-xs">
                              {s.certificateUrl
                                ? <a href={`/api/sick-leaves/${s.id}/certificate`} target="_blank" rel="noopener noreferrer" className="text-indigoaccent hover:underline">📎 Voir</a>
                                : <span className="text-midnight-400">—</span>}
                            </td>
                            <td className="text-xs text-midnight-700 truncate max-w-xs">
                              {s.reason ?? s.notes ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                <div className="mt-3 text-right">
                  <Link href="/sick-leaves" className="text-xs text-indigoaccent hover:underline">
                    Voir tous les arrêts →
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 text-right">{v}</span></div>;
}

function MissionStatusBanner({ mission }: { mission: Awaited<ReturnType<typeof getConsultantMissionStatus>> }) {
  const today = new Date();

  if (mission.state === "available") {
    return (
      <div className="card p-4 mb-5 flex items-start gap-3 border-emerald-200 bg-emerald-50/50">
        <CalendarCheck className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
        <div className="text-sm flex-1">
          <div className="font-medium text-midnight-900">Disponible</div>
          <div className="text-midnight-700">Aucune affectation projet planifiée dans les 60 prochains jours.</div>
        </div>
      </div>
    );
  }

  if (mission.state === "scheduled") {
    const next = mission.upcoming[0];
    const inDays = differenceInCalendarDays(next.startDate, today);
    return (
      <div className="card p-4 mb-5 flex items-start gap-3 border-indigoaccent/30 bg-indigoaccent/5">
        <CalIcon className="w-5 h-5 text-indigoaccent mt-0.5 shrink-0" />
        <div className="text-sm flex-1">
          <div className="font-medium text-midnight-900">Prochaine mission programmée</div>
          <div className="text-midnight-700">
            <Link href={`/missions/${next.missionId}`} className="text-indigoaccent hover:underline font-medium">{next.reference}</Link>
            {" · "}{next.companyName}
            {" · "}du {formatDate(next.startDate)} au {formatDate(next.endDate)}
            {" "}<span className="text-midnight-500">(dans {inDays} jour{inDays > 1 ? "s" : ""})</span>
          </div>
        </div>
      </div>
    );
  }

  // on_mission
  const daysLeft = differenceInCalendarDays(mission.latestEnd, today);
  return (
    <div className="card p-4 mb-5 border-amber-200 bg-amber-50/50">
      <div className="flex items-start gap-3">
        <Plane className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-sm flex-1">
          <div className="font-medium text-midnight-900">
            En mission · jusqu'au {formatDate(mission.latestEnd)}
            <span className="text-midnight-500 font-normal"> ({daysLeft >= 0 ? `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}` : "fin aujourd'hui"})</span>
          </div>
          <ul className="text-midnight-700 mt-1 space-y-0.5">
            {mission.current.map(m => (
              <li key={m.missionId}>
                <Link href={`/missions/${m.missionId}`} className="text-indigoaccent hover:underline font-medium">{m.reference}</Link>
                {" — "}{m.title} <span className="text-midnight-500">· {m.companyName}</span>
                {" · "}du {formatDate(m.startDate)} au {formatDate(m.endDate)}
                {" · "}{m.dailyRate.toFixed(0)} €/j
              </li>
            ))}
          </ul>
          {mission.upcoming.length > 0 && (
            <div className="text-xs text-midnight-500 mt-2">
              Suivante : <Link href={`/missions/${mission.upcoming[0].missionId}`} className="text-indigoaccent hover:underline">{mission.upcoming[0].reference}</Link> à partir du {formatDate(mission.upcoming[0].startDate)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
