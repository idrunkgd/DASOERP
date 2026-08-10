import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { MilestoneStatusSelect } from "./status-select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter, resolveStatusFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }: { searchParams: { status?: string; companyId?: string; from?: string; to?: string } }) {
  await requirePermission("finance.read");
  const statuses = parseMulti(searchParams.status);
  const companyIds = parseMulti(searchParams.companyId);
  const activeOnly = (searchParams as any).active === "1";
  const where: any = {};
  const statusFilter = resolveStatusFilter(statuses, activeOnly, ["PLANNED", "READY", "TRANSMITTED"]);
  if (statusFilter) where.status = statusFilter;
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

  const filtered = companyIds.length > 0
    ? milestones.filter(m => {
        const cid = m.offer?.companyId ?? m.project?.companyId;
        return cid ? companyIds.includes(cid) : false;
      })
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

      <div className="mb-4 space-y-3">
        <FilterChips
          paramName="active"
          label="Vue rapide"
          multi={false}
          options={[
            { value: "1", label: "Actifs uniquement (masquer terminés)", tone: "info" }
          ]}
        />
        <FilterChips
          paramName="status"
          label="Statut"
          options={[
            { value: "PLANNED",     label: "Prévue",            tone: "info" },
            { value: "READY",       label: "Prête à facturer",  tone: "warning" },
            { value: "TRANSMITTED", label: "Transmise Peppol",  tone: "info" },
            { value: "PAID",        label: "Payée",             tone: "success" },
            { value: "CANCELLED",   label: "Annulée",           tone: "neutral" }
          ]}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">Client</span>
          <FilterMultiSelect
            paramName="companyId"
            label="Client"
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Chercher un client…"
          />
        </div>
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["from", "to", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="input max-w-[160px] text-sm" />
          <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="input max-w-[160px] text-sm" />
          <button className="btn-secondary btn-sm">Appliquer dates</button>
        </PreservedSearchForm>
      </div>

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
