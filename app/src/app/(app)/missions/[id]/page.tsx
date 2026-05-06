import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { MissionExecForm } from "./mission-exec-form";
import { MissionExecStatusActions } from "./status-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planifiée", ACTIVE: "Active", EXTENDED: "Prolongée",
  COMPLETED: "Terminée", CANCELLED: "Annulée", ON_HOLD: "En pause"
};

export default async function MissionExecDetail({ params }: { params: { id: string } }) {
  await requirePermission("consulting.read");
  const m = await prisma.mission.findUnique({
    where: { id: params.id },
    include: {
      consultant: true,
      company: true,
      intermediaryCompany: true,
      intermediaryContact: true,
      missionRequest: { select: { id: true, reference: true, title: true } },
      application: { include: { candidate: true } },
      milestones: { orderBy: { expectedAt: "asc" } }
    }
  });
  if (!m) notFound();

  const [companies, consultants, contacts] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    prisma.contact.findMany({ orderBy: [{ lastName: "asc" }], select: { id: true, firstName: true, lastName: true, companyId: true } })
  ]);

  // Heures validées / chiffré
  const tsAggr = await prisma.timesheetEntry.aggregate({
    where: { missionId: m.id, status: "APPROVED" }, _sum: { hours: true }
  });
  const totalHours = Number(tsAggr._sum.hours ?? 0);
  const totalDays = totalHours / 8;
  const billed = totalDays * Number(m.dailyRate);
  const cost = totalDays * Number(m.dailyCost);
  const margin = billed - cost;

  const today = new Date();
  const effectiveEnd = m.actualEndDate ?? m.endDate;
  const daysLeft = differenceInCalendarDays(effectiveEnd, today);

  return (
    <div>
      <PageHeader
        title={m.title}
        breadcrumb={[{ label: "Missions T&M", href: "/missions" }, { label: m.reference }]}
        subtitle={
          <span>
            {m.reference} · {m.company.name} ·{" "}
            <span className={"badge-" + (m.status === "ACTIVE" || m.status === "EXTENDED" ? "success" : m.status === "PLANNED" ? "info" : "neutral")}>
              {STATUS_LABELS[m.status]}
            </span>
            {m.consultant && <> · <Link href={`/consultants/${m.consultant.id}`} className="text-indigoaccent hover:underline">{m.consultant.firstName} {m.consultant.lastName}</Link></>}
            {" · issue de "}<Link href={`/mission-requests/${m.missionRequestId}`} className="text-indigoaccent hover:underline">{m.missionRequest.reference}</Link>
          </span>
        }
        actions={<MissionExecStatusActions id={m.id} status={m.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MissionExecForm initial={m as any} companies={companies} consultants={consultants} contacts={contacts} />
        </div>
        <aside className="space-y-4">
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Conditions</h3>
            <Row k="Tarif facturé" v={`${formatCurrency(m.dailyRate)}/j`} />
            <Row k="Coût interne" v={`${formatCurrency(m.dailyCost)}/j`} />
            <Row k="Marge / jour" v={formatCurrency(Number(m.dailyRate) - Number(m.dailyCost))} />
            <hr />
            <Row k="Début" v={formatDate(m.startDate)} />
            <Row k="Fin prévue" v={formatDate(m.endDate)} />
            {m.actualEndDate && <Row k="Fin réelle" v={formatDate(m.actualEndDate)} />}
            <Row k="Jours estimés" v={m.estimatedDays ?? "—"} />
            <Row k="Localisation" v={m.workLocation ?? "—"} />
            <Row k="Facturation" v={m.billingFrequency} />
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Parties prenantes</h3>
            <Row k="Client final" v={<Link href={`/companies/${m.company.id}`} className="text-indigoaccent hover:underline">{m.company.name}</Link>} />
            {m.intermediaryCompany ? (
              <>
                <Row k="Société de portage" v={<Link href={`/companies/${m.intermediaryCompany.id}`} className="text-indigoaccent hover:underline">{m.intermediaryCompany.name}</Link>} />
                <Row k="Contact portage" v={m.intermediaryContact ? <Link href={`/contacts/${m.intermediaryContact.id}`} className="text-indigoaccent hover:underline">{m.intermediaryContact.firstName} {m.intermediaryContact.lastName}</Link> : "—"} />
                <p className="text-xs text-midnight-500 mt-1">Facturation à adresser à <strong>{m.intermediaryCompany.name}</strong>.</p>
              </>
            ) : (
              <p className="text-xs text-midnight-500">Mission directe — facturation au client final.</p>
            )}
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Réalisé (timesheet validés)</h3>
            <Row k="Heures" v={`${totalHours.toFixed(1)}h`} />
            <Row k="Jours" v={totalDays.toFixed(2)} />
            <Row k="Facturable" v={formatCurrency(billed)} />
            <Row k="Coût" v={formatCurrency(cost)} />
            <Row k="Marge" v={<span className={margin >= 0 ? "text-emerald-700" : "text-red-700"}>{formatCurrency(margin)}</span>} />
            {(m.status === "ACTIVE" || m.status === "EXTENDED") && (
              <div className="text-xs text-midnight-500 mt-2">
                {daysLeft >= 0
                  ? `Mission en cours · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`
                  : "Mission dépassée — à clôturer ou prolonger"}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Tranches de facturation T&M</h3>
            {m.milestones.length === 0 ? (
              <p className="text-midnight-500">Aucune tranche générée. Les tranches T&M sont créées mensuellement depuis les timesheets validés.</p>
            ) : (
              <ul className="space-y-1">
                {m.milestones.map(ms => (
                  <li key={ms.id} className="flex justify-between">
                    <span>{ms.label}</span>
                    <span className="tabular-nums">{formatCurrency(ms.amount)} <span className="text-midnight-500 text-xs">{ms.status}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/finance?missionId=${m.id}`} className="text-xs text-indigoaccent hover:underline">→ Voir dans Finance</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 text-right">{v}</span></div>;
}
