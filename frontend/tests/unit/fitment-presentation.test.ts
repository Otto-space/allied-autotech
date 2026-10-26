import { describe, expect, it } from "vitest";
import {
  evidenceGaps,
  fitmentYears,
  primaryFitmentQualifiers,
  nonCriticalFitmentTypes,
} from "@/lib/admin/fitment-presentation";
import type { StaffFitmentRule } from "@/lib/admin/parts-fitment";

const rule = (overrides = {}) =>
  ({
    scope: "MODEL",
    vehicleModelId: "model",
    yearFrom: 2010,
    yearTo: 2020,
    safetyCritical: false,
    sourceReference: "Manufacturer reference",
    evidenceNotes: "Test coverage",
    allVariantsConfirmed: true,
    requiredQualifiers: [],
    ...overrides,
  }) as unknown as StaffFitmentRule;
describe("fitment presentation preserves evidence meaning", () => {
  it("never describes missing model years as unrestricted", () => {
    expect(fitmentYears(null, null)).toBe("Start year missing – end year missing");
    expect(evidenceGaps(rule({ yearFrom: null }))).toContain(
      "Model-year range incomplete",
    );
  });
  it("distinguishes evidence completion from independent approval", () => {
    expect(evidenceGaps(rule({ reviewStatus: "DRAFT" }))).toEqual([]);
    expect(
      evidenceGaps(
        rule({
          vehicleModelId: null,
          sourceReference: null,
          evidenceNotes: " ",
          allVariantsConfirmed: false,
        }),
      ),
    ).toHaveLength(4);
  });
  it("keeps safety requirements and populated advanced fields prominent", () => {
    const saved = rule({
      safetyCritical: true,
      market: "Japan",
      requiredQualifiers: ["trim"],
    });
    expect(primaryFitmentQualifiers("OIL_FILTER", saved)).toEqual(
      expect.arrayContaining(["position", "brakeSystem", "market", "trim"]),
    );
    expect(evidenceGaps(saved)).toContain(
      "Safety-critical position and brake evidence required",
    );
    expect(nonCriticalFitmentTypes.has("Engine Oil Filter")).toBe(false);
    expect(nonCriticalFitmentTypes.has("OIL_FILTER")).toBe(true);
  });
});
