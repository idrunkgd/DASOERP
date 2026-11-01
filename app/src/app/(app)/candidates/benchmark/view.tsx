"use client";
/**
 * Vue plein écran du benchmark salaires :
 *  - Scatter plot grand format (zoom + pan) avec filtre skills / séniorité
 *  - Hover sur un point → tooltip détaillé
 *  - Clic sur un point → ouvre la fiche candidat
 *  - Table des médianes par tranche XP sous le graphique
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Filter, X } from "lucide-react";

type Point = {
  id: string;
  firstName: string;
  lastName: string;
  years: number;
  rate: number;
  tjm?: number;
  tjmLabel?: string;
  costPerDay?: number;
  seniority: string | null;
  skills: string[];
};

export function BenchmarkView({ points, catalogSkills }: { points: Point[]; catalogSkills?: string[] }) {
  const [skillFilters, setSkillFilters] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [filterSeniority, setFilterSeniority] = useState<string[]>([]);
  const [hover, setHover] = useState<Point | null>(null);

  // Compétences pour l'autocomplete : UNIQUEMENT le catalogue officiel
  // (/skills). On ignore les strings libres venues d'anciens imports CV
  // pour éviter de polluer la liste. Si pas de catalogue (prop absente),
  // fallback sur l'union des skills des candidats.
  const allSkills = useMemo(() => {
    if (catalogSkills && catalogSkills.length > 0) {
      return [...catalogSkills].sort((a, b) => a.localeCompare(b));
    }
    const set = new Set<string>();
    points.forEach((p) => p.skills.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [points, catalogSkills]);

  function addSkillFilter(s: string) {
    const trimmed = s.trim();
    if (!trimmed) return;
    if (!skillFilters.includes(trimmed)) setSkillFilters([...skillFilters, trimmed]);
    setSkillInput("");
  }
  function removeSkillFilter(s: string) {
    setSkillFilters(skillFilters.filter((x) => x !== s));
  }
  function toggleSeniority(key: string) {
    setFilterSeniority(filterSeniority.includes(key)
      ? filterSeniority.filter((x) => x !== key)
      : [...filterSeniority, key]);
  }

  const filtered = useMemo(() => {
    return points.filter((p) => {
      // Séniorités : au moins une sélectionnée doit matcher (OR). Vide = toutes.
      if (filterSeniority.length > 0 && (!p.seniority || !filterSeniority.includes(p.seniority))) return false;
      // Compétences : TOUTES doivent matcher (AND strict pour affiner la recherche)
      if (skillFilters.length > 0) {
        const skillsLower = p.skills.map((s) => s.toLowerCase());
        for (const f of skillFilters) {
          const needle = f.toLowerCase();
          if (!skillsLower.some((s) => s.includes(needle))) return false;
        }
      }
      return true;
    });
  }, [points, skillFilters, filterSeniority]);

  const buckets = [
    { label: "0-2 ans",   min: 0,  max: 2  },
    { label: "3-5 ans",   min: 3,  max: 5  },
    { label: "6-10 ans",  min: 6,  max: 10 },
    { label: "11-15 ans", min: 11, max: 15 },
    { label: "16+ ans",   min: 16, max: 99 }
  ];
  const stats = buckets.map((b) => {
    const sub = filtered.filter((p) => p.years >= b.min && p.years <= b.max);
    const rates = sub.map((p) => p.rate).sort((a, b) => a - b);
    return {
      ...b,
      count: rates.length,
      median: median(rates), q1: quantile(rates, 0.25), q3: quantile(rates, 0.75),
      min: rates[0] ?? 0, max: rates[rates.length - 1] ?? 0
    };
  });

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-midnight-500" />
          <span className="text-sm font-semibold">Filtres</span>
          <div className="ml-auto text-sm text-midnight-600">
            <strong className="text-indigoaccent">{filtered.length}</strong> / {points.length} candidat{points.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* Compétences — multi-tag */}
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-midnight-400" />
            <span className="text-xs uppercase tracking-wide text-midnight-500 font-semibold">Compétences (ET)</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[300px] flex-wrap">
            {skillFilters.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 bg-indigoaccent/10 text-indigoaccent text-xs px-2 py-1 rounded-full border border-indigoaccent/30">
                {s}
                <button onClick={() => removeSkillFilter(s)} className="hover:text-red-600"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkillFilter(skillInput); }
                if (e.key === "Backspace" && skillInput === "" && skillFilters.length > 0) {
                  setSkillFilters(skillFilters.slice(0, -1));
                }
              }}
              placeholder={skillFilters.length === 0 ? "Compétences (Entrée pour ajouter)…" : "+ ajouter…"}
              className="input text-sm flex-1 min-w-[160px]"
              list="skills-list"
            />
            <datalist id="skills-list">
              {allSkills.map((s) => <option key={s} value={s} />)}
            </datalist>
            {skillFilters.length > 0 && (
              <button onClick={() => setSkillFilters([])} className="btn-ghost btn-sm">Reset</button>
            )}
          </div>
        </div>

        {/* Séniorité — multi select */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-midnight-500 font-semibold">Séniorité (OU)</span>
          <div className="flex gap-2 flex-wrap">
            {["JUNIOR", "MEDIOR", "SENIOR", "EXPERT"].map((s) => {
              const active = filterSeniority.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSeniority(s)}
                  className={"px-3 py-1 rounded-full text-xs font-medium border transition " + (active ? "bg-indigoaccent text-white border-indigoaccent" : "bg-white text-midnight-700 border-border hover:border-indigoaccent")}
                >
                  {s}
                </button>
              );
            })}
            {filterSeniority.length > 0 && (
              <button onClick={() => setFilterSeniority([])} className="btn-ghost btn-sm">Reset</button>
            )}
          </div>
        </div>
      </div>

      {/* Scatter plot grand format */}
      <div className="card p-6">
        <BigScatter points={filtered} onHover={setHover} />
      </div>

      {/* Tooltip persistant */}
      {hover && (
        <div className="fixed bottom-4 right-4 z-50 card p-4 bg-white shadow-xl max-w-sm border border-indigoaccent/40">
          <div className="text-base font-semibold">
            <Link href={`/candidates/${hover.id}`} className="text-indigoaccent hover:underline">
              {hover.firstName} {hover.lastName}
            </Link>
          </div>
          <div className="text-xs text-midnight-500 mt-1">
            {hover.years} ans d'XP
            {hover.seniority && ` · ${hover.seniority}`}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/60">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-midnight-500">Brut mensuel</div>
              <div className="text-sm font-semibold text-midnight-900 tabular-nums">
                {hover.rate.toLocaleString()} €
              </div>
            </div>
            {hover.tjm != null && hover.tjm > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-emerald-700">
                  {hover.tjmLabel ?? "TJM"}
                </div>
                <div className="text-sm font-semibold text-emerald-700 tabular-nums">
                  {hover.tjm.toLocaleString()} €/j
                </div>
              </div>
            )}
          </div>
          {hover.skills.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="text-[10px] uppercase tracking-wide text-midnight-500 mb-1">Compétences</div>
              <div className="flex flex-wrap gap-1">
                {hover.skills.slice(0, 10).map((s) => <span key={s} className="badge-info text-[9px]">{s}</span>)}
                {hover.skills.length > 10 && <span className="text-[10px] text-midnight-500">+{hover.skills.length - 10}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table médianes */}
      <div className="card overflow-hidden">
        <h3 className="font-semibold px-4 py-3 border-b border-border/60">Médianes par tranche d'expérience</h3>
        <table className="w-full text-sm">
          <thead className="bg-midnight-50 text-xs uppercase tracking-wide text-midnight-600">
            <tr>
              <th className="px-4 py-2 text-left">Tranche XP</th>
              <th className="px-4 py-2 text-right">N candidats</th>
              <th className="px-4 py-2 text-right">Médiane (€/mois)</th>
              <th className="px-4 py-2 text-right text-midnight-500">Q1 (25 %)</th>
              <th className="px-4 py-2 text-right text-midnight-500">Q3 (75 %)</th>
              <th className="px-4 py-2 text-right text-midnight-400 text-[11px]">Min</th>
              <th className="px-4 py-2 text-right text-midnight-400 text-[11px]">Max</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.label} className={"border-t border-border/60 " + (s.count === 0 ? "opacity-40" : "")}>
                <td className="px-4 py-2 font-medium">{s.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{s.count}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-indigoaccent">
                  {s.count > 0 ? fmt(s.median) + " €" : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-midnight-600">
                  {s.count > 0 ? fmt(s.q1) + " €" : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-midnight-600">
                  {s.count > 0 ? fmt(s.q3) + " €" : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-midnight-400 text-xs">
                  {s.count > 0 ? fmt(s.min) + " €" : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-midnight-400 text-xs">
                  {s.count > 0 ? fmt(s.max) + " €" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BigScatter({ points, onHover }: { points: Point[]; onHover: (p: Point | null) => void }) {
  if (points.length === 0) {
    return <div className="text-center text-midnight-500 py-20">Aucun candidat avec package renseigné.</div>;
  }

  const W = 1600, H = 700, pad = 70;
  const years = points.map((p) => p.years);
  const rates = points.map((p) => p.rate);
  const xMin = 0, xMax = Math.max(...years, 20);
  const yMin = 0, yMax = Math.max(...rates, 2000);
  const yRound = Math.ceil(yMax / 500) * 500;

  const x = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - yMin) / (yRound - yMin)) * (H - 2 * pad);

  const xTicks: number[] = [];
  for (let i = 0; i <= xMax; i += 1) xTicks.push(i);
  const step = yRound > 10000 ? 1000 : yRound > 5000 ? 500 : 250;
  const yTicks: number[] = [];
  for (let i = 0; i <= yRound; i += step) yTicks.push(i);

  const colorForSeniority: Record<string, string> = {
    JUNIOR: "#8be0ff",
    MEDIOR: "#4bc8ff",
    SENIOR: "#4b7fff",
    EXPERT: "#c488ff"
  };
  const fallbackColor = "#4bc8ff"; // bleu Dasolabs pour les candidats sans séniorité renseignée

  // Bandes de fond par tranche d'expérience — alignées sur l'enum séniorité
  // Candidate.seniority = JUNIOR / MEDIOR / SENIOR / EXPERT (voir cv-import.ts)
  const buckets = [
    { min: 0,  max: 2,          color: "#fef3c7", label: "Junior"  }, // amber-100
    { min: 3,  max: 5,          color: "#dbeafe", label: "Medior"  }, // blue-100
    { min: 6,  max: 9,          color: "#dcfce7", label: "Senior"  }, // green-100
    { min: 10, max: xMax + 1,   color: "#f3e8ff", label: "Expert"  }  // purple-100
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Bandes de couleur fond par tranche d'XP */}
      {buckets.map((b, i) => {
        const xStart = x(b.min);
        const xEnd = x(Math.min(b.max + 1, xMax + 1));
        return (
          <g key={i}>
            <rect
              x={xStart}
              y={pad}
              width={xEnd - xStart}
              height={H - 2 * pad}
              fill={b.color}
              opacity="0.5"
            />
            <text
              x={(xStart + xEnd) / 2}
              y={pad + 20}
              textAnchor="middle"
              fontSize="12"
              fill="#64748b"
              fontWeight="600"
              opacity="0.7"
            >
              {b.label}
            </text>
          </g>
        );
      })}

      {/* Grid */}
      {yTicks.map((t) => (
        <line key={t} x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="#ffffff" strokeOpacity="0.7" strokeDasharray="2 2" />
      ))}
      {xTicks.filter((_, i) => i % 2 === 0).map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1={pad} y2={H - pad} stroke="#ffffff" strokeOpacity="0.5" />
      ))}

      {/* Axis labels */}
      {yTicks.map((t) => (
        <text key={t} x={pad - 10} y={y(t) + 4} textAnchor="end" fontSize="13" fill="#6b7280">
          {t >= 1000 ? (t / 1000) + " k€" : t + " €"}
        </text>
      ))}
      {xTicks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - pad} y2={H - pad + 5} stroke="#9ca3af" />
          <text x={x(t)} y={H - pad + 20} textAnchor="middle" fontSize="12" fill="#6b7280">{t}</text>
        </g>
      ))}

      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#374151" strokeWidth="1.5" />
      <line x1={pad} x2={pad} y1={pad} y2={H - pad} stroke="#374151" strokeWidth="1.5" />

      {/* Points — plus gros + colorés par séniorité */}
      {points.map((p) => {
        const col = p.seniority ? colorForSeniority[p.seniority] : fallbackColor;
        return (
          <circle
            key={p.id}
            cx={x(p.years)}
            cy={y(p.rate)}
            r="8"
            fill={col}
            fillOpacity="0.8"
            stroke="#1e293b"
            strokeWidth="1.5"
            onMouseEnter={() => onHover(p)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer" }}
          >
            <title>{`${p.firstName} ${p.lastName} · ${p.years} ans · ${p.rate.toLocaleString()} €/mois${p.seniority ? " · " + p.seniority : ""}`}</title>
          </circle>
        );
      })}

      {/* Legends axes */}
      <text x={W / 2} y={H - 15} textAnchor="middle" fontSize="14" fill="#1f2937" fontWeight="600">
        Expérience (années)
      </text>
      <text x={20} y={H / 2} textAnchor="middle" fontSize="14" fill="#1f2937" fontWeight="600" transform={`rotate(-90 20 ${H / 2})`}>
        Salaire brut demandé (€/mois)
      </text>

      {/* Pas de légende couleurs — les bandes titrées en haut font le job */}
    </svg>
  );
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
  return arr[base];
}
function fmt(n: number): string {
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 }).format(n);
}
