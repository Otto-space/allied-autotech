import { describe, expect, it } from "vitest";
import { publicServiceCopy } from "../../src/modules/service-operations/public-service-copy.js";

describe("customer service descriptions", () => {
  it("removes verified import arithmetic while preserving scope and conditions", () => {
    const scope = "Full vehicle health check with a PDF copy of the scan result.";
    const conditions =
      "Confirm duration, parts, materials, tax and warranty with the team.";
    const original = `${scope} Authorised service amount: NGN 8,000, already reflecting the workbook’s 20% reduction from NGN 10,000. No additional discount is applied. ${conditions}`;
    expect(publicServiceCopy(original)).toBe(`${scope} ${conditions}`);
    expect(original).toContain("workbook");
  });
  it("retains alignment quantity, duration and warranty", () => {
    expect(
      publicServiceCopy(
        "3D correction of all four wheels. Authorised amount: NGN 4,000, already reflecting the 20% reduction from NGN 5,000. Listed duration: one hour; listed warranty: seven days.",
      ),
    ).toBe(
      "3D correction of all four wheels. Listed duration: one hour; listed warranty: seven days.",
    );
  });
  it("does not censor actual discount conditions, package boundaries or new authoring", () => {
    for (const text of [
      "No additional discount is applied.",
      "A 20% promotional discount applies only to labour until the published expiry.",
      "This is distinct from Basic Oil Service, which has a different scope and amount.",
      "Authorised amount: NGN 5,000. Materials are excluded.",
      "Check the import paperwork and warranty before accepting the work.",
    ])
      expect(publicServiceCopy(text)).toBe(text);
    expect(publicServiceCopy(null)).toBeNull();
  });
  it("does not remove an independent condition when import arithmetic occurs elsewhere", () => {
    const note =
      "Authorised amount: NGN 4,000, already reflecting the 20% reduction from NGN 5,000.";
    expect(
      publicServiceCopy(`No additional discount is applied. Confirm materials. ${note}`),
    ).toBe("No additional discount is applied. Confirm materials.");
  });
});
