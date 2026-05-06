import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { startOfMonth, endOfMonth, addMonths, format, parseISO, eachDayOfInterval, isWeekend, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { getCalendarEvents, eventTone, eventLabel, type CalendarEvent, type CalendarEventType } from "@/server/services/calendar-service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_FILTERS: { value: CalendarEventType | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous types" },
  { value: "INTERVIEW_HIRING", label: "Entretiens embauche" },
  { value: "INTERVIEW_PLACEMENT", label: "Entretiens client" },
  { value: "REVIEW_INTERNAL", label: "Entretiens internes" },
  { value: "MISSION_START", label: "Débuts mission" },
  { value: "MISSION_END", label: "Fins mission" }
];

export default async function CalendarPage({ searchParams }: { searchParams: { month?: string; type?: string } }) {
  await requirePermission("consulting.read");
  const ref = searchParams.month ? parseISO(searchParams.month + "-01") : new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  // On charge un peu de débord (semaines complètes)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const allEvents = await getCalendarEvents(gridStart, gridEnd);
  const events = (searchParams.type && searchParams.type !== "ALL")
    ? allEvents.filter(e => e.type === searchParams.type)
    : allEvents;

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const k = format(e.date, "yyyy-MM-dd");
    eventsByDay.set(k, [...(eventsByDay.get(k) ?? []), e]);
  }

  const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  // Compteurs par type pour la légende
  const counts: Record<CalendarEventType, number> = {
    INTERVIEW_HIRING: 0, INTERVIEW_PLACEMENT: 0, REVIEW_INTERNAL: 0, MISSION_START: 0, MISSION_END: 0
  };
  for (const e of allEvents) counts[e.type]++;

  return (
    <div>
      <PageHeader
        title="Calendrier consultance"
        subtitle={`${events.length} événement(s) en ${format(monthStart, "MMMM yyyy", { locale: fr })} — partagé avec toute l'équipe`}
        actions={
          <>
            <Link href={`/calendar?month=${prevMonth}`} className="btn-secondary">← Mois précédent</Link>
            <Link href="/calendar" className="btn-ghost">Aujourd'hui</Link>
            <Link href={`/calendar?month=${nextMonth}`} className="btn-secondary">Mois suivant →</Link>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="month" value={searchParams.month ?? ""} />
        <select name="type" defaultValue={searchParams.type ?? "ALL"} className="input max-w-[260px]">
          {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button className="btn-secondary">Filtrer</button>
        <div className="flex items-center gap-3 text-xs text-midnight-700 ml-auto flex-wrap">
          {(["INTERVIEW_HIRING","INTERVIEW_PLACEMENT","REVIEW_INTERNAL","MISSION_START","MISSION_END"] as CalendarEventType[]).map(t => (
            <span key={t} className="flex items-center gap-1">
              <span className={cn("w-3 h-3 rounded border", eventTone(t))} />
              {eventLabel(t)} <span className="text-midnight-400">({counts[t]})</span>
            </span>
          ))}
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-midnight-50/40">
          {["lun","mar","mer","jeu","ven","sam","dim"].map(d => (
            <div key={d} className="px-2 py-1.5 text-[11px] uppercase tracking-wide font-medium text-midnight-500 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map(d => {
            const k = format(d, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(k) ?? [];
            const inMonth = d.getMonth() === monthStart.getMonth();
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={k}
                className={cn(
                  "border-r border-b border-border min-h-[110px] p-1.5 flex flex-col gap-1",
                  !inMonth && "bg-midnight-50/30 text-midnight-400",
                  isWeekend(d) && inMonth && "bg-midnight-50/40",
                  isToday && "ring-2 ring-indigoaccent ring-inset"
                )}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className={cn("font-medium", isToday ? "text-indigoaccent" : "")}>{format(d, "d")}</span>
                  {dayEvents.length > 0 && <span className="text-midnight-400">{dayEvents.length}</span>}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 4).map(e => (
                    <Link
                      key={e.id}
                      href={e.href}
                      title={`${e.title}${e.subtitle ? " — " + e.subtitle : ""}`}
                      className={cn("text-[10px] leading-tight px-1 py-0.5 rounded border truncate", eventTone(e.type))}
                    >
                      {e.type === "INTERVIEW_HIRING" || e.type === "INTERVIEW_PLACEMENT" || e.type === "REVIEW_INTERNAL"
                        ? format(e.date, "HH:mm") + " "
                        : ""}
                      {e.title}
                    </Link>
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[10px] text-midnight-500">+ {dayEvents.length - 4} autre(s)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste détaillée sous la grille pour le mois en cours */}
      <section className="card mt-6 p-5">
        <h2 className="font-semibold mb-3">Liste des événements — {format(monthStart, "MMMM yyyy", { locale: fr })}</h2>
        {events.filter(e => e.date >= monthStart && e.date <= monthEnd).length === 0 ? (
          <p className="text-sm text-midnight-500">Aucun événement ce mois-ci.</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.filter(e => e.date >= monthStart && e.date <= monthEnd).map(e => (
              <li key={e.id} className="py-2 flex items-start gap-3">
                <span className={cn("text-[10px] uppercase font-medium tracking-wide rounded px-2 py-0.5 border whitespace-nowrap mt-0.5", eventTone(e.type))}>
                  {eventLabel(e.type)}
                </span>
                <span className="text-xs text-midnight-500 w-32 shrink-0">
                  {format(e.date, "EEE dd/MM HH:mm", { locale: fr })}
                </span>
                <Link href={e.href} className="flex-1 hover:underline">
                  <div className="text-sm font-medium text-midnight-900">{e.title}</div>
                  {e.subtitle && <div className="text-xs text-midnight-700">{e.subtitle}</div>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
