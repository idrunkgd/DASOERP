import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewOpportunityForm } from "./new-opportunity-form";
import { OpportunityCard } from "./opportunity-card";
import { Lightbulb, Headset, FolderKanban, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "NEW", label: "Identifié", color: "bg-midnight-100" },
  { key: "QUALIFIED", label: "Qualifié", color: "bg-blue-50" },
  { key: "PROPOSED", label: "Proposé", color: "bg-amber-50" },
  { key: "NEGOTIATING", label: "Négociation", color: "bg-purple-50" },
  { key: "WON", label: "Gagné", color: "bg-emerald-50" },
  { key: "LOST", label: "Perdu", color: "bg-red-50" }
] as const;

type Stage = (typeof STAGES)[number]["key"];

// Item unifié pour le kanban — opportunity, mission request, ou project
type UnifiedItem = {
  id: string;
  kind: "opportunity" | "mission-request" | "project";
  title: string;
  companyName: string | null;
  ownerName: string | null;
  estimatedValue: number;
  probability: number;
  stage: Stage;
  expectedCloseAt: string | null;
  lostReason: string | null;
  href: string; // lien direct vers le détail (mission-request, project) ou null pour opp (édité inline)
};

// Mapping : statut MissionRequest → stage CRM
function missionRequestToStage(status: string): Stage | null {
  switch (status) {
    case "NEW":
      return "NEW";
    case "QUALIFYING":
      return "QUALIFIED";
    case "PRESENTING":
      return "PROPOSED";
    case "CONTRACTED":
      return "WON";
    case "LOST":
      return "LOST";
    case "CANCELLED":
      return "LOST";
    default:
      return null;
  }
}

// Mapping : statut Project → stage CRM (les projets sont déjà engagés, donc WON ou LOST)
function projectToStage(status: string): Stage | null {
  switch (status) {
    case "TO_START":
    case "ACTIVE":
    case "ON_HOLD":
    case "COMPLETED":
      return "WON";
    case "CANCELLED":
      return "LOST";
    default:
      return null;
  }
}

export default async function CrmPage() {
  const session = await requireSession();

  const [opportunities, missionRequests, projects, companies, owners] = await Promise.all([
    prisma.opportunity.findMany({
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ stage: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.missionRequest.findMany({
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.project.findMany({
      include: {
        company: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
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

  // Construction de la liste unifiée
  const unified: UnifiedItem[] = [];

  for (const o of opportunities) {
    unified.push({
      id: o.id,
      kind: "opportunity",
      title: o.title,
      companyName: o.company?.name ?? o.prospectName ?? null,
      ownerName: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : null,
      estimatedValue: Number(o.estimatedValue),
      probability: o.probability,
      stage: o.stage as Stage,
      expectedCloseAt: o.expectedCloseAt ? formatDate(o.expectedCloseAt) : null,
      lostReason: o.lostReason,
      href: ""
    });
  }

  for (const r of missionRequests) {
    const stage = missionRequestToStage(r.status);
    if (!stage) continue;
    // Valeur estimée = TJM × jours estimés
    const value =
      r.targetDailyRate && r.estimatedDays
        ? Number(r.targetDailyRate) * r.estimatedDays
        : 0;
    unified.push({
      id: r.id,
      kind: "mission-request",
      title: `${r.reference} — ${r.title}`,
      companyName: r.company?.name ?? null,
      ownerName: r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : null,
      estimatedValue: value,
      probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : 50,
      stage,
      expectedCloseAt: r.startDate ? formatDate(r.startDate) : null,
      lostReason: r.lostReason,
      href: `/mission-requests/${r.id}`
    });
  }

  for (const p of projects) {
    const stage = projectToStage(p.status);
    if (!stage) continue;
    unified.push({
      id: p.id,
      kind: "project",
      title: `${p.reference} — ${p.name}`,
      companyName: p.company?.name ?? null,
      ownerName: p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : null,
      estimatedValue: Number(p.budgetSell),
      probability: stage === "WON" ? 100 : 0,
      stage,
      expectedCloseAt: p.plannedStart ? formatDate(p.plannedStart) : null,
      lostReason: null,
      href: `/projects/${p.id}`
    });
  }

  // KPIs : carnet pondéré (pipeline value) hors WON/LOST — sur les opportunities pures
  // car les MissionRequest/Project ont leur propre cycle de vie
  const openOpps = opportunities.filter((o) => o.stage !== "WON" && o.stage !== "LOST");
  const weightedValue = openOpps.reduce(
    (s, o) => s + (Number(o.estimatedValue) * o.probability) / 100,
    0
  );
  const grossPipeline = openOpps.reduce((s, o) => s + Number(o.estimatedValue), 0);
  const wonYtd = unified
    .filter(
      (u) =>
        u.stage === "WON" &&
        // pour les opportunities, on filtre par closedAt ; pour les autres, on prend tout
        (u.kind !== "opportunity" ||
          opportunities.find(
            (o) => o.id === u.id && o.closedAt && o.closedAt.getUTCFullYear() === new Date().getUTCFullYear()
          ))
    )
    .reduce((s, u) => s + u.estimatedValue, 0);
  const winRate = (() => {
    const closedOpps = opportunities.filter((o) => o.stage === "WON" || o.stage === "LOST");
    if (closedOpps.length === 0) return 0;
    const won = closedOpps.filter((o) => o.stage === "WON").length;
    return (won / closedOpps.length) * 100;
  })();

  // Compteurs par type pour info
  const counts = {
    opportunity: unified.filter((u) => u.kind === "opportunity").length,
    "mission-request": unified.filter((u) => u.kind === "mission-request").length,
    project: unified.filter((u) => u.kind === "project").length
  };

  return (
    <div>
      <PageHeader
        title="CRM — pipeline global"
        subtitle="Opportunités, demandes de mission (consultance) et projets (forfait) dans un seul tableau"
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Pipeline brut (opps)"
          value={formatCurrency(grossPipeline)}
          sub={`${openOpps.length} opps ouvertes`}
        />
        <Kpi
          label="Carnet pondéré (opps)"
          value={formatCurrency(weightedValue)}
          sub="Σ (valeur × proba)"
          tone="ok"
        />
        <Kpi label="Gagné YTD" value={formatCurrency(wonYtd)} sub="Tous types confondus" tone="ok" />
        <Kpi label="Taux conversion opps" value={`${winRate.toFixed(0)}%`} sub="WON / (WON+LOST)" />
      </div>

      {/* Légende */}
      <div className="card p-3 mb-6 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span className="text-midnight-500 font-medium">Légende :</span>
        <span className="flex items-center gap-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Opportunité ({counts.opportunity})
        </span>
        <span className="flex items-center gap-1">
          <Headset className="w-3.5 h-3.5 text-blue-500" />
          Demande mission ({counts["mission-request"]})
        </span>
        <span className="flex items-center gap-1">
          <FolderKanban className="w-3.5 h-3.5 text-violet-500" />
          Projet forfait ({counts.project})
        </span>
      </div>

      {/* Formulaire de création d'opportunité */}
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
          const items = unified.filter((u) => u.stage === s.key);
          const subTotal = items.reduce((acc, u) => acc + u.estimatedValue, 0);
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
                  items.map((item) =>
                    item.kind === "opportunity" ? (
                      <div key={`opp-${item.id}`} className="relative">
                        <KindBadge kind={item.kind} />
                        <OpportunityCard
                          opp={{
                            id: item.id,
                            title: item.title,
                            stage: item.stage,
                            estimatedValue: item.estimatedValue,
                            probability: item.probability,
                            companyName: item.companyName,
                            ownerName: item.ownerName,
                            expectedCloseAt: item.expectedCloseAt,
                            lostReason: item.lostReason
                          }}
                        />
                      </div>
                    ) : (
                      <ReadOnlyCard key={`${item.kind}-${item.id}`} item={item} />
                    )
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Badge en haut à droite des cartes Opportunity (icône Lightbulb)
function KindBadge({ kind }: { kind: UnifiedItem["kind"] }) {
  const Icon = kind === "opportunity" ? Lightbulb : kind === "mission-request" ? Headset : FolderKanban;
  const color =
    kind === "opportunity"
      ? "text-amber-500"
      : kind === "mission-request"
        ? "text-blue-500"
        : "text-violet-500";
  return (
    <Icon
      className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${color} z-10`}
      aria-label={kind}
    />
  );
}

// Carte read-only pour MissionRequest / Project — pas de boutons d'avancement
// (l'utilisateur les édite sur leur page propre)
function ReadOnlyCard({ item }: { item: UnifiedItem }) {
  const Icon =
    item.kind === "mission-request" ? Headset : FolderKanban;
  const color =
    item.kind === "mission-request" ? "text-blue-500" : "text-violet-500";
  const borderColor =
    item.kind === "mission-request"
      ? "border-blue-200"
      : "border-violet-200";
  return (
    <Link
      href={item.href}
      className={`block bg-white rounded-md shadow-sm border ${borderColor} p-2.5 text-xs space-y-1.5 hover:shadow-md transition-shadow relative`}
    >
      <Icon
        className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${color}`}
        aria-label={item.kind}
      />
      <div className="font-medium text-midnight-900 pr-4">{item.title}</div>
      {item.companyName && <div className="text-[11px] text-midnight-600">{item.companyName}</div>}
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-midnight-800">
          {formatCurrency(item.estimatedValue)}
        </span>
        {item.expectedCloseAt && (
          <span className="text-midnight-500">{item.expectedCloseAt}</span>
        )}
      </div>
      {item.ownerName && (
        <div className="text-[10px] text-midnight-500">Owner : {item.ownerName}</div>
      )}
      <div className="flex items-center justify-end text-[10px] text-midnight-400 pt-1 border-t border-midnight-100">
        Voir <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
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
