import { describe, it, expect } from "vitest";
import { isOfferEditable, canCreateNewVersion, isOfferFinal, offerLockMessage } from "@/lib/offer-rules";

describe("Offer rules", () => {
  it("seul DRAFT est éditable", () => {
    expect(isOfferEditable("DRAFT")).toBe(true);
    expect(isOfferEditable("SENT")).toBe(false);
    expect(isOfferEditable("NEGOTIATION")).toBe(false);
    expect(isOfferEditable("WON")).toBe(false);
    expect(isOfferEditable("LOST")).toBe(false);
    expect(isOfferEditable("CANCELLED")).toBe(false);
  });

  it("nouvelle version : seulement SENT et NEGOTIATION", () => {
    expect(canCreateNewVersion("SENT")).toBe(true);
    expect(canCreateNewVersion("NEGOTIATION")).toBe(true);
    expect(canCreateNewVersion("DRAFT")).toBe(false);
    expect(canCreateNewVersion("WON")).toBe(false);
    expect(canCreateNewVersion("LOST")).toBe(false);
    expect(canCreateNewVersion("CANCELLED")).toBe(false);
  });

  it("statuts finaux : WON / LOST / CANCELLED", () => {
    expect(isOfferFinal("WON")).toBe(true);
    expect(isOfferFinal("LOST")).toBe(true);
    expect(isOfferFinal("CANCELLED")).toBe(true);
    expect(isOfferFinal("DRAFT")).toBe(false);
    expect(isOfferFinal("SENT")).toBe(false);
  });

  it("le message d'erreur diffère pour WON et SENT", () => {
    expect(offerLockMessage("WON")).toMatch(/figée définitivement/i);
    expect(offerLockMessage("SENT")).toMatch(/nouvelle version/i);
    expect(offerLockMessage("DRAFT")).toBe("");
  });
});
