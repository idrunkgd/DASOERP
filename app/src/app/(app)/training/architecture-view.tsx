"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GraduationCap, CheckCircle2, PlayCircle, EyeOff, Lock, Cloud, Layers, Server, Cpu, Zap, GripVertical, Compass } from "lucide-react";
import { ToggleCourseVisibility } from "./toggle-visibility";
import { DeleteCourse } from "./delete-course";
import { PrerequisiteManager } from "./prerequisite-manager";
import { setCourseLayer } from "@/server/actions/training";

type CourseCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  active: boolean;
  slideCount: number;
  layerKey: string | null;
  prerequisiteCourse: { id: string; title: string } | null;
  progressPct: number;
  completed: boolean;
  locked: boolean;
};

type LayerConfig = {
  key: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  iconColor: string;
  defaultSlugs: string[];
  extraSystems: string[];
};

// Mapping par défaut : appliqué SI layerKey est null en base.
// Une fois que l'admin a fait un drag-drop, le champ layerKey en base prend le dessus.
//
// Note : la couche "transversal" s'applique à TOUTES les couches — normes, validation,
// méthodo, cybersécurité — et n'a pas de niveau Purdue. Visuellement distincte (dashed).
const LAYERS: LayerConfig[] = [
  {
    key: "transversal",
    label: "Transversal · Normes · Validation · Cybersécurité",
    sub: "S'applique à toutes les couches — ISA-95, ISA-88, GAMP 5, 21 CFR Part 11, IEC 62443, méthodologie projet",
    icon: <Compass className="w-5 h-5" />,
    gradient: "from-slate-500/10 to-neutral-500/10",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    defaultSlugs: [],
    extraSystems: ["ISA-95 · ISA-88", "GAMP 5 · 21 CFR Part 11", "IEC 62443", "Change management", "Documentation", "Audit trail"]
  },
  {
    key: "cloud",
    label: "Niveau 5 · Cloud & IT Entreprise",
    sub: "ERP · Data lake · BI · Cybersécurité",
    icon: <Cloud className="w-5 h-5" />,
    gradient: "from-sky-500/10 to-indigo-500/10",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    defaultSlugs: [],
    extraSystems: ["ERP (SAP, Odoo)", "Cloud (AWS, Azure)", "BI (Power BI)"]
  },
  {
    key: "mes",
    label: "Niveau 4 · MES / Data / Reporting",
    sub: "Traçabilité batch · Historian · Reporting · Data warehouse",
    icon: <Server className="w-5 h-5" />,
    gradient: "from-indigo-500/10 to-purple-500/10",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    defaultSlugs: ["aveva-report", "sql-server"],
    extraSystems: ["MES", "AVEVA Historian", "Batch Management"]
  },
  {
    key: "uns",
    label: "Niveau 3 · UNS · Data broker",
    sub: "Unified Namespace · MQTT · OPC UA · pont OT ↔ IT",
    icon: <Layers className="w-5 h-5" />,
    gradient: "from-purple-500/10 to-fuchsia-500/10",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    defaultSlugs: ["highbyte", "hivemq"],
    extraSystems: ["HighByte Intelligence Hub", "HiveMQ Broker", "OPC UA"]
  },
  {
    key: "scada",
    label: "Niveau 2 · Supervision SCADA / HMI",
    sub: "Vue synoptique · Alarmes · Recettes · Interface opérateur",
    icon: <Server className="w-5 h-5" />,
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    defaultSlugs: ["wincc-scada"],
    extraSystems: ["AVEVA System Platform", "Ignition", "iFIX"]
  },
  {
    key: "control",
    label: "Niveau 1 · Contrôle · PLC · Programmation",
    sub: "Automate · Logique · Cycle de scan · Communication terrain",
    icon: <Cpu className="w-5 h-5" />,
    gradient: "from-amber-500/10 to-orange-500/10",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    defaultSlugs: ["materiel-plc-siemens", "programmation-tia-portal"],
    extraSystems: ["Rockwell / Allen-Bradley", "Schneider Modicon", "Beckhoff TwinCAT"]
  },
  {
    key: "field",
    label: "Niveau 0 · Terrain · Élec · Process",
    sub: "Sécurité électrique · Capteurs · Actionneurs · Cabinet",
    icon: <Zap className="w-5 h-5" />,
    gradient: "from-rose-500/10 to-red-500/10",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    defaultSlugs: ["ba4-securite-electrique", "ba5-securite-electrique"],
    extraSystems: ["Armoires électriques", "Variateurs Sinamics", "Capteurs / Actionneurs"]
  }
];

const DEFAULT_LAYER = "field";

/** Calcule la couche effective d'un cours : layerKey base si défini, sinon mapping slug, sinon default. */
function effectiveLayer(c: CourseCard): string {
  if (c.layerKey) return c.layerKey;
  const layer = LAYERS.find((l) => l.defaultSlugs.includes(c.slug));
  return layer?.key ?? DEFAULT_LAYER;
}

function CourseCardView({
  c,
  canManage,
  allCourses,
  onDragStart
}: {
  c: CourseCard;
  canManage: boolean;
  allCourses: { id: string; title: string }[];
  onDragStart: (courseId: string) => void;
}) {
  const dimClass = !c.active ? "opacity-60" : c.locked ? "opacity-75" : "";
  return (
    <div
      className="relative group"
      draggable={canManage}
      onDragStart={(e) => {
        if (!canManage) return;
        e.dataTransfer.setData("text/course-id", c.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(c.id);
      }}
    >
      {/* Barre d'actions admin — JAMAIS dimmée (positionnée en dehors du Link dimmable) */}
      {canManage && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-0.5 opacity-100">
          <PrerequisiteManager
            courseId={c.id}
            courseTitle={c.title}
            currentPrerequisiteId={c.prerequisiteCourse?.id ?? null}
            currentPrerequisiteTitle={c.prerequisiteCourse?.title ?? null}
            allCourses={allCourses}
          />
          <ToggleCourseVisibility courseId={c.id} active={c.active} />
          <DeleteCourse
            courseId={c.id}
            courseTitle={c.title}
            courseSlug={c.slug}
            slideCount={c.slideCount}
          />
        </div>
      )}
      {/* Handle drag-drop (visible admin only, au hover) */}
      {canManage && (
        <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-midnight-400">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Card content — dimmable selon état */}
      <Link
        href={`/training/${c.slug}`}
        className={
          "block rounded-xl border border-border bg-white hover:shadow-md hover:border-indigoaccent/40 transition-all p-4 h-full " +
          dimClass
        }
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigoaccent/10 text-indigoaccent flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 pr-14">
            <h3 className="text-sm font-semibold text-midnight-900 hover:text-indigoaccent transition-colors flex items-center gap-1.5 line-clamp-2">
              {c.title}
              {!c.active && <EyeOff className="w-3 h-3 text-midnight-400 flex-shrink-0" />}
              {c.locked && <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />}
            </h3>
            {c.subtitle && <p className="text-[11px] text-midnight-500 mt-0.5 line-clamp-2">{c.subtitle}</p>}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-midnight-500">{c.slideCount} slides</span>
          {c.locked && c.prerequisiteCourse ? (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <Lock className="w-3 h-3" /> {c.prerequisiteCourse.title}
            </span>
          ) : c.completed ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Terminé
            </span>
          ) : c.progressPct > 0 ? (
            <span className="text-midnight-600 font-medium">{c.progressPct}%</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-indigoaccent font-medium">
              <PlayCircle className="w-3 h-3" /> Commencer
            </span>
          )}
        </div>

        {!c.locked && c.progressPct > 0 && !c.completed && (
          <div className="mt-2 h-1 rounded-full bg-midnight-100 overflow-hidden">
            <div className="h-full bg-indigoaccent" style={{ width: `${c.progressPct}%` }} />
          </div>
        )}
      </Link>
    </div>
  );
}

function LayerRow({
  layer,
  courses,
  canManage,
  allCourses,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart
}: {
  layer: LayerConfig;
  courses: CourseCard[];
  canManage: boolean;
  allCourses: { id: string; title: string }[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent, layerKey: string) => void;
  onDragLeave: (layerKey: string) => void;
  onDrop: (e: React.DragEvent, layerKey: string) => void;
  onDragStart: (courseId: string) => void;
}) {
  return (
    <section
      className={
        `rounded-2xl bg-gradient-to-r ${layer.gradient} p-5 mb-4 relative overflow-hidden transition-all ` +
        (isDragOver && canManage
          ? "border-2 border-indigoaccent ring-4 ring-indigoaccent/20 scale-[1.005]"
          : layer.key === "transversal"
            ? "border-2 border-dashed border-slate-400"
            : "border border-border")
      }
      onDragOver={(e) => canManage && onDragOver(e, layer.key)}
      onDragLeave={() => canManage && onDragLeave(layer.key)}
      onDrop={(e) => canManage && onDrop(e, layer.key)}
    >
      {/* Header couche */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl ${layer.iconBg} ${layer.iconColor} flex items-center justify-center flex-shrink-0`}>
          {layer.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-midnight-900">{layer.label}</h2>
          <p className="text-xs text-midnight-600 mt-0.5">{layer.sub}</p>
          {layer.extraSystems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {layer.extraSystems.map((sys) => (
                <span key={sys} className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-midnight-500 border border-midnight-200">
                  {sys}
                </span>
              ))}
            </div>
          )}
        </div>
        {isDragOver && canManage && (
          <div className="text-xs font-bold text-indigoaccent">Déposer ici ↓</div>
        )}
      </div>

      {/* Formations de la couche */}
      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-midnight-300 bg-white/40 p-4 text-center text-xs text-midnight-500 italic">
          {canManage ? "Glisse une formation ici depuis une autre couche" : "Aucune formation Dasolabs sur cette couche pour l'instant."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCardView
              key={c.id}
              c={c}
              canManage={canManage}
              allCourses={allCourses}
              onDragStart={onDragStart}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ArchitectureView({
  courses,
  canManage,
  allCourses
}: {
  courses: CourseCard[];
  canManage: boolean;
  allCourses: { id: string; title: string }[];
}) {
  const [dragOverLayer, setDragOverLayer] = useState<string | null>(null);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Distribuer les cours dans les couches selon layerKey base (ou mapping par défaut)
  const layerCourses = new Map<string, CourseCard[]>();
  LAYERS.forEach((l) => layerCourses.set(l.key, []));
  courses.forEach((c) => {
    const key = effectiveLayer(c);
    (layerCourses.get(key) ?? layerCourses.get(DEFAULT_LAYER)!).push(c);
  });

  function handleDragOver(e: React.DragEvent, layerKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverLayer !== layerKey) setDragOverLayer(layerKey);
  }
  function handleDragLeave(layerKey: string) {
    setDragOverLayer((prev) => (prev === layerKey ? null : prev));
  }
  function handleDrop(e: React.DragEvent, layerKey: string) {
    e.preventDefault();
    const courseId = e.dataTransfer.getData("text/course-id");
    setDragOverLayer(null);
    setDraggedCourseId(null);
    if (!courseId) return;

    // Éviter le drop dans la même couche (pas de changement)
    const course = courses.find((c) => c.id === courseId);
    if (!course) return;
    if (effectiveLayer(course) === layerKey) return;

    start(async () => {
      try {
        await setCourseLayer(courseId, layerKey);
        const targetLayer = LAYERS.find((l) => l.key === layerKey);
        toast.success(`« ${course.title} » déplacé vers ${targetLayer?.label ?? layerKey}`);
      } catch (err: any) {
        toast.error(err?.message || "Erreur lors du déplacement");
      }
    });
  }

  return (
    <div>
      {/* Légende */}
      <div className="mb-6 rounded-2xl bg-midnight-900 text-white p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigoaccent/20 text-indigoaccent flex items-center justify-center flex-shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Notre stack industriel</h2>
          <p className="text-sm text-white/80 mt-1">
            Chaque formation se positionne sur une couche du stack IT / OT / UNS (modèle Purdue / ISA-95).
            Clique sur une formation pour la commencer.
            {canManage && (
              <span className="block mt-1 text-indigoaccent">
                <strong>Admin :</strong> attrape une carte par la poignée <GripVertical className="inline w-3 h-3" /> pour la déplacer sur une autre couche.
              </span>
            )}
          </p>
        </div>
      </div>

      {LAYERS.map((layer) => (
        <LayerRow
          key={layer.key}
          layer={layer}
          courses={layerCourses.get(layer.key) ?? []}
          canManage={canManage}
          allCourses={allCourses}
          isDragOver={dragOverLayer === layer.key}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragStart={setDraggedCourseId}
        />
      ))}
    </div>
  );
}
