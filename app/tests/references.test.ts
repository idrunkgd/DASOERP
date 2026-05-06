import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma BEFORE import
vi.mock("@/lib/db", () => ({
  prisma: {
    offer: { count: vi.fn(), findUniqueOrThrow: vi.fn() },
    project: { count: vi.fn() },
    missionRequest: { count: vi.fn() }
  }
}));

import { prisma } from "@/lib/db";
import { nextOfferReference, nextProjectReference, nextComplementReference, nextMissionReference } from "@/lib/references";

describe("Références", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offre OFF-AAAA-0001 quand 0 offre racine", async () => {
    (prisma.offer.count as any).mockResolvedValue(0);
    const ref = await nextOfferReference(2026);
    expect(ref).toBe("OFF-2026-0001");
  });

  it("projet PRJ-AAAA-0042 quand 41 projets", async () => {
    (prisma.project.count as any).mockResolvedValue(41);
    expect(await nextProjectReference(2026)).toBe("PRJ-2026-0042");
  });

  it("complément reprend la ref parent + -CN", async () => {
    (prisma.offer.findUniqueOrThrow as any).mockResolvedValue({ id: "p", reference: "OFF-2026-0001" });
    (prisma.offer.count as any).mockResolvedValue(2); // 2 compléments existent → suivant = -C3
    const ref = await nextComplementReference("p");
    expect(ref).toBe("OFF-2026-0001-C3");
  });

  it("mission DEM-AAAA-NNNN", async () => {
    (prisma.missionRequest.count as any).mockResolvedValue(7);
    expect(await nextMissionReference(2026)).toBe("DEM-2026-0008");
  });
});
