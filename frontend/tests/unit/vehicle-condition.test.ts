import { expect, it } from "vitest";
import {
  conditionFindings,
  conditionFormSchema,
  lagosDateTime,
} from "../../lib/forms/vehicle-condition";
import { inspectionSchema, listingSchema } from "../../lib/api/vehicle-schemas";
const values = {
  inspectionId: "",
  inspectedAt: "2026-09-17T13:05",
  odometer: "",
  score: "0",
  summary: "Observed condition",
  findings: [],
};
it("retains zero, false and null finding values without overwriting named fields", () => {
  expect(
    conditionFindings([
      { name: "Count", type: "NUMBER", value: "0" },
      { name: "Warning", type: "NO", value: "" },
      { name: "Unknown", type: "NOT_RECORDED", value: "" },
    ]),
  ).toEqual({ Count: 0, Warning: false, Unknown: null });
  expect(
    conditionFormSchema.safeParse({
      ...values,
      findings: [
        { name: "Tyres", type: "TEXT", value: "A" },
        { name: " Tyres ", type: "TEXT", value: "B" },
      ],
    }).success,
  ).toBe(false);
});
it("rejects invalid dates, non-finite numeric findings and out-of-range readings", () => {
  expect(lagosDateTime.safeParse("2026-02-30T13:05").success).toBe(false);
  expect(conditionFormSchema.safeParse({ ...values, score: "101" }).success).toBe(false);
  expect(
    conditionFormSchema.safeParse({
      ...values,
      findings: [{ name: "Value", type: "NUMBER", value: "Infinity" }],
    }).success,
  ).toBe(false);
  expect(conditionFormSchema.safeParse(values).success).toBe(true);
});
it("accepts an unrecorded odometer in public listings and customer inspection reports", () => {
  const report = {
    id: "90000000-0000-4000-8000-000000000001",
    inspectedAt: "2026-09-17T12:05:00Z",
    summary: "Observed condition",
    odometerKm: null,
    conditionScore: null,
  };
  expect(
    listingSchema.shape.vehicle.shape.conditionReports.parse([report])[0].odometerKm,
  ).toBeNull();
  expect(inspectionSchema.shape.conditionReport.parse(report)?.odometerKm).toBeNull();
});
