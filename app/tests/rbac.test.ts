import { describe, it, expect } from "vitest";
import { can } from "@/lib/rbac";

describe("RBAC", () => {
  it("ADMIN a accès à tout", () => {
    expect(can("ADMIN", "users.manage")).toBe(true);
    expect(can("ADMIN", "settings.manage")).toBe(true);
    expect(can("ADMIN", "finance.write")).toBe(true);
  });

  it("CONSULTANT n'a pas accès aux offres en écriture", () => {
    expect(can("CONSULTANT", "offers.write")).toBe(false);
    expect(can("CONSULTANT", "users.manage")).toBe(false);
    expect(can("CONSULTANT", "timesheet.self.write")).toBe(true);
    expect(can("CONSULTANT", "timesheet.validate")).toBe(false);
  });

  it("MANAGER peut valider les timesheets", () => {
    expect(can("MANAGER", "timesheet.validate")).toBe(true);
    expect(can("MANAGER", "users.manage")).toBe(false);
  });

  it("FINANCE peut écrire les achats et finance", () => {
    expect(can("FINANCE", "finance.write")).toBe(true);
    expect(can("FINANCE", "purchases.write")).toBe(true);
    expect(can("FINANCE", "offers.write")).toBe(false);
  });

  it("COMMERCIAL gère contacts/entreprises/offres", () => {
    expect(can("COMMERCIAL", "companies.write")).toBe(true);
    expect(can("COMMERCIAL", "contacts.write")).toBe(true);
    expect(can("COMMERCIAL", "offers.write")).toBe(true);
    expect(can("COMMERCIAL", "projects.write")).toBe(false);
  });

  it("Consultance accessible aux ADMIN/MANAGER/COMMERCIAL", () => {
    expect(can("ADMIN", "consulting.write")).toBe(true);
    expect(can("MANAGER", "consulting.write")).toBe(true);
    expect(can("COMMERCIAL", "consulting.write")).toBe(true);
    expect(can("CONSULTANT", "consulting.read")).toBe(false);
    expect(can("FINANCE", "consulting.read")).toBe(false);
  });
});
