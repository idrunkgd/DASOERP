import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewOpportunityForm } from "./new-opportunity-form";
import { OpportunityCard } from "./opportunity-card";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "NEW", label: "Identifié", color: "bg-midnight-100" },
  { key: "QUALIFIED", label: "Qualifié", color: "bg-blue-50" },
  { key: "PROPOSED", label: "Proposé", color: "bg-amber-50" },
  { key: "NEGOTIATING", label: "Négociation", color: "bg-purple-50" },
  { key: "WON", label: "Gagné", color: "bg-emerald-50" },
  { key: "LOST", label: "Perdu", color: "bg-red-50" }
] as const;

export default async function CrmPage() {
  const session = await requireSession();

  const [opportunities, companies, owners] = await Promise.all([
    prisma.opportunity.findMany({
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ stage: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "COMMERCIAL", "MANAGER"] } },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true }
    })
  ]);

  // KPIs : carnet pondéré (pipeline value) hors WON/LOST
  const openOpps = opportunities.filter((o) => o.stage !== "WON" && o.stage !== "LOST");
  const weightedValue = openOpps.reduce(
    (s, o) => s + (Number(o.estimatedValue) * o.probability) / 100,
    0
  );
  const grossPipeline = openOpps.reduce((s, o) => s + Number(o.estimatedValue), 0);
  const wonYtd = opportunities
    .filter((o) => o.stage === "WON" && o.closedAt && o.closedAt.getUTCFullYear() === new Date().getUTCFullYear())
    .reduce((s, o) => s + Number(o.estimatedValue), 0);
  const winRate = (() => {
    const closed = opportunities.filter((o) => o.stage === "WON" || o.stage === "LOST");
    if (closed.length === 0) return 0;
    const won = closed.filter((o) => o.stage === "WON").length;
    return (won / closed.length) * 100;
  })();

  return (
    <div>
      <PageHeader
        title="CRM — pipeline prospects"
        subtitle="Drag-free kanban : clique sur le menu d'une carte pour la faire avancer"
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Pipeline brut" value={formatCurrency(grossPipeline)} sub={`${openOpps.length} opps ouvertes`} />
        <Kpi
          label="Carnet pondéré"
          value={formatCurrency(weightedValue)}
          sub="Σ (valeur × proba)"
          tone="ok"
        />
        <Kpi label="Gagné YTD" value={formatCurrency(wonYtd)} sub="Cette année" tone="ok" />
        <Kpi label="Taux de conversion" value={`${winRate.toFixed(0)}%`} sub="WON / (WON+LOST)" />
      </div>

      {/* Formulaire de création */}
      <div className="card mb-6">
        <div className="card-header font-semibold">Nouvelle opportunité</div>
        <div className="p-4">
          <NewOpportunityForm
            companies={companies}
            owners={owners.map((u) => ({
              id: u.id,
              label: `${u.firstName} ${u.lastName}`
            }))}
            defaultOwnerId={session.user.id}
          />
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map((s) => {
          const items = opportunities.filter((o) => o.stage === s.key);
          const subTotal = items.reduce((acc, o) => acc + Number(o.estimatedValue), 0);
          return (
            <div key={s.key} className={`rounded-lg ${s.color} flex flex-col min-h-[400px]`}>
              <div className="p-3 border-b border-black/5 flex items-baseline justify-between">
                <div className="font-semibold text-sm">{s.label}</div>
                <div className="text-[10px] text-midnight-500">
                  {items.length} · {formatCurrency(subTotal)}
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {items.length === 0 ? (
                  <div className="text-center text-xs text-midnight-400 py-4">—</div>
                ) : (
                  items.map((o) => (
                    <OpportunityCard
                      key={o.id}
                      opp={{
                        id: o.id,
                        title: o.title,
                        stage: o.stage,
                        estimatedValue: Number(o.estimatedValue),
                        probability: o.probability,
                        companyName: o.company?.name ?? o.prospectName ?? null,
                        ownerName: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : null,
                        expectedCloseAt: o.expectedCloseAt ? formatDate(o.expectedCloseAt) : null,
                        lostReason: o.lostReason
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok";
}) {
  const color = tone === "ok" ? "text-emerald-700" : "text-midnight-900";
  return (
    <div className="card p-4">
      <div className="text-xs text-midnight-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-midnight-400 mt-0.5">{sub}</div>}
    </div>
  );
}
