import { describe, it, expect } from "vitest";
import { toCSV } from "@/lib/csv";

describe("CSV", () => {
  it("ajoute le BOM UTF-8 et joint avec ;", () => {
    const csv = toCSV([{ a: "x", b: 1 }, { a: "y", b: 2 }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("a;b");
    expect(csv).toContain("x;1");
  });

  it("échappe les guillemets et virgules", () => {
    const csv = toCSV([{ a: 'He said "hi"', b: "x;y" }]);
    expect(csv).toContain('"He said ""hi"""');
    expect(csv).toContain('"x;y"');
  });
});
