"use client";
/**
 * Bouton Benchmark salaires candidats : scatter plot expérience × tarif demandé
 * + table de MÉDIANES par tranche d'expérience (robuste aux valeurs extrêmes).
 *
 * On utilise la médiane et pas la moyenne : si un candidat exceptionnel demande
 * un tarif très au-dessus de la fourchette normale (expertise rare), la
 * médiane n'est pas tirée vers le haut par ce seul point. On montre aussi
 * Q1/Q3 pour visualiser la dispersion.
 */
import { useState } from "react";
import { Euro, X, TrendingUp } from "lucide-react";

type CandidatePoint = {
  id: string;
  firstName: string;
  lastName: string;
  years: number;
  rate: number;
  seniority: string | null;
  skills: string[];
};

export function BenchmarkButton({ candidates }: { candidates: CandidatePoint[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm"
        title="Benchmark salaires candidats"
      >
        <Euro className="w-4 h-4" />
      </button>
      {open && <BenchmarkModal candidates={candidates} onClose={() => setOpen(false)} />}
    </>
  );
}

function BenchmarkModal({ candidates, onClose }: { candidates: CandidatePoint[]; onClose: () => void }) {
  // Garde seulement les points avec yearsExperience + rate exploitables
  const points = candidates.filter((c) => c.years != null && c.rate > 0);

  // Buckets d'expérience
  const buckets = [
    { label: "0-2 ans",   min: 0,  max: 2  },
    { label: "3-5 ans",   min: 3,  max: 5  },
    { label: "6-10 ans",  min: 6,  max: 10 },
    { label: "11-15 ans", min: 11, max: 15 },
    { label: "16+ ans",   min: 16, max: 99 }
  ];
  const stats = buckets.map((b) => {
    const sub = points.filter((p) => p.years >= b.min && p.years <= b.max);
    const rates = sub.map((p) => p.rate).sort((a, b) => a - b);
    return {
      ...b,
      count: rates.length,
      median: median(rates),
      q1: quantile(rates, 0.25),
      q3: quantile(rates, 0.75),
      min: rates[0] ?? 0,
      max: rates[rates.length - 1] ?? 0
    };
  });

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-5xl relative my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigoaccent" /> Benchmark salaires candidats
        </h2>
        <p className="text-xs text-midnight-500 mb-5">
          Nuage de points : {points.length} candidat{points.length > 1 ? "s" : ""} avec expérience + tarif renseignés.
          Médiane utilisée au lieu de la moyenne pour éviter l'influence des profils exceptionnels (expertise rare).
        </p>

        <ScatterChart points={points} />

        <table className="w-full text-sm mt-6 border border-border/60 rounded-lg overflow-hidden">
          <thead className="bg-midnight-50 text-xs uppercase tracking-wide text-midnight-600">
            <tr>
              <th className="px-3 py-2 text-left">Tranche expérience</th>
              <th className="px-3 py-2 text-right">N candidats</th>
              <th className="px-3 py-2 text-right">Médiane</th>
              <th className="px-3 py-2 text-right text-midnight-500">Q1 (25 %)</th>
              <th className="px-3 py-2 text-right text-midnight-500">Q3 (75 %)</th>
              <th className="px-3 py-2 text-right text-midnight-400 text-[11px]">Min</th>
              <th className="px-3 py-2 text-right text-midnight-400 text-[11px]">Max</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.label} className={"border-t border-border/60 " + (s.count === 0 ? "opacity-40" : "")}>
                <td className="px-3 py-2 font-medium">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigoaccent">
                  {s.count > 0 ? fmt(s.median) + " €" : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-midnight-600">
                  {s.count > 0 ? fmt(s.q1) + " €" : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-midnight-600">
                  {s.count > 0 ? fmt(s.q3) + " €" : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-midnight-400 text-xs">
                  {s.count > 0 ? fmt(s.min) + " €" : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-midnight-400 text-xs">
                  {s.count > 0 ? fmt(s.max) + " €" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-midnight-500 mt-3">
          <strong>Médiane</strong> = valeur centrale (robuste aux extrêmes). <strong>Q1</strong> = 25 % des candidats sous ce tarif.
          <strong>Q3</strong> = 25 % au-dessus. L'écart Q1→Q3 montre la dispersion du marché.
        </p>
      </div>
    </div>
  );
}

function ScatterChart({ points }: { points: CandidatePoint[] }) {
  if (points.length === 0) {
    return <div className="text-center text-midnight-500 py-10">Aucun candidat avec expérience + tarif saisis.</div>;
  }

  const W = 900, H = 360, pad = 50;
  const years = points.map((p) => p.years);
  const rates = points.map((p) => p.rate);
  const xMin = 0, xMax = Math.max(...years, 20);
  const yMin = Math.min(...rates, 0), yMax = Math.max(...rates, 500);
  const yRound = Math.ceil(yMax / 50) * 50;

  const x = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - yMin) / (yRound - yMin)) * (H - 2 * pad);

  // Ticks X : chaque 2 ans
  const xTicks: number[] = [];
  for (let i = 0; i <= xMax; i += 2) xTicks.push(i);
  // Ticks Y : chaque 100 €
  const step = yRound > 1500 ? 250 : 100;
  const yTicks: number[] = [];
  for (let i = 0; i <= yRound; i += step) yTicks.push(i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {yTicks.map((t) => (
        <line key={t} x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeDasharray="2 2" />
      ))}
      {/* Y axis labels */}
      {yTicks.map((t) => (
        <text key={t} x={pad - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">
          {t} €
        </text>
      ))}
      {/* X axis labels */}
      {xTicks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={H - pad} y2={H - pad + 3} stroke="#9ca3af" />
          <text x={x(t)} y={H - pad + 14} textAnchor="middle" fontSize="10" fill="#6b7280">{t}</text>
        </g>
      ))}
      {/* Axis */}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#374151" />
      <line x1={pad} x2={pad} y1={pad} y2={H - pad} stroke="#374151" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle
            cx={x(p.years)}
            cy={y(p.rate)}
            r="4"
            fill="#4bc8ff"
            fillOpacity="0.6"
            stroke="#1a7fb0"
            strokeWidth="0.5"
          >
            <title>{`${p.firstName} ${p.lastName} · ${p.years} ans · ${p.rate} €/j${p.seniority ? ` · ${p.seniority}` : ""}`}</title>
          </circle>
        </g>
      ))}

      {/* Legends */}
      <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
        Expérience (années)
      </text>
      <text x={14} y={H / 2} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600" transform={`rotate(-90 14 ${H / 2})`}>
        Tarif demandé (€/jour)
      </text>
    </svg>
  );
}

// ─── Stats helpers ───
function median(sortedArr: number[]): number {
  if (sortedArr.length === 0) return 0;
  const mid = Math.floor(sortedArr.length / 2);
  return sortedArr.length % 2 ? sortedArr[mid] : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}
function quantile(sortedArr: number[], q: number): number {
  if (sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  return sortedArr[base];
}
function fmt(n: number): string {
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 }).format(n);
}
