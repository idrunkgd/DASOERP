/**
 * Calcul de jours ouvrés (ouvrables au sens belge) entre deux dates.
 *
 * Convention : on itère jour par jour de startDate à endDate INCLUS.
 * Sont exclus : les samedis, les dimanches, et (si includeHolidays=true)
 * les fériés belges légaux (voir belgian-holidays.ts).
 *
 * Le régime jours/semaine ajuste ensuite le résultat : temps plein = 5,
 * 4/5ème = 4, mi-temps = 2.5, etc. On multiplie par `workDaysPerWeek / 5`
 * — c'est une approximation acceptable pour un devis de mission (l'écart
 * exact dépendrait du planning hebdo réel du consultant, hors périmètre).
 */
import { belgianHolidaysBetween } from "./belgian-holidays";

export type WorkingDaysInput = {
  startDate: Date;
  endDate: Date;
  workDaysPerWeek: number;    // 5 = temps plein
  includeHolidays: boolean;    // true = déduire les fériés belges
};

export type WorkingDaysResult = {
  /// Jours calendaires entre les deux dates (inclus)
  calendarDays: number;
  /// Jours ouvrables au sens strict : lundi-vendredi ni fériés (temps plein)
  fullTimeWorkingDays: number;
  /// Résultat après ajustement au régime : fullTimeWorkingDays × (dpw/5)
  effectiveDays: number;
};

function stripToUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Compte les jours ouvrables belges entre deux dates.
 *
 * @param input startDate, endDate, workDaysPerWeek, includeHolidays
 * @returns detail: calendrier, temps-plein, effectif après régime
 */
export function computeWorkingDays(input: WorkingDaysInput): WorkingDaysResult {
  const start = stripToUtcDay(input.startDate);
  const end = stripToUtcDay(input.endDate);
  if (end < start) {
    return { calendarDays: 0, fullTimeWorkingDays: 0, effectiveDays: 0 };
  }
  const holidays = input.includeHolidays
    ? belgianHolidaysBetween(start, end)
    : new Set<string>();

  let calendarDays = 0;
  let fullTime = 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += oneDayMs) {
    calendarDays += 1;
    const d = new Date(t);
    const dow = d.getUTCDay(); // 0 = dimanche, 6 = samedi
    if (dow === 0 || dow === 6) continue;
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (holidays.has(iso)) continue;
    fullTime += 1;
  }
  const dpw = Math.max(0, Math.min(7, Number(input.workDaysPerWeek) || 5));
  // Arrondi à 0.5 pour un résultat lisible dans un devis
  const effectiveRaw = fullTime * (dpw / 5);
  const effectiveDays = Math.round(effectiveRaw * 2) / 2;
  return { calendarDays, fullTimeWorkingDays: fullTime, effectiveDays };
}
