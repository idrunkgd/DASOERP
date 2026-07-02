/**
 * Jours fériés belges légaux (10 fériés + Pâques + Lundi de Pâques + Ascension + Pentecôte).
 *
 * Pâques est calculée avec l'algorithme de Meeus/Jones/Butcher pour toute
 * année entre 1900 et 2199. Les autres fériés dérivés de Pâques (lundi de
 * Pâques, Ascension = 39 jours après, Pentecôte = 49 jours après, lundi
 * de Pentecôte = 50 jours après) sont dérivés par offset.
 *
 * Utilisé par working-days.ts pour déduire les fériés du calcul de budget
 * d'une mission consultant.
 */

/**
 * Retourne la date du dimanche de Pâques pour l'année donnée (algorithme
 * de Meeus/Jones/Butcher, valide 1900-2199 grégorien).
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);        // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  // Note: on utilise UTC pour éviter tout décalage timezone dans la comparaison
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Ajoute n jours (calendaires) à une date. UTC-safe.
 */
function addDaysUtc(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/**
 * Retourne l'ensemble des jours fériés belges pour une année donnée,
 * sous forme de Set<string> avec des clés "YYYY-MM-DD" pour lookup O(1).
 *
 * Fériés fixes :
 *  - 01/01 Nouvel An
 *  - 01/05 Fête du travail
 *  - 21/07 Fête nationale
 *  - 15/08 Assomption
 *  - 01/11 Toussaint
 *  - 11/11 Armistice
 *  - 25/12 Noël
 *
 * Fériés mobiles (calés sur Pâques) :
 *  - Lundi de Pâques (Pâques + 1)
 *  - Ascension (Pâques + 39)
 *  - Lundi de Pentecôte (Pâques + 50)
 */
export function belgianHolidaysForYear(year: number): Set<string> {
  const s = new Set<string>();
  const iso = (m: number, d: number) =>
    `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  s.add(iso(1, 1));
  s.add(iso(5, 1));
  s.add(iso(7, 21));
  s.add(iso(8, 15));
  s.add(iso(11, 1));
  s.add(iso(11, 11));
  s.add(iso(12, 25));

  const easter = easterSunday(year);
  const easterMon = addDaysUtc(easter, 1);
  const ascension = addDaysUtc(easter, 39);
  const whitMon = addDaysUtc(easter, 50);
  const toIso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  s.add(toIso(easterMon));
  s.add(toIso(ascension));
  s.add(toIso(whitMon));

  return s;
}

/**
 * Retourne l'union des fériés belges couvrant toutes les années entre
 * deux dates (inclusives). Utile quand une mission traverse un
 * changement d'année.
 */
export function belgianHolidaysBetween(from: Date, to: Date): Set<string> {
  const yFrom = from.getUTCFullYear();
  const yTo = to.getUTCFullYear();
  const all = new Set<string>();
  for (let y = yFrom; y <= yTo; y++) {
    for (const iso of belgianHolidaysForYear(y)) all.add(iso);
  }
  return all;
}
