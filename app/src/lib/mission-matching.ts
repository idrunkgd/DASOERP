// Algorithme de matching mission ↔ consultant/candidat
// Score composite normalisé sur 100 :
//   - 60 pts : overlap skills (Jaccard pondéré par séniorité requise)
//   - 20 pts : disponibilité (availableFrom vs startDate de la mission)
//   - 10 pts : rate fit (cost <= targetDailyRate ; pénalité si > maxDailyRate)
//   - 10 pts : séniorité fit (label exact = max, sinon proximité textuelle)

export interface MissionMatchInput {
  requiredSkills: string[];
  seniority: string | null;
  startDate: Date | null;
  targetDailyRate: number | null;
  maxDailyRate: number | null;
}

export interface MatchableProfile {
  id: string;
  kind: "user" | "candidate";
  firstName: string;
  lastName: string;
  skills: string[];
  seniority: string | null;
  dailyCost: number | null;
  availableFrom: Date | null; // null = dispo maintenant
  status: string | null;
}

export interface MatchResult {
  profile: MatchableProfile;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  skillScore: number;
  availabilityScore: number;
  rateScore: number;
  seniorityScore: number;
  rateExceedsMax: boolean;
}

export function rankMatches(
  mission: MissionMatchInput,
  profiles: MatchableProfile[]
): MatchResult[] {
  const required = normalizeList(mission.requiredSkills);

  return profiles
    .map((p) => {
      // 1) Skill score
      const profileSkills = normalizeList(p.skills);
      const matched: string[] = [];
      const missing: string[] = [];
      for (const req of required) {
        if (profileSkills.has(req)) matched.push(req);
        else missing.push(req);
      }
      const skillScore =
        required.size === 0 ? 0 : (matched.length / required.size) * 60;

      // 2) Availability score
      let availabilityScore = 20;
      if (mission.startDate && p.availableFrom) {
        const diffDays =
          (p.availableFrom.getTime() - mission.startDate.getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays <= 0) availabilityScore = 20;
        else if (diffDays <= 30) availabilityScore = 12;
        else if (diffDays <= 90) availabilityScore = 6;
        else availabilityScore = 0;
      }
      if (p.status && ["ENGAGED", "UNAVAILABLE", "ARCHIVED"].includes(p.status)) {
        availabilityScore = 0;
      }

      // 3) Rate score
      let rateScore = 5; // valeur par défaut quand on n'a aucune donnée
      let rateExceedsMax = false;
      if (mission.targetDailyRate && p.dailyCost) {
        if (p.dailyCost <= mission.targetDailyRate * 0.75) rateScore = 10;
        else if (p.dailyCost <= mission.targetDailyRate) rateScore = 8;
        else if (mission.maxDailyRate && p.dailyCost <= mission.maxDailyRate) rateScore = 4;
        else {
          rateScore = 0;
          rateExceedsMax = true;
        }
      }

      // 4) Seniority score
      let seniorityScore = 5;
      if (mission.seniority && p.seniority) {
        const ms = mission.seniority.toLowerCase().trim();
        const ps = p.seniority.toLowerCase().trim();
        if (ms === ps) seniorityScore = 10;
        else if (ps.includes(ms) || ms.includes(ps)) seniorityScore = 7;
        else seniorityScore = 3;
      }

      const total = skillScore + availabilityScore + rateScore + seniorityScore;
      return {
        profile: p,
        score: Math.round(total),
        matchedSkills: matched,
        missingSkills: missing,
        skillScore: Math.round(skillScore),
        availabilityScore: Math.round(availabilityScore),
        rateScore: Math.round(rateScore),
        seniorityScore: Math.round(seniorityScore),
        rateExceedsMax
      } satisfies MatchResult;
    })
    .sort((a, b) => b.score - a.score);
}

function normalizeList(items: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const s of items ?? []) {
    const n = s.trim().toLowerCase();
    if (n) out.add(n);
  }
  return out;
}
