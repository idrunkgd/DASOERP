// Helpers d'affichage pour les tests techniques.
//
// Ces helpers étaient dans src/server/actions/tests.ts mais ils sont
// synchrones — incompatible avec la directive "use server" qui exige que
// toutes les exports du fichier soient async. Déplacés ici pour éviter
// l'erreur Next.js "Server actions must be async functions".

import type { TestDifficulty } from "@prisma/client";

export function domainLabel(domain: string) {
  switch (domain) {
    case "ELEC_INDUSTRIAL": return "Électricité industrielle";
    case "PLC": return "PLC Siemens & Schneider";
    case "DATA_MANAGER": return "Data Manager";
    case "IT_INDUSTRIAL": return "IT industriel";
    case "CYBERSEC_INDUSTRIAL": return "Cybersécurité OT";
    default: return domain;
  }
}

export function difficultyLabel(d: TestDifficulty) {
  return ({ JUNIOR: "Junior", MEDIOR: "Médior", SENIOR: "Senior", EXPERT: "Expert" } as const)[d];
}

/**
 * À partir d'un breakdown de scores par difficulté, déduit un profil lisible.
 * Heuristique : on regarde où la performance reste ≥ 70 %.
 */
export function profileFromScores(s: {
  scoreJunior: number; maxJunior: number;
  scoreMedior: number; maxMedior: number;
  scoreSenior: number; maxSenior: number;
  scoreExpert: number; maxExpert: number;
}): string {
  const pct = (sc: number, mx: number) => (mx > 0 ? sc / mx : 0);
  const J = pct(s.scoreJunior, s.maxJunior);
  const M = pct(s.scoreMedior, s.maxMedior);
  const S = pct(s.scoreSenior, s.maxSenior);
  const E = pct(s.scoreExpert, s.maxExpert);
  if (E >= 0.7 && S >= 0.7) return "Expert confirmé";
  if (S >= 0.7 && M >= 0.7) return "Senior confirmé";
  if (M >= 0.7 && J >= 0.7) return "Médior confirmé";
  if (J >= 0.7) return "Junior solide";
  return "Profil à conforter";
}
