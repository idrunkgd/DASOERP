import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewOpportunityForm } from "./new-opportunity-form";
import { OpportunityCard } from "./opportunity-card";
import { Headset, FolderKanban, ChevronRight, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "NEW", label: "Identifié", color: "bg-midnight-100", hiddenByDefault: false },
  { key: "QUALIFIED", label: "Qualifié", color: "bg-blue-50", hiddenByDefault: false },
  { key: "PROPOSED", label: "Proposé", color: "bg-amber-50", hiddenByDefault: false },
  { key: "NEGOTIATING", label: "Négociation", color: "bg-purple-50", hiddenByDefault: false },
  { key: "WON", label: "Gagné", color: "bg-emerald-50", hiddenByDefault: false },
  { key: "LOST", label: "Perdu", color: "bg-red-50", hiddenByDefault: false },
  { key: "CANCELLED", label: "Annulé", color: "bg-midnight-200", hiddenByDefault: true }
] as const;

type Stage = (typeof STAGES)[number]["key"];
type BusinessType = "CONSULTING" | "PROJECT";

/**
 * Source d'une carte du pipeline. Plusieurs entités peuvent peupler le pipeline :
 *  - "opportunity" : prospect en cours de qualification (table Opportunity)
 *  - "mission-request" : demande client de consultance (table MissionRequest)
 *  - "offer" : devis envoyé/négocié (table Offer)
 *  - "project" : projet en exécution (table Project, mode forfait)
 */
type SourceKind = "opportunity" | "mission-request" | "offer" | "project";

// Item unifié pour le kanban
type UnifiedItem = {
  id: string;
  source: SourceKind;
  /// Type de business : Consultance (T&M) ou Projet (forfait) — c'est l'info montrée à l'utilisateur
  businessType: BusinessType;
  title: string;
  companyName: string | null;
  ownerName: string | null;
  estimatedValue: number;
  probability: number;
  stage: Stage;
  expectedCloseAt: string | null;
  lostReason: string | null;
  /// Lien vers la page de détail (vide pour les opportunités qui sont éditées inline)
  href: string;
};

// Mapping : statut MissionRequest → stage CRM
function missionRequestToStage(status: string): Stage | null {
  switch (status) {
    case "NEW": return "NEW";
    case "QUALIFYING": return "QUALIFIED";
    case "PRESENTING": return "PROPOSED";
    case "CONTRACTED": return "WON";
    case "LOST": return "LOST";
    case "CANCELLED": return "CANCELLED";
    default: return null;
  }
}

// Mapping : statut Offer → stage CRM (DRAFT/SENT/NEGOTIATION/WON/LOST/CANCELLED)
function offerToStage(status: string): Stage | null {
  switch (status) {
    case "DRAFT": return "NEW";
    case "SENT": return "PROPOSED";
    case "NEGOTIATION": return "NEGOTIATING";
    case "WON": return "WON";
    case "LOST": return "LOST";
    case "CANCELLED": return "CANCELLED";
    default: return null;
  }
}

// Mapping : statut Project → stage CRM (les projets sont déjà engagés)
function projectToStage(status: string): Stage | null {
  switch (status) {
    case "TO_START":
    case "ACTIVE":
    case "ON_HOLD":
    case "COMPLETED":
      return "WON";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

export default async function CrmPage({
  searchParams
}: {
  searchParams: { showCancelled?: string };
}) {
  const session = await requireSession();
  const showCancelled = searchParams.showCancelled === "1";

  const [opportunities, missionRequests, offers, projects, companies, contacts, owners] = await Promise.all([
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
    prisma.offer.findMany({
      // On exclut les complements/anciennes versions pour ne pas dupliquer
      where: { parentOfferId: null, nextVersion: null },
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
    prisma.contact.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true, companyId: true,
        firstName: true, lastName: true,
        email: true, phone: true, jobTitle: true
      }
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, role: true }
    })
  ]);

  // Construction de la liste unifiée
  const unified: UnifiedItem[] = [];

  for (const o of opportunities) {
    unified.push({
      id: o.id,
      source: "opportunity",
      businessType: ((o as any).kind ?? "CONSULTING") as BusinessType,
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
    const value =
      r.targetDailyRate && r.estimatedDays
        ? Number(r.targetDailyRate) * r.estimatedDays
        : 0;
    unified.push({
      id: r.id,
      source: "mission-request",
      businessType: "CONSULTING",
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

  for (const offer of offers) {
    const stage = offerToStage(offer.status);
    if (!stage) continue;
    unified.push({
      id: offer.id,
      source: "offer",
      businessType: (offer.mode as BusinessType) ?? "PROJECT",
      title: `${offer.reference} — ${offer.title}`,
      companyName: offer.company?.name ?? null,
      ownerName: offer.owner ? `${offer.owner.firstName} ${offer.owner.lastName}` : null,
      estimatedValue: Number(offer.totalSell),
      probability:
        stage === "WON" ? 100 : stage === "LOST" || stage === "CANCELLED" ? 0 : offer.probability,
      stage,
      expectedCloseAt: offer.expectedDecisionAt ? formatDate(offer.expectedDecisionAt) : null,
      lostReason: null,
      href: `/offers/${offer.id}`
    });
  }

  for (const p of projects) {
    const stage = projectToStage(p.status);
    if (!stage) continue;
    // On évite de doubler avec Offer si le project est lié à un offer déjà compté
    if (p.offerId && offers.some((o) => o.id === p.offerId)) continue;
    unified.push({
      id: p.id,
      source: "project",
      businessType: (p.mode as BusinessType) ?? "PROJECT",
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

  // KPIs sur l'ensemble unifié (hors WON/LOST/CANCELLED)
  const openItems = unified.filter((u) => !["WON", "LOST", "CANCELLED"].includes(u.stage));
  const weightedValue = openItems.reduce(
    (s, u) => s + (u.estimatedValue * u.probability) / 100,
    0
  );
  const grossPipeline = openItems.reduce((s, u) => s + u.estimatedValue, 0);
  const currentYear = new Date().getUTCFullYear();
  const wonYtd = unified
    .filter((u) => u.stage === "WON")
    .reduce((s, u) => s + u.estimatedValue, 0);
  const winRate = (() => {
    const closed = unified.filter((u) => u.stage === "WON" || u.stage === "LOST");
    if (closed.length === 0) return 0;
    const won = closed.filter((u) => u.stage === "WON").length;
    return (won / closed.length) * 100;
  })();

  // Compteurs par type d'affaire (Consultance / Projet)
  const consultingCount = unified.filter((u) => u.businessType === "CONSULTING").length;
  const projectCount = unified.filter((u) => u.businessType === "PROJECT").length;

  return (
    <div>
      <PageHeader
        title="CRM — pipeline commercial"
        subtitle="Affaires de consultance (T&M) et projets (forfait) — toutes sources confondues"
      />

      <div className="grid md:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Pipeline brut"
          value={formatCurrency(grossPipeline)}
          sub={`${openItems.length} affaires ouvertes`}
        />
        <Kpi
          label="Carnet pondéré"
          value={formatCurrency(weightedValue)}
          sub="Σ (valeur × proba)"
          tone="ok"
        />
        <Kpi
          label="Gagné YTD"
          value={formatCurrency(wonYtd)}
          sub="Tous types confondus"
          tone="ok"
        />
        <Kpi
          label="Taux de conversion"
          value={`${winRate.toFixed(0)}%`}
          sub="WON / (WON+LOST)"
        />
      </div>

      {/* Légende — uniquement les deux types business */}
      <div className="card p-3 mb-6 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span className="text-midnight-500 font-medium">Légende :</span>
        <span className="flex items-center gap-1">
          <Headset className="w-3.5 h-3.5 text-blue-500" />
          Consultance (T&M) — {consultingCount}
        </span>
        <span className="flex items-center gap-1">
          <FolderKanban className="w-3.5 h-3.5 text-violet-500" />
          Projet (forfait) — {projectCount}
        </span>
        <span className="ml-auto text-[10px] text-midnight-400">
          Sources : prospects + demandes de mission + devis + projets
        </span>
      </div>

      {/* Formulaire de création — affaire commerciale (Consultance ou Projet) */}
      <div className="card mb-6">
        <div className="card-header font-semibold">Nouvelle affaire</div>
        <div className="p-4">
          <NewOpportunityForm
            companies={companies}
            contacts={contacts}
            owners={owners}
            defaultOwnerId={session.user.id}
          />
        </div>
      </div>

      {/* Toggle affichage du stage CANCELLED */}
      <div className="flex justify-end mb-2">
        {showCancelled ? (
          <Link href="/test/crm" className="text-xs text-midnight-500 hover:text-midnight-900 underline">
            Masquer la colonne « Annulé »
          </Link>
        ) : (
          <Link href="/test/crm?showCancelled=1" className="text-xs text-midnight-500 hover:text-midnight-900 underline">
            Afficher la colonne « Annulé »
            {unified.filter((u) => u.stage === "CANCELLED").length > 0 && (
              <span className="ml-1 text-midnight-400">
                ({unified.filter((u) => u.stage === "CANCELLED").length})
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Kanban */}
      <div className={`grid grid-cols-1 md:grid-cols-3 ${showCancelled ? "xl:grid-cols-7" : "xl:grid-cols-6"} gap-3`}>
        {STAGES.filter((s) => showCancelled || !s.hiddenByDefault).map((s) => {
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
                    item.source === "opportunity" ? (
                      <div key={`opp-${item.id}`} className="relative">
                        <TypeBadge businessType={item.businessType} source={item.source} />
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
                      <ReadOnlyCard key={`${item.source}-${item.id}`} item={item} />
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

// Badge en haut à droite des cartes — basé sur le type d'affaire
function TypeBadge({
  businessType,
  source
}: {
  businessType: BusinessType;
  source: SourceKind;
}) {
  const Icon = businessType === "CONSULTING" ? Headset : FolderKanban;
  const color = businessType === "CONSULTING" ? "text-blue-500" : "text-violet-500";
  return (
    <Icon
      className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${color} z-10`}
      aria-label={`${businessType.toLowerCase()}-${source}`}
    />
  );
}

// Carte read-only pour MissionRequest / Offer / Project — pas de boutons d'avancement
function ReadOnlyCard({ item }: { item: UnifiedItem }) {
  const Icon = item.businessType === "CONSULTING" ? Headset : FolderKanban;
  const color = item.businessType === "CONSULTING" ? "text-blue-500" : "text-violet-500";
  const borderColor = item.businessType === "CONSULTING" ? "border-blue-200" : "border-violet-200";
  // Petit badge texte pour identifier la source (Demande / Devis / Projet)
  const sourceLabel =
    item.source === "mission-request"
      ? "Demande"
      : item.source === "offer"
        ? "Devis"
        : "Projet";
  return (
    <Link
      href={item.href}
      className={`block bg-white rounded-md shadow-sm border ${borderColor} p-2.5 text-xs space-y-1.5 hover:shadow-md transition-shadow relative`}
    >
      <Icon className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${color}`} aria-label={item.businessType} />
      <div className="flex items-baseline gap-2 pr-4">
        <span className="text-[9px] uppercase tracking-wider text-midnight-400 font-semibold">
          {sourceLabel}
        </span>
        {item.source === "offer" && <FileText className="w-3 h-3 text-midnight-400" />}
      </div>
      <div className="font-medium text-midnight-900 pr-4">{item.title}</div>
      {item.companyName && <div className="text-[11px] text-midnight-600">{item.companyName}</div>}
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-midnight-800">{formatCurrency(item.estimatedValue)}</span>
        {item.expectedCloseAt && <span className="text-midnight-500">{item.expectedCloseAt}</span>}
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
