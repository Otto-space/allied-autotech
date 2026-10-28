import { describe, expect, it } from "vitest";
import draft from "../../../backend/data/vehicle-drafts/bmw-120i-2007.json";
import { importVehicleDraft } from "@/lib/forms/vehicle-draft-import";
import { vehicleRecordBody } from "@/lib/forms/vehicle-record";
const branch = "11111111-1111-4111-8111-111111111111";
describe("owner BMW preparation", () => {
  it("imports the same stable stock identity without inventing unknowns or publication commands", () => {
    const values = importVehicleDraft(draft, branch);
    expect(importVehicleDraft(draft, branch)).toEqual(values);
    expect(values.branchId).toBe(branch);
    expect(values.stockNumber).toBe("OWNER-BMW120I-2007-01");
    const body = vehicleRecordBody(values, false);
    expect(body).toMatchObject({
      engineCode: "N46",
      cylinders: 4,
      engineCapacityCc: 2000,
      mileageKm: null,
      transmission: null,
      fuelType: null,
      color: null,
      manufactureCountryCode: null,
      ownerReportedIssues:
        "AC not working. Owner reports a leak. Diagnosis and repair required.",
    });
    expect(body).not.toHaveProperty("priceKobo");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("acquisitionCostKobo");
  });
  it("rejects branch, price, lifecycle injection, out-of-range specs and unknown formats", () => {
    for (const extra of [
      { priceKobo: "0" },
      { branchId: branch },
      { status: "AVAILABLE" },
      { format: "unknown" },
    ])
      expect(() => importVehicleDraft({ ...draft, ...extra }, branch)).toThrow();
    expect(() =>
      importVehicleDraft(
        { ...draft, vehicle: { ...draft.vehicle, cylinders: 0 } },
        branch,
      ),
    ).toThrow();
    expect(() => importVehicleDraft(draft, "")).toThrow();
  });
});
