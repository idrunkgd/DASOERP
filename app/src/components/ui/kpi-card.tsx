import { cn } from "@/lib/utils";

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
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger:  "text-red-700",
    info:    "text-indigo-700"
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-midnight-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-midnight-400" />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", tones[tone])}>{value}</div>
      {hint && <div className="text-xs text-midnight-500 mt-1">{hint}</div>}
    </div>
  );
}
