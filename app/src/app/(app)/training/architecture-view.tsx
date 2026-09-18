"use client";
import Link from "next/link";
import { GraduationCap, CheckCircle2, PlayCircle, EyeOff, Lock, Cloud, Layers, Server, Cpu, Zap } from "lucide-react";
import { ToggleCourseVisibility } from "./toggle-visibility";
import { DeleteCourse } from "./delete-course";
import { PrerequisiteManager } from "./prerequisite-manager";

/**
 * Vue "architecture" du catalogue formations :
 * représente le stack industriel IT / OT / UNS façon Purdue/ISA-95,
 * chaque formation est positionnée sur son niveau · clic → détail.
 * Admins ont accès aux boutons de gestion (visibility, delete, prereq).
 */

type CourseCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  active: boolean;
  slideCount: number;
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
  slugs: string[];
  extraSystems: string[]; // systèmes non-formation à afficher en filigrane
};

// Mapping des cours vers les couches du stack.
// Ajouter une formation ici quand on en crée une nouvelle.
const LAYERS: LayerConfig[] = [
  {
    key: "cloud",
    label: "Niveau 5 · Cloud & IT Entreprise",
    sub: "ERP · Data lake · BI · Cybersécurité",
    icon: <Cloud className="w-5 h-5" />,
    gradient: "from-sky-500/10 to-indigo-500/10",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    slugs: [],
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
    slugs: ["aveva-report", "sql-server"],
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
    slugs: [], // formations UNS à venir : HighByte, HiveMQ
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
    slugs: ["wincc-scada"],
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
    slugs: ["materiel-plc-siemens", "programmation-tia-portal"],
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
    slugs: ["ba4-securite-electrique", "ba5-securite-electrique"],
    extraSystems: ["Armoires électriques", "Variateurs Sinamics", "Capteurs / Actionneurs"]
  }
];

// Formation par défaut (hors niveaux mappés) : fourre-tout "Autres" en bas
const DEFAULT_LAYER = "field";

function LayerRow({
  layer,
  courses,
  canManage,
  allCourses
}: {
  layer: LayerConfig;
  courses: CourseCard[];
  canManage: boolean;
  allCourses: { id: string; title: string }[];
}) {
  return (
    <section className={`rounded-2xl border border-border bg-gradient-to-r ${layer.gradient} p-5 mb-4 relative overflow-hidden`}>
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
      </div>

      {/* Formations de la couche */}
      {courses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-midnight-300 bg-white/40 p-4 text-center text-xs text-midnight-500 italic">
          Aucune formation Dasolabs sur cette couche pour l'instant.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className={"relative " + (!c.active ? "opacity-60" : c.locked ? "opacity-75" : "")}>
              {canManage && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
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
              <Link
                href={`/training/${c.slug}`}
                className="block rounded-xl border border-border bg-white hover:shadow-md hover:border-indigoaccent/40 transition-all p-4 group h-full"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigoaccent/10 text-indigoaccent flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 pr-14">
                    <h3 className="text-sm font-semibold text-midnight-900 group-hover:text-indigoaccent transition-colors flex items-center gap-1.5 line-clamp-2">
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
                      <Lock className="w-3 h-3" /> Requiert {c.prerequisiteCourse.title}
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
  // Distribuer les cours dans les couches
  const layerCourses = new Map<string, CourseCard[]>();
  LAYERS.forEach((l) => layerCourses.set(l.key, []));

  courses.forEach((c) => {
    const layer = LAYERS.find((l) => l.slugs.includes(c.slug));
    const key = layer?.key ?? DEFAULT_LAYER;
    layerCourses.get(key)!.push(c);
  });

  return (
    <div>
      {/* Légende / intro */}
      <div className="mb-6 rounded-2xl bg-midnight-900 text-white p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigoaccent/20 text-indigoaccent flex items-center justify-center flex-shrink-0">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Notre stack industriel</h2>
          <p className="text-sm text-white/80 mt-1">
            Chaque formation se positionne sur une couche du stack IT / OT / UNS (modèle Purdue / ISA-95).
            Clique sur une formation pour la commencer, ou consulte les systèmes tiers en filigrane pour te
            situer dans l'écosystème.
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
        />
      ))}
    </div>
  );
}
