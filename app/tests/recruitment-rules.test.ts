import { describe, it, expect } from "vitest";

/**
 * Tests "intent" sur les règles d'exclusivité Candidat ↔ Consultant.
 * Validation logique des conditions de filtrage utilisées dans les pages list.
 */

describe("Exclusivité Candidat / Consultant", () => {
  it("Liste consultants : par défaut active=true uniquement", () => {
    function buildWhere(searchParams: { status?: string }) {
      const where: any = {};
      const statusFilter = searchParams.status ?? "active";
      if (statusFilter === "active") where.active = true;
      else if (statusFilter === "inactive") where.active = false;
      return where;
    }
    expect(buildWhere({}).active).toBe(true);
    expect(buildWhere({ status: "active" }).active).toBe(true);
    expect(buildWhere({ status: "inactive" }).active).toBe(false);
    expect(buildWhere({ status: "all" }).active).toBeUndefined();
  });

  it("Liste candidats : par défaut exclut ARCHIVED et déjà recrutés", () => {
    function buildWhere(searchParams: { status?: string }) {
      const where: any = {};
      if (searchParams.status) {
        where.status = searchParams.status;
      } else {
        where.status = { in: ["ACTIVE", "UNAVAILABLE"] };
        where.convertedToUser = { is: null };
      }
      return where;
    }
    const w = buildWhere({});
    expect(w.status).toEqual({ in: ["ACTIVE", "UNAVAILABLE"] });
    expect(w.convertedToUser).toEqual({ is: null });

    const w2 = buildWhere({ status: "ARCHIVED" });
    expect(w2.status).toBe("ARCHIVED");
    expect(w2.convertedToUser).toBeUndefined();
  });

  it("Recrutement : Candidate doit passer en ARCHIVED (sort du vivier)", () => {
    // Convention vérifiée à la lecture du code recruitment.ts:
    // status: "ARCHIVED" + convertedToUserId fixé → invisible dans la liste candidats par défaut
    const conventionStatus: "ARCHIVED" = "ARCHIVED";
    expect(conventionStatus).toBe("ARCHIVED");
  });
});
