"use client";
import { useState, useMemo, useTransition } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend, parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { createPlanning, deletePlanning } from "@/server/actions/planning";
import { toast } from "sonner";
import { X } from "lucide-react";

type User = { id: string; firstName: string; lastName: string; weeklyCapacityH: number };
type Entry = {
  id: string; userId: string; startDate: string; endDate: string;
  hoursPerDay: number | null; loadPct: number | null; activityType: string; comment: string | null;
  targetType: "PRJ" | "CC"; targetId: string; targetLabel: string;
};
type Project = { id: string; name: string; reference: string; company: { name: string } };
type CC = { id: string; code: string; name: string };
type Overlay = {
  id: string; userId: string; startDate: string; endDate: string;
  kind: "leave-pending" | "leave-approved" | "sick";
  label: string;
};

// Palettes DISTINCTES par contexte visuel :
//  - Projet client (targetType=PRJ)          : gamme colorée par projet
//  - Interne / Centre de coût (targetType=CC): violet neutre
//  - Congé APPROVED                          : orange plein
//  - Congé SUBMITTED (en attente)            : jaune rayé (motif diagonal)
//  - Maladie                                 : rouge
const PROJECT_PALETTE = [
  "bg-indigo-300 text-indigo-950",
  "bg-emerald-300 text-emerald-950",
  "bg-sky-300 text-sky-950",
  "bg-cyan-300 text-cyan-950",
  "bg-teal-300 text-teal-950",
  "bg-blue-300 text-blue-950",
  "bg-lime-300 text-lime-950"
];
function colorForProject(targetId: string) {
  let h = 0;
  for (let i = 0; i < targetId.length; i++) h = (h * 31 + targetId.charCodeAt(i)) >>> 0;
  return PROJECT_PALETTE[h % PROJECT_PALETTE.length];
}
function colorForEntry(e: Entry) {
  if (e.targetType === "CC") return "bg-violet-200 text-violet-900";
  return colorForProject(e.targetId);
}
const OVERLAY_STYLES: Record<Overlay["kind"], { bg: string; label: string }> = {
  "leave-approved": {
    bg: "bg-orange-400 text-orange-950",
    label: "Congé validé"
  },
  "leave-pending": {
    // Rayures diagonales via linear-gradient inline pour signaler "en attente"
    bg: "text-amber-950 bg-amber-200",
    label: "Congé en attente"
  },
  "sick": {
    bg: "bg-red-400 text-red-950",
    label: "Maladie"
  }
};

export function MonthGrid({
  monthStartISO, users, entries, projects, costCenters, overlays = []
}: {
  monthStartISO: string; users: User[]; entries: Entry[];
  projects: Project[]; costCenters: CC[];
  overlays?: Overlay[];
}) {
  const start = parseISO(monthStartISO);
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(start), end: endOfMonth(start) }), [monthStartISO]);
  const [pending, startTr] = useTransition();
  const [drag, setDrag] = useState<{ userId: string; from: string; to: string } | null>(null);
  const [modal, setModal] = useState<{ userId: string; from: string; to: string } | null>(null);

  function dayKey(d: Date) { return format(d, "yyyy-MM-dd"); }

  function startDrag(userId: string, day: Date) {
    setDrag({ userId, from: dayKey(day), to: dayKey(day) });
  }
  function moveDrag(userId: string, day: Date) {
    if (!drag || drag.userId !== userId) return;
    setDrag({ ...drag, to: dayKey(day) });
  }
  function endDrag() {
    if (!drag) return;
    const from = drag.from < drag.to ? drag.from : drag.to;
    const to   = drag.from > drag.to ? drag.from : drag.to;
    setModal({ userId: drag.userId, from, to });
    setDrag(null);
  }

  function entryOn(userId: string, day: Date) {
    const k = dayKey(day);
    return entries.find(e => e.userId === userId && k >= e.startDate && k <= e.endDate);
  }
  function overlayOn(userId: string, day: Date) {
    const k = dayKey(day);
    // Priorité maladie > congé validé > congé en attente (le pire en premier)
    const found = overlays.find(o => o.userId === userId && k >= o.startDate && k <= o.endDate);
    return found;
  }

  function inDragRange(userId: string, day: Date) {
    if (!drag || drag.userId !== userId) return false;
    const k = dayKey(day);
    const a = drag.from < drag.to ? drag.from : drag.to;
    const b = drag.from > drag.to ? drag.from : drag.to;
    return k >= a && k <= b;
  }

  return (
    <div className="card overflow-x-auto select-none" onMouseUp={endDrag} onMouseLeave={() => drag && endDrag()}>
      <table className="text-xs">
        <thead className="sticky top-0 bg-white z-10">
          <tr>
            <th className="text-left px-3 py-2 border-b border-border min-w-[180px]">Utilisateur</th>
            {days.map(d => (
              <th key={dayKey(d)} className={"px-1 py-1 text-center border-b border-border " + (isWeekend(d) ? "bg-midnight-50/50 text-midnight-400" : "text-midnight-500")}>
                <div className="leading-none">{format(d, "EEEEE", { locale: fr })}</div>
                <div className="leading-none font-semibold text-midnight-900">{format(d, "d")}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="px-3 py-1.5 font-medium border-b border-border/50 whitespace-nowrap">{u.firstName} {u.lastName}</td>
              {days.map(d => {
                const e = entryOn(u.id, d);
                const o = overlayOn(u.id, d);
                const inSel = inDragRange(u.id, d);
                const wknd = isWeekend(d);
                // Overlay (congé / maladie) prime sur l'affectation projet :
                // dans la vraie vie, quand quelqu'un est en congé, on ne le
                // planifie pas sur un projet ce jour-là.
                const showOverlay = !!o;
                const ovStyle = o ? OVERLAY_STYLES[o.kind] : null;
                // Rayures diagonales pour "en attente" : motif CSS inline
                const overlayPatternStyle = o?.kind === "leave-pending"
                  ? { backgroundImage: "repeating-linear-gradient(45deg, rgba(217,119,6,0.35) 0 3px, transparent 3px 6px)" }
                  : undefined;
                return (
                  <td
                    key={dayKey(d)}
                    onMouseDown={() => !wknd && startDrag(u.id, d)}
                    onMouseEnter={() => !wknd && moveDrag(u.id, d)}
                    className={"border-b border-border/40 cursor-cell text-center align-middle " +
                      (wknd ? "bg-midnight-50/40 " : "") +
                      (inSel ? "bg-indigoaccent/30 " : "")}
                    style={{ width: 28, height: 28, padding: 0 }}
                  >
                    {showOverlay && ovStyle && (
                      <span
                        title={o!.label}
                        className={"inline-block w-full h-full leading-7 " + ovStyle.bg}
                        style={overlayPatternStyle}
                      >·</span>
                    )}
                    {!showOverlay && e && (
                      <span
                        title={`${e.targetLabel} · ${e.hoursPerDay ?? ""}h/j`}
                        className={"inline-block w-full h-full leading-7 " + colorForEntry(e)}
                      >·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-3 py-2 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-midnight-700">
        <span className="font-medium">Légende :</span>
        {/* Contextes (couleurs par catégorie) */}
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-indigo-300" />
          Projet client
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-violet-200" />
          Interne (centre de coût)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded bg-amber-200"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(217,119,6,0.45) 0 2px, transparent 2px 4px)" }}
          />
          Congé demandé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-orange-400" />
          Congé validé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-400" />
          Maladie
        </span>
        <span className="mx-2 text-midnight-300">|</span>
        {/* Zoom projets présents ce mois */}
        <span className="text-midnight-500">Projets :</span>
        {Array.from(new Set(entries.filter(e => e.targetType === "PRJ").map(e => e.targetId))).slice(0, 8).map(id => {
          const sample = entries.find(e => e.targetId === id)!;
          return (
            <span key={id} className="flex items-center gap-1">
              <span className={"inline-block w-3 h-3 rounded " + colorForProject(id)} />
              {sample.targetLabel}
            </span>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t border-border bg-midnight-50/30">
        <h3 className="text-sm font-semibold mb-2">Affectations en cours sur ce mois</h3>
        {entries.length === 0 && overlays.length === 0 ? (
          <p className="text-xs text-midnight-500">Aucune affectation.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Utilisateur</th><th>Cible / Motif</th><th>Du</th><th>Au</th><th className="text-right">h/j</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {/* Congés + maladies d'abord (context) — non éditables ici */}
              {overlays.map(o => {
                const u = users.find(x => x.id === o.userId);
                const badge =
                  o.kind === "leave-approved" ? "bg-orange-100 text-orange-800" :
                  o.kind === "leave-pending"  ? "bg-amber-100 text-amber-800" :
                                                "bg-red-100 text-red-800";
                const kindLabel =
                  o.kind === "leave-approved" ? "Congé validé" :
                  o.kind === "leave-pending"  ? "Congé demandé" :
                                                "Maladie";
                return (
                  <tr key={o.id} className="opacity-90">
                    <td>{u?.firstName} {u?.lastName}</td>
                    <td>{o.label}</td>
                    <td>{o.startDate}</td>
                    <td>{o.endDate}</td>
                    <td className="text-right tabular-nums text-midnight-400">—</td>
                    <td>
                      <span className={"text-[10px] rounded px-1.5 py-0.5 " + badge}>
                        {kindLabel}
                      </span>
                    </td>
                    <td className="text-right text-[10px] text-midnight-400">
                      {o.kind.startsWith("leave") ? "gérer sur /leaves" : "gérer sur /sick-leaves"}
                    </td>
                  </tr>
                );
              })}
              {entries.map(e => {
                const u = users.find(x => x.id === e.userId);
                return (
                  <tr key={e.id}>
                    <td>{u?.firstName} {u?.lastName}</td>
                    <td>{e.targetLabel}</td>
                    <td>{e.startDate}</td>
                    <td>{e.endDate}</td>
                    <td className="text-right tabular-nums">{e.hoursPerDay ?? "—"}</td>
                    <td className="text-xs">{e.activityType}</td>
                    <td className="text-right">
                      <button
                        disabled={pending}
                        onClick={() => { if (window.confirm("Supprimer ?")) startTr(async () => { await deletePlanning(e.id); }); }}
                        className="text-danger hover:text-red-700"
                      ><X className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal
          onClose={() => setModal(null)}
          onSubmit={(fd) => startTr(async () => {
            try { await createPlanning(fd); setModal(null); toast.success("Affectation créée"); }
            catch (e: any) { toast.error(e.message); }
          })}
          userId={modal.userId} from={modal.from} to={modal.to}
          users={users} projects={projects} costCenters={costCenters}
        />
      )}
    </div>
  );
}

function Modal({ onClose, onSubmit, userId, from, to, users, projects, costCenters }: any) {
  const u = users.find((x: User) => x.id === userId);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div className="card max-w-lg w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1">Nouvelle affectation</h2>
        <p className="text-xs text-midnight-500 mb-4">{u.firstName} {u.lastName} · {from} → {to}</p>
        <form action={onSubmit} className="space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="startDate" value={from} />
          <input type="hidden" name="endDate" value={to} />
          <div>
            <label className="label">Cible</label>
            <select name="target" required className="input">
              <option value="">— Choisir —</option>
              <optgroup label="Projets">
                {projects.map((p: Project) => <option key={p.id} value={`PRJ:${p.id}`}>{p.reference} — {p.name} ({p.company.name})</option>)}
              </optgroup>
              <optgroup label="Centres de coût">
                {costCenters.map((c: CC) => <option key={c.id} value={`CC:${c.id}`}>{c.code} — {c.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">h/jour</label><input name="hoursPerDay" type="number" step="0.5" defaultValue="7" className="input" /></div>
            <div>
              <label className="label">Type d'activité</label>
              <select name="activityType" defaultValue="DEVELOPMENT" className="input">
                <option value="ANALYSIS">Analyse</option>
                <option value="DEVELOPMENT">Développement</option>
                <option value="PROJECT_MANAGEMENT">Gestion projet</option>
                <option value="MEETING">Réunion</option>
                <option value="SUPPORT">Support</option>
                <option value="TRAINING">Formation</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="ADMINISTRATIVE">Administratif</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
          </div>
          <div><label className="label">Commentaire</label><input name="comment" className="input" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button className="btn-primary">Créer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
