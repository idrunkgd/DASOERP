import { describe, it, expect } from "vitest";
import { computeDiff } from "@/lib/audit";

describe("audit.computeDiff", () => {
  it("renvoie null si aucune différence", () => {
    expect(computeDiff({ a: 1, b: "x" }, { a: 1, b: "x" })).toBeNull();
  });
  it("ignore createdAt et updatedAt", () => {
    expect(computeDiff({ a: 1, updatedAt: new Date() }, { a: 1, updatedAt: new Date(2030, 0, 1) })).toBeNull();
  });
  it("liste les champs modifiés avec before/after", () => {
    const d = computeDiff({ name: "old", price: 10 }, { name: "new", price: 12, extra: true });
    expect(d).toEqual({
      name: { before: "old", after: "new" },
      price: { before: 10, after: 12 },
      extra: { before: undefined, after: true }
    });
  });
});
