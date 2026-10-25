import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  productCreateBodySchema,
  productUpdateBodySchema,
} from "../../src/modules/catalog/catalog.schemas.js";
import { productDiscoveryQuerySchema } from "../../src/modules/catalog/product-discovery.schemas.js";
const product = {
  categoryId: randomUUID(),
  name: "Synthetic oil",
  slug: "synthetic-oil",
  sku: "SYN-OIL",
  priceKobo: "2500000",
};
describe("Recorded product-family fields", () => {
  it("rejects incompatible family filters while preserving shared legacy filtering", () => {
    expect(
      productDiscoveryQuerySchema.safeParse({ oilViscosityGrade: "5W30" }).success,
    ).toBe(false);
    expect(
      productDiscoveryQuerySchema.safeParse({ family: "ENGINE_OIL", condition: "USED" })
        .success,
    ).toBe(false);
    expect(
      productDiscoveryQuerySchema.safeParse({
        family: "REPLACEMENT_PART",
        packVolumeMl: "1000",
      }).success,
    ).toBe(false);
    expect(
      productDiscoveryQuerySchema.safeParse({
        condition: "USED",
        productType: "OTHER_RECORDED_TYPE",
      }).success,
    ).toBe(true);
  });
  it("accepts recorded grade and an explicit pack volume without claiming suitability", () => {
    expect(
      productCreateBodySchema.parse({
        ...product,
        family: "ENGINE_OIL",
        oilViscosityGrade: "5W30",
        packVolumeMl: 5000,
      }),
    ).toMatchObject({
      family: "ENGINE_OIL",
      oilViscosityGrade: "5W-30",
      packVolumeMl: 5000,
    });
  });
  it("keeps missing oil attributes unknown and existing shared products valid", () => {
    expect(productCreateBodySchema.safeParse(product).success).toBe(true);
    expect(
      productCreateBodySchema.safeParse({ ...product, family: "ENGINE_OIL" }).success,
    ).toBe(true);
  });
  it("rejects invalid units/grade and unrelated condition classifications on oils", () => {
    for (const fields of [
      { packVolumeMl: 0 },
      { packVolumeMl: 1.5 },
      { packVolumeMl: "5L" },
      { oilViscosityGrade: "unknown approved" },
      { condition: "USED" },
      { classification: "GENUINE_OEM" },
    ])
      expect(
        productCreateBodySchema.safeParse({ ...product, family: "ENGINE_OIL", ...fields })
          .success,
      ).toBe(false);
  });
  it("does not accept oil attributes on replacement parts", () => {
    expect(
      productCreateBodySchema.safeParse({
        ...product,
        family: "REPLACEMENT_PART",
        oilViscosityGrade: "5W-30",
      }).success,
    ).toBe(false);
  });
  it("keeps partial updates possible for service-side merged-state validation", () => {
    expect(
      productUpdateBodySchema.safeParse({ oilViscosityGrade: "5W-40" }).success,
    ).toBe(true);
  });
});
