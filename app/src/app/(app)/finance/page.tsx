import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { MilestoneStatusSelect } from "./status-select";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }: { searchParams: { status?: string; companyId?: string; from?: string; to?: string } }) {
  await requirePermission("finance.read");
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.from) where.expectedAt = { ...(where.expectedAt ?? {}), gte: new Date(searchParams.from) };
  if (searchParams.to)   where.expectedAt = { ...(where.expectedAt ?? {}), lte: new Date(searchParams.to) };

  const milestones = await prisma.billingMilestone.findMany({
    where,
    include: {
      offer:   { include: { company: true } },
      project: { include: { company: true } }
    },
    orderBy: [{ status: "asc" }, { expectedAt: "asc" }]
  });

  const filtered = searchParams.companyId
    ? milestones.filter(m => (m.offer?.companyId === searchParams.companyId) || (m.project?.companyId === searchParams.companyId))
    : milestones;

  const totalPlanned = filtered.filter(m => m.status === "PLANNED").reduce((s, m) => s + Number(m.amount), 0);
  const totalReady = filtered.filter(m => m.status === "READY").reduce((s, m) => s + Number(m.amount), 0);
  const totalTransmitted = filtered.filter(m => m.status === "TRANSMITTED").reduce((s, m) => s + Number(m.amount), 0);
  const totalPaid = filtered.filter(m => m.status === "PAID").reduce((s, m) => s + Number(m.amount), 0);
  const overdue = filtered.filter(m => m.expectedAt && m.expectedAt < new Date() && ["PLANNED","READY"].includes(m.status));

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title="Finance · Tranches de facturation"
        subtitle={`${filtered.length} tranche(s)`}
        actions={<a href={`/api/exports/milestones?status=${searchParams.status ?? ""}`} className="btn-secondary">Export CSV</a>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Prévu" value={formatCurrency(totalPlanned)} tone="info" />
        <KpiCard label="Prêt à facturer" value={formatCurrency(totalReady)} tone="warning" />
        <KpiCard label="Transmis Peppol" value={formatCurrency(totalTransmitted)} tone="info" />
        <KpiCard label="Payé" value={formatCurrency(totalPaid)} tone="success" />
        <KpiCard label="En retard" value={overdue.length} hint={formatCurrency(overdue.reduce((s,m) => s + Number(m.amount), 0))} tone={overdue.length ? "danger" : "neutral"} />
      </div>

      <form className="mb-4 flex gap-2 flex-wrap">
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[180px]">
          <option value="">Tous statuts</option>
          <option value="PLANNED">Prévue</option>
          <option value="READY">Prête à facturer</option>
          <option value="TRANSMITTED">Transmise Peppol</option>
          <option value="PAID">Payée</option>
          <option value="CANCELLED">Annulée</option>
        </select>
        <select name="companyId" defaultValue={searchParams.companyId ?? ""} className="input max-w-[220px]">
          <option value="">Tous clients</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="input max-w-[160px]" />
        <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="input max-w-[160px]" />
        <button className="btn-secondary">Filtrer</button>
      </form>

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead><tr>
            <th>Libellé</th><th>Client</th><th>Source</th>
            <th>Date prévue</th><th className="text-right">Montant HT</th><th>Statut</th><th>Transmise</th><th>Payée</th>
          </tr></thead>
          <tbody>
            {filtered.map(m => {
              const overdueRow = m.expectedAt && m.expectedAt < new Date() && ["PLANNED","READY"].includes(m.status);
              const company = m.offer?.company ?? m.project?.company;
              return (
                <tr key={m.id} className={overdueRow ? "bg-red-50/40" : ""}>
                  <td className="font-medium">{m.label}{m.trigger && <div className="text-xs text-midnight-500">{m.trigger}</div>}</td>
                  <td>{company ? <Link href={`/companies/${company.id}`} className="hover:underline">{company.name}</Link> : "—"}</td>
                  <td className="text-xs">
                    {m.offer && <Link href={`/offers/${m.offer.id}`} className="hover:underline">Offre {m.offer.reference}</Link>}
                    {m.project && <Link href={`/projects/${m.project.id}`} className="hover:underline">Projet {m.project.reference}</Link>}
                  </td>
                  <td>
                    {m.expectedAt ? formatDate(m.expectedAt) : "—"}
                    {overdueRow && <span className="ml-1 badge-danger text-[10px]">retard</span>}
                  </td>
                  <td className="text-right tabular-nums">{formatCurrency(m.amount)}</td>
                  <td><MilestoneStatusSelect id={m.id} value={m.status} /></td>
                  <td className="text-xs text-midnight-500">{m.transmittedAt ? formatDate(m.transmittedAt) : "—"}</td>
                  <td className="text-xs text-midnight-500">{m.paidAt ? formatDate(m.paidAt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
