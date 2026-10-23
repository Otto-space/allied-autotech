import { describe, expect, it } from "vitest";
import {
  decideFitment,
  type PublishedRule,
} from "../../src/modules/fitment/fitment.engine.js";
import {
  qualifierKeys,
  ruleWriteSchema,
  selectionQuerySchema,
} from "../../src/modules/fitment/fitment.schemas.js";

const modelId = "f6000000-0000-4000-8000-000000000018";
const ruleId = "f6000000-0000-4000-8000-000000000019";
function rule(overrides: Partial<PublishedRule> = {}): PublishedRule {
  return {
    ...(Object.fromEntries(qualifierKeys.map((key) => [key, null])) as Record<
      (typeof qualifierKeys)[number],
      null
    >),
    id: ruleId,
    reviewStatus: "APPROVED",
    scope: "MODEL",
    effect: "INCLUDE",
    vehicleModelId: modelId,
    yearFrom: 2014,
    yearTo: 2019,
    safetyCritical: true,
    allVariantsConfirmed: true,
    sourceReference: "Synthetic manufacturer catalogue reference used only in tests",
    reviewedAt: new Date(),
    requiredQualifiers: ["engineCode", "market", "position", "brakeSystem"],
    engineCode: "2ZR-FE",
    market: "Japan",
    position: "front",
    brakeSystem: "Akebono",
    ...overrides,
  };
}
const corolla = { vehicleModelId: modelId, year: 2018 };
const complete = {
  ...corolla,
  engineCode: "2zr-fe",
  market: "JAPAN",
  position: "Front",
  brakeSystem: "akebono",
};

describe("reviewed vehicle fitment", () => {
  it("treats Toyota Corolla 2018 brake pads as candidates until technical details match", () => {
    expect(decideFitment([rule()], corolla)).toMatchObject({
      status: "NEEDS_VERIFICATION",
      missingQualifiers: ["engineCode", "market", "position", "brakeSystem"],
    });
    expect(decideFitment([rule()], complete)).toMatchObject({
      status: "VERIFIED_FIT",
      matchedRuleIds: [ruleId],
    });
    expect(decideFitment([rule()], { ...complete, year: 2020 }).status).toBe("UNKNOWN");
    expect(
      decideFitment([rule()], {
        ...complete,
        vehicleModelId: "f6000000-0000-4000-8000-000000000020",
      }).status,
    ).toBe("UNKNOWN");
  });
  it.each(["engineCode", "market", "position", "brakeSystem"] as const)(
    "never treats a missing %s as a wildcard",
    (key) => {
      const selection = { ...complete };
      delete (selection as Partial<typeof complete>)[key];
      expect(decideFitment([rule()], selection)).toMatchObject({
        status: "NEEDS_VERIFICATION",
        missingQualifiers: [key],
      });
      expect(
        decideFitment([rule()], { ...complete, [key]: "different specification" }).status,
      ).toBe("UNKNOWN");
    },
  );
  it.each(["DRAFT", "PENDING", "REJECTED", "RETIRED"])(
    "ignores %s rules, regardless of their apparent match",
    (reviewStatus) => {
      expect(decideFitment([rule({ reviewStatus })], complete).status).toBe("UNKNOWN");
    },
  );
  it("requires real reviewed evidence and never upgrades malformed critical scope", () => {
    for (const override of [
      { sourceReference: null },
      { reviewedAt: null },
      { allVariantsConfirmed: false },
    ])
      expect(decideFitment([rule(override)], complete).status).toBe("UNKNOWN");
    expect(decideFitment([rule({ brakeSystem: null })], complete).status).not.toBe(
      "VERIFIED_FIT",
    );
  });
  it("gives explicit exclusions precedence and withholds verification when an exclusion may apply", () => {
    const broad = rule({
      safetyCritical: false,
      requiredQualifiers: [],
      engineCode: null,
      market: null,
      position: null,
      brakeSystem: null,
    });
    const exclusion = rule({
      id: "f6000000-0000-4000-8000-000000000021",
      effect: "EXCLUDE",
    });
    expect(decideFitment([broad, exclusion], complete).status).toBe("NOT_COMPATIBLE");
    expect(decideFitment([broad, exclusion], corolla).status).toBe("NEEDS_VERIFICATION");
    expect(
      decideFitment([broad, exclusion], { ...complete, market: "Europe" }).status,
    ).toBe("VERIFIED_FIT");
  });
  it("distinguishes a reviewed universal accessory from vehicle-specific evidence", () => {
    const universal = rule({
      scope: "UNIVERSAL",
      safetyCritical: false,
      vehicleModelId: null,
      yearFrom: null,
      yearTo: null,
      engineCode: null,
      market: null,
      position: null,
      brakeSystem: null,
      requiredQualifiers: [],
    });
    expect(decideFitment([universal], corolla)).toMatchObject({
      status: "VERIFIED_FIT",
      scope: "UNIVERSAL",
      message: expect.stringContaining("no vehicle-specific fitment"),
    });
    expect(decideFitment([], corolla).status).toBe("UNKNOWN");
  });
  it("rejects invalid year ranges, hidden query fields and restricted universal rules", () => {
    expect(
      selectionQuerySchema.safeParse({
        vehicleModelId: modelId,
        year: "2018",
        reviewedByUserId: ruleId,
      }).success,
    ).toBe(false);
    expect(
      selectionQuerySchema.parse({
        vehicleModelId: modelId,
        year: "2018",
        engineCode: "２ＺＲ",
      }).engineCode,
    ).toBe("2ZR");
    expect(
      ruleWriteSchema.safeParse({ vehicleModelId: modelId, yearFrom: 2020, yearTo: 2018 })
        .success,
    ).toBe(false);
    expect(
      ruleWriteSchema.safeParse({ scope: "UNIVERSAL", safetyCritical: true }).success,
    ).toBe(false);
    expect(
      ruleWriteSchema.safeParse({
        scope: "UNIVERSAL",
        safetyCritical: false,
        market: "Japan",
      }).success,
    ).toBe(false);
  });
});
