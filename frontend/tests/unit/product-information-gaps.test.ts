import { expect, it } from "vitest";
import { productInformationGaps } from "@/lib/admin/product-information-gaps";
import { productRecord } from "../fixtures/work-products";

it("identifies genuine missing product facts without treating stock or an unreviewed rule as compatibility approval", () => {
  const record = productRecord(2);
  expect(productInformationGaps(record)).toEqual(
    expect.arrayContaining([
      "Brand",
      "Manufacturer part number",
      "Description",
      "Genuine product photographs",
      "Condition",
      "OEM or aftermarket classification",
      "Reviewed vehicle compatibility evidence",
    ]),
  );
  expect(record.availability).toHaveLength(1);
});

it("asks for oil grade and pack volume, not replacement-part fields the oil contract deliberately omits", () => {
  const record = {
    ...productRecord(1),
    family: "ENGINE_OIL" as const,
    condition: null,
    classification: null,
  };
  const gaps = productInformationGaps(record);
  expect(gaps).toContain("Oil viscosity grade");
  expect(gaps).toContain("Pack volume");
  expect(gaps).not.toContain("Condition");
  expect(gaps).not.toContain("OEM or aftermarket classification");
  expect(gaps).not.toContain("Reviewed vehicle compatibility evidence");
});
