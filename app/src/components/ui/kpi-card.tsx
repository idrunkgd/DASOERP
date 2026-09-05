import { cn } from "@/lib/utils";

/**
 * KPI Card — style charte : label mono uppercase discret, gros chiffre 800.
 * Tone donne uniquement la couleur du chiffre (le fond reste blanc / rounded).
 */
export function KpiCard({
  label, value, hint, tone = "neutral", icon: Icon
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: any;
}) {
  const tones: Record<string, string> = {
    neutral: "text-midnight-900",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger:  "text-red-600",
    info:    "text-indigoaccent"
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-midnight-400">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-midnight-300" />}
      </div>
      <div className={cn("mt-3 text-3xl font-extrabold tracking-tight leading-none", tones[tone])}>{value}</div>
      {hint && <div className="text-xs text-midnight-400 mt-2 font-mono">{hint}</div>}
    </div>
  );
}
