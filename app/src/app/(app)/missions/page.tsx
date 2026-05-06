import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Plane } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  await requirePermission("consulting.read");
  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;
  else where.status = { in: ["PLANNED","ACTIVE","EXTENDED","ON_HOLD"] };
  if (searchParams.consultantId) where.consultantId = searchParams.consultantId;
  if (searchParams.companyId) where.companyId = searchParams.companyId;
  if (searchParams.intermediaryCompanyId) where.intermediaryCompanyId = searchParams.intermediaryCompanyId;
  if (searchParams.q) where.OR = [
    { title: { contains: searchParams.q, mode: "insensitive" } },
    { reference: { contains: searchParams.q, mode: "insensitive" } }
  ];
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
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Réf, titre..." className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[200px]">
          <option value="">En cours (par défaut)</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="consultantId" defaultValue={searchParams.consultantId ?? ""} className="input max-w-[220px]">
          <option value="">Tous consultants</option>
          {consultants.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
        </select>
        <select name="companyId" defaultValue={searchParams.companyId ?? ""} className="input max-w-[220px]">
          <option value="">Tous clients</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="intermediaryCompanyId" defaultValue={searchParams.intermediaryCompanyId ?? ""} className="input max-w-[220px]">
          <option value="">Tous portages</option>
          <option value="__none__" disabled>(missions directes uniquement : utiliser filtre)</option>
          {intermediaries.map(c => <option key={c.id} value={c.id}>via {c.name}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={Plane} title="Aucune mission" description="Les missions sont créées depuis les demandes de mission après sélection d'un candidat." /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead><tr>
              <th>Réf</th><th>Titre</th><th>Consultant</th><th>Client</th>
              <th>Du</th><th>Au</th>
              <th className="text-right">Tarif</th><th>Statut</th><th>Demande</th>
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
                  <td className="text-right tabular-nums">{formatCurrency(m.dailyRate)}/j</td>
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
