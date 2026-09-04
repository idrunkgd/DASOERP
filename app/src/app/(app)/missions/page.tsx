import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Plane } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planifiée", ACTIVE: "Active", EXTENDED: "Prolongée",
  COMPLETED: "Terminée", CANCELLED: "Annulée", ON_HOLD: "En pause"
};
const STATUS_TONES: Record<string, string> = {
  PLANNED: "badge-info", ACTIVE: "badge-success", EXTENDED: "badge-success",
  COMPLETED: "badge-neutral", CANCELLED: "badge-danger", ON_HOLD: "badge-warning"
};

export default async function MissionsPage({ searchParams }: { searchParams: { q?: string; status?: string; consultantId?: string; companyId?: string; intermediaryCompanyId?: string } }) {
  const session = await requirePermission(["consulting.read", "self.read"]);
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const hasGlobalRead = perms.includes("consulting.read");
  const canWrite = perms.includes("consulting.write");
  const canViewPrices = perms.includes("finance.view_prices");
  const statuses = parseMulti(searchParams.status);
  const consultantIds = parseMulti(searchParams.consultantId);
  const companyIds = parseMulti(searchParams.companyId);
  const intermediaryIds = parseMulti(searchParams.intermediaryCompanyId);
  const where: any = {};
  if (statuses.length > 0) where.status = inFilter(statuses);
  else where.status = { in: ["PLANNED","ACTIVE","EXTENDED","ON_HOLD"] };
  const consultantFilter = inFilter(consultantIds);
  if (consultantFilter) where.consultantId = consultantFilter;
  const companyFilter = inFilter(companyIds);
  if (companyFilter) where.companyId = companyFilter;
  const intermediaryFilter = inFilter(intermediaryIds);
  if (intermediaryFilter) where.intermediaryCompanyId = intermediaryFilter;
  if (searchParams.q) where.OR = [
    { title: { contains: searchParams.q, mode: "insensitive" } },
    { reference: { contains: searchParams.q, mode: "insensitive" } }
  ];
  // Filtre "ses missions uniquement" si l'utilisateur n'a pas la vue globale
  // (soit qu'il a self.read au lieu de consulting.read, soit qu'il n'a pas consulting.write)
  if (!hasGlobalRead || !canWrite) where.consultantId = session.user.id;
  const list = await prisma.mission.findMany({
    where,
    include: { consultant: true, company: true, intermediaryCompany: true, missionRequest: { select: { reference: true } } },
    orderBy: [{ status: "asc" }, { endDate: "asc" }]
  });
  const [companies, consultants, intermediaries] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    // Liste des sociétés qui apparaissent comme intermédiaire au moins une fois
    prisma.company.findMany({
      where: { OR: [{ intermediaryMissions: { some: {} } }, { intermediaryRequests: { some: {} } }] },
      orderBy: { name: "asc" }, select: { id: true, name: true }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Missions T&M (consultants placés)"
        subtitle={`${list.length} mission(s) — distinct du module Projets (forfait)`}
      />
      <div className="mb-4 space-y-3">
        <FilterChips
          paramName="status"
          label="Statut"
          options={[
            { value: "PLANNED",   label: "Planifiée",  tone: "info" },
            { value: "ACTIVE",    label: "Active",     tone: "success" },
            { value: "EXTENDED",  label: "Prolongée",  tone: "success" },
            { value: "ON_HOLD",   label: "En pause",   tone: "warning" },
            { value: "COMPLETED", label: "Terminée",   tone: "neutral" },
            { value: "CANCELLED", label: "Annulée",    tone: "danger" }
          ]}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">Filtres</span>
          <FilterMultiSelect
            paramName="consultantId"
            label="Consultant"
            options={consultants.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
            placeholder="Chercher un consultant…"
          />
          <FilterMultiSelect
            paramName="companyId"
            label="Client"
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Chercher un client…"
          />
          {intermediaries.length > 0 && (
            <FilterMultiSelect
              paramName="intermediaryCompanyId"
              label="Portage"
              options={intermediaries.map(c => ({ value: c.id, label: c.name }))}
              placeholder="Chercher une société de portage…"
            />
          )}
        </div>
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Réf, titre..." className="input max-w-xs text-sm" />
          <button className="btn-secondary btn-sm">Rechercher</button>
        </PreservedSearchForm>
      </div>

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={Plane} title="Aucune mission" description="Les missions sont créées depuis les demandes de mission après sélection d'un candidat." /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr>
              <th>Réf</th><th>Titre</th><th>Consultant</th><th>Client</th>
              <th>Du</th><th>Au</th>
              {canViewPrices && <th className="text-right">Tarif</th>}
              <th>Statut</th><th>Demande</th>
            </tr></thead>
            <tbody>
              {list.map(m => (
                <tr key={m.id}>
                  <td className="font-mono text-xs"><Link href={`/missions/${m.id}`} className="hover:underline font-medium">{m.reference}</Link></td>
                  <td><Link href={`/missions/${m.id}`} className="hover:underline">{m.title}</Link></td>
                  <td className="text-midnight-700">{m.consultant ? `${m.consultant.firstName} ${m.consultant.lastName}` : <span className="text-amber-700 text-xs">— non assignée —</span>}</td>
                  <td>
                    <Link href={`/companies/${m.companyId}`} className="hover:underline text-midnight-700">{m.company.name}</Link>
                    {m.intermediaryCompany && (
                      <div className="text-xs text-midnight-500">
                        via <Link href={`/companies/${m.intermediaryCompany.id}`} className="hover:underline">{m.intermediaryCompany.name}</Link>
                      </div>
                    )}
                  </td>
                  <td className="text-xs">{formatDate(m.startDate)}</td>
                  <td className="text-xs">{formatDate(m.actualEndDate ?? m.endDate)}{m.actualEndDate && <span className="text-midnight-400"> (réel)</span>}</td>
                  {canViewPrices && <td className="text-right tabular-nums">{formatCurrency(m.dailyRate)}/j</td>}
                  <td><span className={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</span></td>
                  <td className="text-xs"><Link href={`/mission-requests/${m.missionRequestId}`} className="text-indigoaccent hover:underline">{m.missionRequest.reference}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
