"use client";
import { useMemo, useState, useTransition, useCallback, useEffect } from "react";
import { upsertCell, upsertCellsBulk, submitWeek } from "@/server/actions/timesheets";
import { addDays, format, parseISO, isWeekend, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, X, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Entry = {
  id: string; date: string; hours: number;
  activityType: string; description: string | null; status: string;
  targetType: "PRJ" | "MIS" | "CC"; targetId: string;
};
type Project = { id: string; name: string; reference: string; company: { name: string } };
type Mission = { id: string; reference: string; title: string; company: { name: string } };
type CC = { id: string; code: string; name: string };
type RowKey = `PRJ:${string}` | `MIS:${string}` | `CC:${string}`;

const ACTIVITIES = [
  { value: "DEVELOPMENT", label: "Développement" },
  { value: "ANALYSIS", label: "Analyse" },
  { value: "PROJECT_MANAGEMENT", label: "Gestion projet" },
  { value: "MEETING", label: "Réunion" },
  { value: "SUPPORT", label: "Support" },
  { value: "TRAINING", label: "Formation" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "ADMINISTRATIVE", label: "Administratif" },
  { value: "OTHER", label: "Autre" }
];

export function TimesheetGrid({
  weekStartISO, entries, projects, missions, costCenters, onBehalfOfUserId
}: {
  weekStartISO: string;
  entries: Entry[];
  projects: Project[];
  missions: Mission[];
  costCenters: CC[];
  /** Si fourni, la saisie/soumission est déléguée pour cet utilisateur (mode admin). */
  onBehalfOfUserId?: string | null;
}) {
  const weekStart = parseISO(weekStartISO);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStartISO]);
  const [pending, start] = useTransition();

  // Lignes affichées par défaut : toutes les cibles ayant déjà une entrée cette semaine
  const usedKeys = new Set<RowKey>(entries.map(e => `${e.targetType}:${e.targetId}` as RowKey));
  const [extraRows, setExtraRows] = useState<RowKey[]>([]);
  const allKeys: RowKey[] = [...usedKeys, ...extraRows.filter(k => !usedKeys.has(k))];

  // Entry par (key, date)
  const cellKey = (k: RowKey, d: Date) => `${k}|${format(d, "yyyy-MM-dd")}`;
  const byCell = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(cellKey(`${e.targetType}:${e.targetId}` as RowKey, parseISO(e.date)), e);
    return m;
  }, [entries]);

  function rowLabel(k: RowKey): { primary: string; secondary?: string; type: "PRJ" | "MIS" | "CC" } {
    const [type, id] = k.split(":");
    if (type === "PRJ") {
      const p = projects.find(x => x.id === id);
      return { primary: p ? `${p.reference} — ${p.name}` : "Projet inconnu", secondary: p?.company.name, type: "PRJ" };
    }
    if (type === "MIS") {
      const m = missions.find(x => x.id === id);
      return { primary: m ? `${m.reference} — ${m.title}` : "Mission inconnue", secondary: m?.company.name, type: "MIS" };
    }
    const c = costCenters.find(x => x.id === id);
    return { primary: c ? `${c.code} — ${c.name}` : "Centre inconnu", type: "CC" };
  }

  // Totaux
  function rowTotal(k: RowKey) { let s = 0; for (const d of days) { const e = byCell.get(cellKey(k, d)); if (e) s += e.hours; } return s; }
  function colTotal(d: Date) { let s = 0; for (const k of allKeys) { const e = byCell.get(cellKey(k, d)); if (e) s += e.hours; } return s; }
  const weekTotal = days.reduce((s, d) => s + colTotal(d), 0);

  // Cellule active pour saisie (fine-tuning au clic)
  const [active, setActive] = useState<{ key: RowKey; date: string } | null>(null);

  // ─── Drag & drop hebdo ───
  // Sur une ligne, on maintient le clic et on glisse pour "peindre" plusieurs
  // jours avec les heures par défaut de la ligne. Le comment n'est jamais
  // demandé — la ligne mémorise seule son activityType et son défaut.
  const [defaultHours, setDefaultHours] = useState(8);
  const [drag, setDrag] = useState<{ key: RowKey; dates: Set<string> } | null>(null);
  const dragActive = drag !== null;

  useEffect(() => {
    if (!dragActive) return;
    const stop = () => {
      if (drag && drag.dates.size > 0) {
        const dates = Array.from(drag.dates).sort();
        const key = drag.key;
        const hours = defaultHours;
        start(async () => {
          try {
            const r = await upsertCellsBulk({ target: key, dates, hours, onBehalfOfUserId });
            toast.success(`${r.touched} jour(s) rempli(s) à ${hours}h`);
          } catch (err: any) { toast.error(err.message); }
        });
      }
      setDrag(null);
    };
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, [dragActive, drag, defaultHours]);

  const fillWeek = useCallback((key: RowKey, hours: number) => {
    const dates = days.filter(d => !isWeekend(d)).map(d => format(d, "yyyy-MM-dd"));
    start(async () => {
      try {
        const r = await upsertCellsBulk({ target: key, dates, hours, onBehalfOfUserId });
        toast.success(`${r.touched} jour(s) rempli(s) à ${hours}h`);
      } catch (err: any) { toast.error(err.message); }
    });
  }, [days, onBehalfOfUserId]);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <AddRowSelect
            excludeKeys={new Set([...allKeys])}
            projects={projects}
            missions={missions}
            costCenters={costCenters}
            onAdd={(k) => setExtraRows(rs => [...rs, k])}
          />
          <div className="flex items-center gap-1.5 pl-3 border-l border-border">
            <span className="text-[10px] font-mono uppercase tracking-widest text-midnight-400">Défaut / jour</span>
            <input
              type="number" min="0" max="24" step="0.5"
              value={defaultHours}
              onChange={(e) => setDefaultHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
              className="input h-8 w-16 text-center tabular-nums"
              title="Heures posées lors d'un drag & drop ou 'Remplir semaine'"
            />
            <span className="text-xs text-midnight-500">h</span>
          </div>
        </div>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            try { const n = await submitWeek(weekStartISO, onBehalfOfUserId); toast.success(`${n} entrée(s) soumises`); }
            catch (e: any) { toast.error(e.message); }
          })}
          className="btn-primary btn-sm"
        >{onBehalfOfUserId ? "Soumettre pour ce consultant" : "Soumettre la semaine"}</button>
      </div>
      <div className="text-[11px] text-midnight-500 italic px-1">
        💡 Astuce : maintenez le clic et glissez sur une ligne pour remplir plusieurs jours à {defaultHours}h. Cliquez sur une cellule seule pour ajuster une valeur précise.
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-midnight-50/40">
            <tr>
              <th className="text-left text-xs font-medium text-midnight-500 uppercase tracking-wide px-3 py-2 border-b border-border min-w-[260px]">Projet / Centre de coût</th>
              {days.map(d => (
                <th key={d.toISOString()} className={cn(
                  "text-center text-xs font-medium uppercase tracking-wide px-2 py-2 border-b border-border min-w-[80px]",
                  isWeekend(d) ? "text-midnight-300" : "text-midnight-500",
                  isSameDay(d, new Date()) && "bg-indigoaccent/10"
                )}>
                  <div className="leading-none">{format(d, "EEEEE", { locale: fr })}</div>
                  <div className="leading-none mt-0.5 text-midnight-700 font-semibold">{format(d, "dd/MM")}</div>
                </th>
              ))}
              <th className="text-right text-xs font-medium text-midnight-500 uppercase tracking-wide px-3 py-2 border-b border-border min-w-[70px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.length === 0 ? (
              <tr><td colSpan={days.length + 2} className="px-4 py-10 text-center text-sm text-midnight-500">Aucune ligne. Ajoutez un projet ou un centre de coût pour commencer la saisie.</td></tr>
            ) : (
              allKeys.map((k) => {
                const row = rowLabel(k);
                return (
                  <tr key={k} className="hover:bg-midnight-50/30">
                    <td className="px-3 py-2 border-b border-border/40 align-middle">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-midnight-900 truncate">{row.primary}</div>
                          {row.secondary && <div className="text-xs text-midnight-500 truncate">{row.secondary}</div>}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={"badge-" + (row.type === "PRJ" ? "info" : row.type === "MIS" ? "warning" : "neutral") + " text-[10px]"}>
                              {row.type === "PRJ" ? "Projet" : row.type === "MIS" ? "Mission" : "Centre coût"}
                            </span>
                            <button
                              type="button"
                              onClick={() => fillWeek(k, defaultHours)}
                              className="text-[10px] text-indigoaccent hover:underline flex items-center gap-0.5"
                              title={`Remplir lun–ven à ${defaultHours}h`}
                              disabled={pending}
                            >
                              <Wand2 className="w-2.5 h-2.5" /> Remplir semaine
                            </button>
                          </div>
                        </div>
                        {!usedKeys.has(k) && (
                          <button
                            type="button"
                            onClick={() => setExtraRows(rs => rs.filter(x => x !== k))}
                            className="text-midnight-400 hover:text-danger"
                            title="Retirer cette ligne (vide)"
                          ><X className="w-3 h-3" /></button>
                        )}
                      </div>
                    </td>
                    {days.map(d => {
                      const dateStr = format(d, "yyyy-MM-dd");
                      const e = byCell.get(cellKey(k, d));
                      const wknd = isWeekend(d);
                      const approved = e?.status === "APPROVED";
                      const isDragged = drag?.key === k && drag.dates.has(dateStr);
                      return (
                        <td
                          key={dateStr}
                          onMouseDown={(ev) => {
                            if (approved) return;
                            if (ev.button !== 0) return;
                            ev.preventDefault();
                            setDrag({ key: k, dates: new Set([dateStr]) });
                          }}
                          onMouseEnter={() => {
                            if (drag && drag.key === k && !approved) {
                              setDrag({ key: k, dates: new Set([...drag.dates, dateStr]) });
                            }
                          }}
                          onClick={(ev) => {
                            // Un clic simple (sans avoir bougé) → mode fine-tuning
                            if (!drag && !approved) {
                              // Le clic peut arriver après un mouseup drag ; on vérifie
                              // qu'aucun drag n'est en cours pour éviter d'ouvrir le form.
                              setActive({ key: k, date: dateStr });
                            }
                          }}
                          className={cn(
                            "border-b border-border/40 text-center align-middle cursor-pointer select-none",
                            wknd && "bg-midnight-50/30",
                            approved && "cursor-not-allowed",
                            isSameDay(d, new Date()) && "bg-indigoaccent/5",
                            isDragged && "bg-indigoaccent/20 ring-1 ring-indigoaccent"
                          )}
                          title={e?.description ?? (drag ? "Glisse pour peindre plusieurs jours" : "Clic = ajuster · Maintenir clic + glisser = remplir en lot")}
                        >
                          <CellInline
                            entry={e}
                            isActive={active?.key === k && active?.date === dateStr}
                            onCancel={() => setActive(null)}
                            onSubmit={(fd) => start(async () => {
                              try {
                                if (onBehalfOfUserId) fd.set("onBehalfOfUserId", onBehalfOfUserId);
                                await upsertCell(fd);
                                setActive(null);
                              }
                              catch (err: any) { toast.error(err.message); }
                            })}
                            target={k}
                            date={dateStr}
                            dragPreview={isDragged ? defaultHours : undefined}
                          />
                        </td>
                      );
                    })}
                    <td className="text-right tabular-nums px-3 py-2 border-b border-border/40 font-medium">{rowTotal(k).toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-midnight-50/40 font-medium">
              <td className="px-3 py-2 text-right text-xs text-midnight-500 uppercase">Total / jour</td>
              {days.map(d => {
                const t = colTotal(d);
                return (
                  <td key={d.toISOString()} className={cn(
                    "text-center tabular-nums px-2 py-2",
                    t > 8 && "text-amber-700"
                  )}>{t > 0 ? t.toFixed(2) : "—"}</td>
                );
              })}
              <td className="text-right tabular-nums px-3 py-2 text-midnight-900">{weekTotal.toFixed(2)}h</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CellInline({
  entry, isActive, target, date, onSubmit, onCancel, dragPreview
}: {
  entry?: Entry; isActive: boolean; target: RowKey; date: string;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  /** Aperçu visuel pendant un drag actif : les heures qui seront posées au relâchement. */
  dragPreview?: number;
}) {
  if (!isActive) {
    if (dragPreview !== undefined) {
      return (
        <span className="inline-block min-w-[44px] py-1 px-1 tabular-nums font-bold text-indigoaccent">
          {dragPreview.toFixed(1)}
        </span>
      );
    }
    if (!entry || entry.hours === 0) return <span className="text-midnight-300 text-xs">·</span>;
    const tone = entry.status === "APPROVED" ? "text-emerald-700" : entry.status === "SUBMITTED" ? "text-indigo-700" : entry.status === "REJECTED" ? "text-red-700" : "text-midnight-900";
    return (
      <span className={cn("inline-block min-w-[44px] py-1 px-1 tabular-nums font-medium", tone)}>
        {entry.hours.toFixed(2)}
      </span>
    );
  }
  return (
    <form action={onSubmit} className="flex flex-col items-stretch gap-1 p-1" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="date" value={date} />
      <input
        autoFocus
        name="hours"
        type="number"
        step="0.25"
        min="0"
        max="24"
        defaultValue={entry?.hours ?? ""}
        className="input h-7 text-center px-1 tabular-nums w-[68px]"
        onKeyDown={(ev) => { if (ev.key === "Escape") { ev.preventDefault(); onCancel(); } }}
      />
      <select name="activityType" defaultValue={entry?.activityType ?? "DEVELOPMENT"} className="input h-6 text-[10px] py-0 px-1">
        {ACTIVITIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
      <div className="flex justify-between gap-1">
        <button type="button" onClick={onCancel} className="text-[10px] text-midnight-500 hover:text-midnight-900 px-1">Esc</button>
        <button type="submit" className="text-[10px] text-indigoaccent font-medium px-1">↵</button>
      </div>
    </form>
  );
}

function AddRowSelect({
  excludeKeys, projects, missions, costCenters, onAdd
}: { excludeKeys: Set<RowKey>; projects: Project[]; missions: Mission[]; costCenters: CC[]; onAdd: (k: RowKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Plus className="w-4 h-4 text-midnight-400" />
      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value as RowKey;
          if (!v) return;
          if (excludeKeys.has(v)) { toast.error("Cette ligne est déjà affichée"); e.target.value = ""; return; }
          onAdd(v);
          e.target.value = "";
        }}
        className="input h-9 text-sm w-[420px]"
      >
        <option value="">+ Ajouter une ligne (projet, mission ou centre de coût)</option>
        <optgroup label="Mes missions T&M">
          {missions.map(m => {
            const k = `MIS:${m.id}` as RowKey;
            return <option key={k} value={k} disabled={excludeKeys.has(k)}>{m.reference} — {m.title} ({m.company.name})</option>;
          })}
        </optgroup>
        <optgroup label="Mes projets forfait">
          {projects.map(p => {
            const k = `PRJ:${p.id}` as RowKey;
            return <option key={k} value={k} disabled={excludeKeys.has(k)}>{p.reference} — {p.name} ({p.company.name})</option>;
          })}
        </optgroup>
        <optgroup label="Centres de coût internes">
          {costCenters.map(c => {
            const k = `CC:${c.id}` as RowKey;
            return <option key={k} value={k} disabled={excludeKeys.has(k)}>{c.code} — {c.name}</option>;
          })}
        </optgroup>
      </select>
    </div>
  );
}
