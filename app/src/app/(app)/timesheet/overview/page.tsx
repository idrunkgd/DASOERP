/**
 * Vue admin mensuelle : tous les utilisateurs × tous les jours du mois.
 * Chaque cellule = total heures saisies ce jour-là. Export PDF.
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { startOfMonth, endOfMonth, parseISO, format, eachDayOfInterval, isWeekend } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PrintButton, MonthPicker } from "./print-button";

export const dynamic = "force-dynamic";

export default async function TimesheetOverviewPage({
  searchParams
}: {
  searchParams: { month?: string };
}) {
  await requirePermission("timesheet.validate");

  const anchor = searchParams.month ? parseISO(searchParams.month + "-01") : new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const monthKey = format(monthStart, "yyyy-MM");

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const prevMonth = new Date(monthStart); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(monthStart); nextMonth.setMonth(nextMonth.getMonth() + 1);
  const prevKey = format(prevMonth, "yyyy-MM");
  const nextKey = format(nextMonth, "yyyy-MM");

  const [users, entries] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, candidateProfile: { is: null } },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    }),
    prisma.timesheetEntry.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { userId: true, date: true, hours: true, status: true }
    })
  ]);

  // Index : userId → "YYYY-MM-DD" → { hours, approved: bool }
  const idx = new Map<string, Map<string, { hours: number; status: string }>>();
  for (const e of entries) {
    const uid = e.userId;
    const dkey = format(e.date, "yyyy-MM-dd");
    if (!idx.has(uid)) idx.set(uid, new Map());
    const existing = idx.get(uid)!.get(dkey);
    idx.get(uid)!.set(dkey, {
      hours: (existing?.hours ?? 0) + Number(e.hours),
      status: e.status === "APPROVED" || existing?.status === "APPROVED" ? "APPROVED" : (existing?.status ?? e.status)
    });
  }

  // Totaux par user et par jour
  const userTotals = new Map<string, number>();
  const dayTotals = new Map<string, number>();
  let grandTotal = 0;
  for (const u of users) {
    let ut = 0;
    for (const d of days) {
      const dkey = format(d, "yyyy-MM-dd");
      const cell = idx.get(u.id)?.get(dkey);
      ut += cell?.hours ?? 0;
      dayTotals.set(dkey, (dayTotals.get(dkey) ?? 0) + (cell?.hours ?? 0));
    }
    userTotals.set(u.id, ut);
    grandTotal += ut;
  }

  return (
    <div>
      <PageHeader
        title="Vue mensuelle · timesheet équipe"
        breadcrumb={[{ label: "Timesheet", href: "/timesheet" }, { label: `Vue ${monthKey}` }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/timesheet/overview?month=${prevKey}`} className="btn-ghost btn-sm">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <MonthPicker month={monthKey} />
            <Link href={`/timesheet/overview?month=${nextKey}`} className="btn-ghost btn-sm">
              <ChevronRight className="w-4 h-4" />
            </Link>
            <PrintButton />
          </div>
        }
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          .card { overflow: visible !important; }
          table { font-size: 9px !important; }
          body { background: white !important; }
        }
      `}} />
          </div>
        }
      />

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-midnight-50 text-midnight-600 uppercase tracking-wide">
              <th className="text-left px-3 py-2 sticky left-0 bg-midnight-50 z-10">Consultant</th>
              {days.map((d) => (
                <th key={d.toISOString()} className={"text-center py-2 w-10 " + (isWeekend(d) ? "bg-midnight-100 text-midnight-400" : "")}>
                  <div className="text-[10px]">{format(d, "EEE", { locale: fr })}</div>
                  <div className="font-mono tabular-nums">{format(d, "dd")}</div>
                </th>
              ))}
              <th className="text-right px-3 py-2 bg-midnight-100 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const total = userTotals.get(u.id) ?? 0;
              return (
                <tr key={u.id} className="border-t border-border/60 hover:bg-midnight-50/50">
                  <td className="px-3 py-1.5 sticky left-0 bg-white hover:bg-midnight-50/50 z-10 whitespace-nowrap">
                    <Link href={`/timesheet?userId=${u.id}&week=${monthKey}-01`} className="font-medium text-midnight-900 hover:text-indigoaccent">
                      {u.firstName} {u.lastName}
                    </Link>
                    <div className="text-[10px] text-midnight-500">{u.role}</div>
                  </td>
                  {days.map((d) => {
                    const dkey = format(d, "yyyy-MM-dd");
                    const cell = idx.get(u.id)?.get(dkey);
                    const hours = cell?.hours ?? 0;
                    const approved = cell?.status === "APPROVED";
                    return (
                      <td key={dkey} className={"text-center py-1 " + (isWeekend(d) ? "bg-midnight-50/60" : "")}>
                        {hours > 0 ? (
                          <span className={
                            "inline-block tabular-nums font-mono text-[11px] " +
                            (approved ? "text-emerald-700 font-semibold" : "text-midnight-700")
                          } title={approved ? "Validé" : "En attente"}>
                            {hours.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-midnight-200">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-1.5 bg-midnight-50 font-bold tabular-nums font-mono">
                    {total.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-midnight-200 bg-midnight-100 font-semibold">
              <td className="px-3 py-2 sticky left-0 bg-midnight-100 z-10">Total jour</td>
              {days.map((d) => {
                const dkey = format(d, "yyyy-MM-dd");
                const t = dayTotals.get(dkey) ?? 0;
                return (
                  <td key={dkey} className={"text-center py-2 tabular-nums font-mono text-[11px] " + (isWeekend(d) ? "bg-midnight-200/60 text-midnight-400" : "")}>
                    {t > 0 ? t.toFixed(1) : "·"}
                  </td>
                );
              })}
              <td className="text-right px-3 py-2 bg-indigoaccent text-white font-bold tabular-nums font-mono">
                {grandTotal.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-midnight-500">
        <span><span className="font-semibold text-emerald-700">●</span> Validé</span>
        <span><span className="font-semibold text-midnight-700">●</span> En attente</span>
        <span>Clic sur un consultant → saisie semaine</span>
      </div>
    </div>
  );
}
