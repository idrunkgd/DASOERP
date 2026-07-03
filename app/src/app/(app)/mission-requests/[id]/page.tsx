import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { MissionForm } from "../mission-form";
import { MissionPipelinePanel } from "./mission-pipeline";
import { MissionStatusActions } from "./status-actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nouvelle", QUALIFYING: "Qualification", PRESENTING: "Présentation",
  CONTRACTED: "Contractée", LOST: "Perdue", CANCELLED: "Annulée"
};

export default async function MissionDetail({ params }: { params: { id: string } }) {
  await requirePermission("consulting.read");
  const m = await prisma.missionRequest.findUnique({
    where: { id: params.id },
    include: {
      company: true, contact: true, owner: true,
      intermediaryCompany: true, intermediaryContact: true,
      // Applications avec toutes les infos utiles au pipeline unifié :
      // profils (candidate ou consultant), entretiens (compteur), proposition
      // et Mission créée. Tout ce dont MissionPipelinePanel a besoin en 1 query.
      applications: {
        include: {
          candidate: true, consultant: true, mission: true,
          proposal: true,
          _count: { select: { interviews: true } }
        },
        orderBy: { presentedAt: "desc" }
      },
      executedMissions: { select: { id: true, reference: true, status: true, dailyRate: true, startDate: true, endDate: true } }
    }
  });
  if (!m) notFound();

  const [companies, contacts, users, candidates, internalConsultants] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: [{ lastName: "asc" }], select: { id: true, firstName: true, lastName: true, companyId: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    // Candidats externes uniquement (ceux pas encore recrutés)
    prisma.candidate.findMany({
      where: { status: { in: ["ACTIVE","UNAVAILABLE"] }, convertedToUser: { is: null } },
      orderBy: [{ lastName: "asc" }]
    }),
    // Consultants internes Dasolabs : Users actifs en rôle delivery, hors comptes portail candidat
    prisma.user.findMany({
      where: {
        active: true,
        role: { in: ["CONSULTANT","MANAGER","COMMERCIAL","FINANCE","ADMIN"] },
        candidateProfile: { is: null }
      },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, seniority: true, dailyCost: true, photoUrl: true }
    })
  ]);

  return (
    <div>
      <PageHeader
        title={m.title}
        breadcrumb={[{ label: "Missions", href: "/mission-requests" }, { label: m.reference }]}
        subtitle={`${m.reference} · ${m.company.name}${m.intermediaryCompany ? ` (via ${m.intermediaryCompany.name})` : ""} · Statut : ${STATUS_LABELS[m.status]}`}
        actions={<MissionStatusActions id={m.id} status={m.status} />}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MissionForm initial={m as any} companies={companies} contacts={contacts} users={users} />
          {/* Pipeline unifié : présentation + offre + décision + création
              de mission — en une seule carte par consultant proposé. */}
          <MissionPipelinePanel
            missionRequestId={m.id}
            defaults={{
              startDate: m.startDate ? m.startDate.toISOString().slice(0, 10) : null,
              endDate:   m.endDate   ? m.endDate.toISOString().slice(0, 10)   : null,
              dailyRate: m.targetDailyRate ? Number(m.targetDailyRate) : null
            }}
            applications={m.applications.map((a) => {
              const isConsultant = !!a.consultantId && !!a.consultant;
              const person = isConsultant
                ? { id: a.consultant!.id, firstName: a.consultant!.firstName, lastName: a.consultant!.lastName,
                    photoUrl: a.consultant!.photoUrl, seniority: a.consultant!.seniority,
                    source: "consultant" as const }
                : a.candidate
                  ? { id: a.candidate.id, firstName: a.candidate.firstName, lastName: a.candidate.lastName,
                      photoUrl: a.candidate.photoUrl, seniority: a.candidate.seniority,
                      source: "candidate" as const }
                  : { id: "", firstName: "?", lastName: "", photoUrl: null, seniority: null, source: "candidate" as const };
              return {
                id: a.id,
                status: a.status as any,
                person,
                proposedDailyRate: a.proposedDailyRate ? Number(a.proposedDailyRate) : null,
                dailyCost: a.dailyCost ? Number(a.dailyCost) : null,
                presentedAt: a.presentedAt.toISOString(),
                decisionAt: a.decisionAt?.toISOString() ?? null,
                rejectedReason: a.rejectedReason,
                interviewCount: a._count.interviews,
                missionId: a.mission?.id ?? null,
                missionReference: a.mission?.reference ?? null,
                proposal: a.proposal ? {
                  id: a.proposal.id, reference: a.proposal.reference,
                  startDate: a.proposal.startDate.toISOString().slice(0, 10),
                  endDate: a.proposal.endDate.toISOString().slice(0, 10),
                  workDaysPerWeek: Number(a.proposal.workDaysPerWeek),
                  dailyRate: Number(a.proposal.dailyRate),
                  computedDays: Number(a.proposal.computedDays),
                  computedBudgetHt: Number(a.proposal.computedBudgetHt)
                } : null
              };
            })}
            newProfileOptions={[
              ...internalConsultants.map((u) => ({
                kind: "consultant" as const, id: u.id,
                firstName: u.firstName, lastName: u.lastName,
                seniority: u.seniority, dailyCost: u.dailyCost ? Number(u.dailyCost) : null
              })),
              ...candidates.map((c) => ({
                kind: "candidate" as const, id: c.id,
                firstName: c.firstName, lastName: c.lastName,
                seniority: c.seniority, dailyCost: c.dailyCost ? Number(c.dailyCost) : null
              }))
            ]}
          />
        </div>

        <aside className="space-y-4">
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Profil recherché</h3>
            <Row k="Séniorité" v={m.seniority ?? "—"} />
            <Row k="Localisation" v={m.workLocation ?? "—"} />
            <Row k="Compétences" v={m.requiredSkills.length ? m.requiredSkills.map(s => <span key={s} className="badge-info mr-1">{s}</span>) : "—"} />
            <Row k="Début" v={m.startDate ? formatDate(m.startDate) : "—"} />
            <Row k="Fin" v={m.endDate ? formatDate(m.endDate) : "—"} />
            <Row k="Jours estimés" v={m.estimatedDays ?? "—"} />
            <hr />
            <Row k="Tarif cible" v={m.targetDailyRate ? formatCurrency(m.targetDailyRate) : "—"} />
            <Row k="Tarif max" v={m.maxDailyRate ? formatCurrency(m.maxDailyRate) : "—"} />
            <Row k="Resp." v={m.owner ? `${m.owner.firstName} ${m.owner.lastName}` : "—"} />
            <Row k="Contact client" v={m.contact ? <Link href={`/contacts/${m.contact.id}`} className="text-indigoaccent hover:underline">{m.contact.firstName} {m.contact.lastName}</Link> : "—"} />
            {m.intermediaryCompany && (
              <>
                <hr />
                <Row k="Société de portage" v={<Link href={`/companies/${m.intermediaryCompany.id}`} className="text-indigoaccent hover:underline">{m.intermediaryCompany.name}</Link>} />
                <Row k="Contact portage" v={m.intermediaryContact ? <Link href={`/contacts/${m.intermediaryContact.id}`} className="text-indigoaccent hover:underline">{m.intermediaryContact.firstName} {m.intermediaryContact.lastName}</Link> : "—"} />
              </>
            )}
            {m.lostReason && <><hr /><Row k="Raison perte" v={<span className="text-red-700">{m.lostReason}</span>} /></>}
          </div>
          {m.executedMissions.length > 0 && (
            <div className="card p-5 text-sm">
              <h3 className="font-semibold mb-2">Mission(s) contractualisée(s)</h3>
              <ul className="space-y-1">
                {m.executedMissions.map(em => (
                  <li key={em.id}>
                    <Link href={`/missions/${em.id}`} className="text-indigoaccent hover:underline">{em.reference}</Link>
                    <span className="text-midnight-500"> · {em.status} · {formatCurrency(em.dailyRate)}/j</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 text-right">{v}</span></div>;
}
