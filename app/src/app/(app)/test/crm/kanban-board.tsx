"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Headset,
  FolderKanban,
  ChevronRight,
  ChevronLeft,
  Trash2,
  X,
  Ban,
  Loader2,
  GripVertical,
  FileText
} from "lucide-react";
import { moveCardStage, deleteOpportunity } from "@/server/actions/opportunities";
import { formatCurrency } from "@/lib/utils";

export type Stage =
  | "NEW"
  | "QUALIFIED"
  | "PROPOSED"
  | "NEGOTIATING"
  | "WON"
  | "LOST"
  | "CANCELLED";

export type BusinessType = "CONSULTING" | "PROJECT";
export type SourceKind = "opportunity" | "mission-request" | "offer" | "project";

export type KanbanItem = {
  id: string;
  source: SourceKind;
  businessType: BusinessType;
  title: string;
  companyName: string | null;
  ownerName: string | null;
  estimatedValue: number;
  probability: number;
  stage: Stage;
  expectedCloseAt: string | null;
  lostReason: string | null;
  href: string;
};

export const STAGES: { key: Stage; label: string; color: string; hiddenByDefault: boolean }[] = [
  { key: "NEW", label: "Identifié", color: "bg-midnight-100", hiddenByDefault: false },
  { key: "QUALIFIED", label: "Qualifié", color: "bg-blue-50", hiddenByDefault: false },
  { key: "PROPOSED", label: "Proposé", color: "bg-amber-50", hiddenByDefault: false },
  { key: "NEGOTIATING", label: "Négociation", color: "bg-purple-50", hiddenByDefault: false },
  { key: "WON", label: "Gagné", color: "bg-emerald-50", hiddenByDefault: false },
  { key: "LOST", label: "Perdu", color: "bg-red-50", hiddenByDefault: false },
  { key: "CANCELLED", label: "Annulé", color: "bg-midnight-200", hiddenByDefault: true }
];

const STAGE_ORDER: Stage[] = [
  "NEW",
  "QUALIFIED",
  "PROPOSED",
  "NEGOTIATING",
  "WON",
  "LOST",
  "CANCELLED"
];

export function KanbanBoard({
  items,
  showCancelled
}: {
  items: KanbanItem[];
  showCancelled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hoverStage, setHoverStage] = useState<Stage | null>(null);
  // Optimistic UI : on update localement le stage tant que l'API n'a pas répondu
  const [optimistic, setOptimistic] = useState<Record<string, Stage>>({});

  function effectiveStage(item: KanbanItem): Stage {
    return optimistic[`${item.source}:${item.id}`] ?? item.stage;
  }

  function move(item: KanbanItem, newStage: Stage, reason?: string) {
    if (effectiveStage(item) === newStage) return;
    // CAS SPÉCIAL : passage en WON d'une offre racine → on ouvre le wizard
    // de création de projet plutôt que de marquer en silence. Les compléments
    // utilisent le flow auto via moveCardStage (merge dans projet parent).
    if (item.source === "offer" && newStage === "WON") {
      router.push(`/offers/${item.id}/win`);
      return;
    }
    const key = `${item.source}:${item.id}`;
    setOptimistic((o) => ({ ...o, [key]: newStage }));
    start(async () => {
      try {
        const result = await moveCardStage(item.source, item.id, newStage);
        if (!result.ok) {
          // Rollback explicite : la DB n'a pas accepté le changement
          setOptimistic((o) => {
            const c = { ...o };
            delete c[key];
            return c;
          });
          toast.error(`Échec : ${result.error}`);
          return;
        }
        const stageLabel = STAGES.find((s) => s.key === newStage)?.label ?? newStage;
        toast.success(`${item.title.slice(0, 30)} → ${stageLabel} (${result.after})`);
        router.refresh();
      } catch (e: any) {
        setOptimistic((o) => {
          const c = { ...o };
          delete c[key];
          return c;
        });
        toast.error(e?.message ?? "Erreur réseau");
      }
    });
  }

  function onDragStart(e: React.DragEvent, item: KanbanItem) {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ source: item.source, id: item.id })
    );
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: React.DragEvent, targetStage: Stage) {
    e.preventDefault();
    setHoverStage(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      const data = JSON.parse(raw) as { source: SourceKind; id: string };
      const item = items.find((i) => i.source === data.source && i.id === data.id);
      if (item) move(item, targetStage);
    } catch {
      // ignore — pas un drag interne
    }
  }

  const visibleStages = STAGES.filter((s) => showCancelled || !s.hiddenByDefault);

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 ${
        showCancelled ? "xl:grid-cols-7" : "xl:grid-cols-6"
      } gap-3`}
    >
      {visibleStages.map((s) => {
        const colItems = items.filter((it) => effectiveStage(it) === s.key);
        const subTotal = colItems.reduce((acc, it) => acc + it.estimatedValue, 0);
        const isHover = hoverStage === s.key;
        return (
          <div
            key={s.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setHoverStage(s.key);
            }}
            onDragLeave={() => setHoverStage((curr) => (curr === s.key ? null : curr))}
            onDrop={(e) => onDrop(e, s.key)}
            className={`rounded-lg ${s.color} flex flex-col min-h-[400px] transition-shadow ${
              isHover ? "ring-2 ring-indigoaccent shadow-md" : ""
            }`}
          >
            <div className="p-3 border-b border-black/5 flex items-baseline justify-between">
              <div className="font-semibold text-sm">{s.label}</div>
              <div className="text-[10px] text-midnight-500">
                {colItems.length} · {formatCurrency(subTotal)}
              </div>
            </div>
            <div className="p-2 space-y-2 flex-1">
              {colItems.length === 0 ? (
                <div className="text-center text-xs text-midnight-400 py-4">—</div>
              ) : (
                colItems.map((item) => (
                  <KanbanCard
                    key={`${item.source}-${item.id}`}
                    item={{ ...item, stage: effectiveStage(item) }}
                    pending={pending}
                    onMove={move}
                    onDragStart={onDragStart}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  item,
  pending,
  onMove,
  onDragStart
}: {
  item: KanbanItem;
  pending: boolean;
  onMove: (item: KanbanItem, newStage: Stage, reason?: string) => void;
  onDragStart: (e: React.DragEvent, item: KanbanItem) => void;
}) {
  const Icon = item.businessType === "CONSULTING" ? Headset : FolderKanban;
  const iconColor = item.businessType === "CONSULTING" ? "text-blue-500" : "text-violet-500";
  const borderColor =
    item.businessType === "CONSULTING" ? "border-blue-200" : "border-violet-200";

  const idx = STAGE_ORDER.indexOf(item.stage);
  const prevStage = idx > 0 ? STAGE_ORDER[idx - 1] : null;
  const nextStage = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;

  // Petit badge texte pour identifier la source (Affaire / Demande / Devis / Projet)
  const sourceLabel =
    item.source === "opportunity"
      ? "Affaire"
      : item.source === "mission-request"
        ? "Demande"
        : item.source === "offer"
          ? "Devis"
          : "Projet";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (item.source !== "opportunity") {
      toast.info("Seules les affaires créées dans le CRM peuvent être supprimées ici. Pour les autres, va sur leur page de détail.");
      return;
    }
    if (!confirm(`Supprimer « ${item.title} » ?`)) return;
    // deleteOpportunity n'est exporté que par opportunities.ts ; on l'appelle via dynamic import
    import("@/server/actions/opportunities").then((m) => {
      m.deleteOpportunity(item.id)
        .then(() => toast.success("Supprimée"))
        .catch((err) => toast.error(err?.message ?? "Erreur"));
    });
  }

  return (
    <div
      draggable={!pending}
      onDragStart={(e) => onDragStart(e, item)}
      className={`group bg-white rounded-md shadow-sm border ${borderColor} p-2.5 text-xs space-y-1.5 relative cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <GripVertical className="absolute top-1.5 left-0.5 w-3 h-3 text-midnight-300 opacity-0 group-hover:opacity-100" />
      <Icon
        className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 ${iconColor}`}
        aria-label={item.businessType}
      />

      <div className="flex items-baseline gap-2 pr-4 pl-3">
        <span className="text-[9px] uppercase tracking-wider text-midnight-400 font-semibold">
          {sourceLabel}
        </span>
        {item.source === "offer" && <FileText className="w-3 h-3 text-midnight-400" />}
      </div>

      {item.href ? (
        <Link href={item.href} className="block pl-3 font-medium text-midnight-900 pr-4 hover:underline">
          {item.title}
        </Link>
      ) : (
        <div className="pl-3 font-medium text-midnight-900 pr-4">{item.title}</div>
      )}

      {item.companyName && (
        <div className="pl-3 text-[11px] text-midnight-600">{item.companyName}</div>
      )}
      <div className="pl-3 flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-midnight-800">
          {formatCurrency(item.estimatedValue)}
        </span>
        {item.expectedCloseAt && (
          <span className="text-midnight-500">{item.expectedCloseAt}</span>
        )}
      </div>
      {item.ownerName && (
        <div className="pl-3 text-[10px] text-midnight-500">Owner : {item.ownerName}</div>
      )}
      {item.lostReason && (
        <div
          className={`pl-3 text-[10px] ${
            item.stage === "CANCELLED" ? "text-midnight-500" : "text-red-600"
          }`}
        >
          {item.stage === "CANCELLED" ? "Annulé" : "Perdu"} : {item.lostReason}
        </div>
      )}

      {/* Barre d'actions (flèches mobile + perdu/annulé + suppression) */}
      <div className="flex items-center justify-between pt-1 border-t border-midnight-100 pl-1">
        <div className="flex gap-0.5">
          <button
            className="p-1 rounded hover:bg-midnight-100 text-midnight-600 disabled:opacity-30"
            title={prevStage ? `← ${STAGES.find((s) => s.key === prevStage)?.label}` : "—"}
            disabled={!prevStage || pending}
            onClick={() => prevStage && onMove(item, prevStage)}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1 rounded hover:bg-midnight-100 text-midnight-600 disabled:opacity-30"
            title={nextStage ? `→ ${STAGES.find((s) => s.key === nextStage)?.label}` : "—"}
            disabled={!nextStage || pending}
            onClick={() => nextStage && onMove(item, nextStage)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {item.stage !== "LOST" && (
            <button
              className="p-1 rounded hover:bg-red-50 text-red-600 ml-1"
              title="Marquer comme perdu"
              disabled={pending}
              onClick={() => {
                const r = prompt("Raison de la perte ?");
                if (r !== null) onMove(item, "LOST", r);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {item.stage !== "CANCELLED" && (
            <button
              className="p-1 rounded hover:bg-midnight-200 text-midnight-500"
              title="Annuler (différent de perdu)"
              disabled={pending}
              onClick={() => onMove(item, "CANCELLED")}
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {item.source === "opportunity" && (
          <button
            className="p-1 rounded hover:bg-midnight-100 text-midnight-400"
            title="Supprimer"
            disabled={pending}
            onClick={handleDelete}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
