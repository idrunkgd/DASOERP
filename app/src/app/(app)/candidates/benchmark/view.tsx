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
  seniority: string | null;
  skills: string[];
};

export function BenchmarkView({ points }: { points: Point[] }) {
  const [filterSkill, setFilterSkill] = useState("");
  const [filterSeniority, setFilterSeniority] = useState<string>("");
  const [hover, setHover] = useState<Point | null>(null);

  // Compétences uniques pour l'autocomplete
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => p.skills.forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [points]);

  const filtered = useMemo(() => {
    return points.filter((p) => {
      if (filterSeniority && p.seniority !== filterSeniority) return false;
      if (filterSkill) {
        const s = filterSkill.toLowerCase();
        if (!p.skills.some((x) => x.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [points, filterSkill, filterSeniority]);

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
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-midnight-500" />
          <span className="text-sm font-semibold">Filtres</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-midnight-400" />
          <input
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            placeholder="Compétence (ex: react, aveva, siemens…)"
            className="input text-sm max-w-xs"
            list="skills-list"
          />
          <datalist id="skills-list">
            {allSkills.map((s) => <option key={s} value={s} />)}
          </datalist>
          {filterSkill && (
            <button onClick={() => setFilterSkill("")} className="text-midnight-400 hover:text-red-600"><X className="w-3 h-3" /></button>
          )}
        </div>
        <select value={filterSeniority} onChange={(e) => setFilterSeniority(e.target.value)} className="input text-sm max-w-[140px]">
          <option value="">Toutes séniorités</option>
          <option value="JUNIOR">Junior</option>
          <option value="MEDIOR">Medior</option>
          <option value="SENIOR">Senior</option>
          <option value="EXPERT">Expert</option>
        </select>
        <div className="ml-auto text-sm text-midnight-600">
          <strong className="text-indigoaccent">{filtered.length}</strong> candidat{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Scatter plot grand format */}
      <div className="card p-6">
        <BigScatter points={filtered} onHover={setHover} />
      </div>

      {/* Tooltip persistant */}
      {hover && (
        <div className="fixed bottom-4 right-4 z-50 card p-3 bg-white shadow-lg max-w-sm">
          <div className="text-sm font-semibold">
            <Link href={`/candidates/${hover.id}`} className="text-indigoaccent hover:underline">
              {hover.firstName} {hover.lastName}
            </Link>
          </div>
          <div className="text-xs text-midnight-500 mt-1">
            {hover.years} ans d'XP · {hover.rate.toLocaleString()} €/mois brut
            {hover.seniority && ` · ${hover.seniority}`}
          </div>
          {hover.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {hover.skills.slice(0, 8).map((s) => <span key={s} className="badge-info text-[9px]">{s}</span>)}
              {hover.skills.length > 8 && <span className="text-[10px] text-midnight-500">+{hover.skills.length - 8}</span>}
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {yTicks.map((t) => (
        <line key={t} x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeDasharray="2 2" />
      ))}
      {xTicks.filter((_, i) => i % 2 === 0).map((t) => (
        <line key={t} x1={x(t)} x2={x(t)} y1={pad} y2={H - pad} stroke="#f3f4f6" />
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
      {points.map((p) => (
        <g key={p.id}>
          <circle
            cx={x(p.years)}
            cy={y(p.rate)}
            r="7"
            fill={p.seniority ? colorForSeniority[p.seniority] : "#9ca3af"}
            fillOpacity="0.5"
            stroke={p.seniority ? colorForSeniority[p.seniority] : "#4b5563"}
            strokeWidth="1.5"
            onMouseEnter={() => onHover(p)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: "pointer" }}
          >
            <title>{`${p.firstName} ${p.lastName} · ${p.years} ans · ${p.rate.toLocaleString()} €/mois${p.seniority ? " · " + p.seniority : ""}`}</title>
          </circle>
        </g>
      ))}

      {/* Legends axes */}
      <text x={W / 2} y={H - 15} textAnchor="middle" fontSize="14" fill="#1f2937" fontWeight="600">
        Expérience (années)
      </text>
      <text x={20} y={H / 2} textAnchor="middle" fontSize="14" fill="#1f2937" fontWeight="600" transform={`rotate(-90 20 ${H / 2})`}>
        Salaire brut demandé (€/mois)
      </text>

      {/* Légende séniorité */}
      <g transform={`translate(${W - 220}, ${pad + 10})`}>
        <rect x="0" y="0" width="200" height="110" fill="white" stroke="#e5e7eb" rx="4" />
        <text x="10" y="18" fontSize="11" fill="#6b7280" fontWeight="600">SÉNIORITÉ</text>
        {Object.entries(colorForSeniority).map(([key, color], i) => (
          <g key={key} transform={`translate(10, ${30 + i * 18})`}>
            <circle cx="7" cy="7" r="6" fill={color} fillOpacity="0.6" stroke={color} />
            <text x="20" y="11" fontSize="12" fill="#374151">{key}</text>
          </g>
        ))}
      </g>
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
