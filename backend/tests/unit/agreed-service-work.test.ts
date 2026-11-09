import { describe, expect, it } from "vitest";
import {
  assertAgreedWorkScope,
  priceAgreedWorkInputs,
} from "../../src/modules/service-operations/agreed-service-work.js";
import type { PricedLine } from "../../src/modules/service-operations/service-operations.types.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
const material: PricedLine = {
  type: "PART",
  productId: "a7000000-0000-4000-8000-000000000001",
  description: "Agreed material",
  quantity: 2,
  unitPriceKobo: 10001n,
  subtotalKobo: 20002n,
};
const labour: PricedLine = {
  type: "LABOUR",
  productId: null,
  description: "Agreed fitting",
  quantity: 1,
  unitPriceKobo: 5001n,
  subtotalKobo: 5001n,
};
const agreed = [material, labour];
it("keeps updated work guidance in existing permission gates with explicit financial boundaries", () => {
  for (const [id, gate, version] of [
    ["service-request", "public", 34],
    ["financial-policy-work", "financial-policy", 9],
    ["assigned-findings", "jobs", 6],
    ["job-assignment", "assign", 3],
  ] as const) {
    const guide = learningArticles.find((article) => article.id === id)!;
    expect(guide.gate).toBe(gate);
    expect(guide.version).toBe(version);
    expect(guide.steps.length).toBeLessThanOrEqual(12);
    expect(guide.steps.join(" ")).toContain("agreement");
  }
  const finance = learningArticles.find(
    (article) => article.id === "financial-policy-work",
  )!;
  expect(finance.steps.join(" ")).toContain("engineering choice");
  expect(finance.steps.join(" ")).toContain("Historical invoices retain");
  const technician = learningArticles.find(
    (article) => article.id === "assigned-findings",
  )!;
  expect(technician.steps.join(" ")).toContain(
    "does not grant payment-record access or vehicle-release authority",
  );
});
describe("accepted service work scope", () => {
  it("allows an agreed labour subset without claiming the whole job complete", () => {
    expect(() => assertAgreedWorkScope(agreed, [labour])).not.toThrow();
    expect(() => assertAgreedWorkScope(agreed, [labour], true)).toThrow(
      /all agreed work/,
    );
    expect(() => assertAgreedWorkScope(agreed, agreed, true)).not.toThrow();
  });
  it("counts split and repeated lines against one accepted quantity", () => {
    const one = { ...material, quantity: 1, subtotalKobo: 10001n };
    expect(() => assertAgreedWorkScope(agreed, [one, one, labour], true)).not.toThrow();
    expect(() => assertAgreedWorkScope(agreed, [one, one, one])).toThrow(
      /accepted quotation/,
    );
    expect(() => assertAgreedWorkScope([one, one], [material], true)).not.toThrow();
  });
  it.each([
    { ...material, productId: "a7000000-0000-4000-8000-000000000002" },
    { ...material, type: "FEE" as const, productId: null },
    { ...material, description: "Silent extra" },
    { ...material, unitPriceKobo: 10002n, subtotalKobo: 20004n },
    { ...material, quantity: 3, subtotalKobo: 30003n },
    { ...material, subtotalKobo: 20001n },
    { ...material, quantity: 0, subtotalKobo: 0n },
  ])("rejects changed identity, pricing, quantity or arithmetic %#", (line) => {
    expect(() => assertAgreedWorkScope(agreed, [line])).toThrow();
  });
  it("does not complete or start an empty work order", () => {
    expect(() => assertAgreedWorkScope(agreed, [])).toThrow(/Prepare/);
  });
  it("uses the accepted material price and description instead of repricing", () => {
    expect(
      priceAgreedWorkInputs(agreed, [
        { type: "PART", productId: material.productId!, quantity: 1 },
      ]),
    ).toEqual([{ ...material, quantity: 1, subtotalKobo: 10001n }]);
  });
  it("requires exact accepted labour amounts and identities", () => {
    expect(
      priceAgreedWorkInputs(agreed, [
        {
          type: "LABOUR",
          description: labour.description,
          quantity: 1,
          unitPriceKobo: "5001",
        },
      ]),
    ).toEqual([labour]);
    expect(() =>
      priceAgreedWorkInputs(agreed, [
        {
          type: "LABOUR",
          description: labour.description,
          quantity: 1,
          unitPriceKobo: "5002",
        },
      ]),
    ).toThrow(/exact item/);
    expect(() =>
      priceAgreedWorkInputs(agreed, [
        { type: "FEE", description: "Extra", quantity: 1, unitPriceKobo: "0" },
      ]),
    ).toThrow();
  });
  it("requires a description when the same part has distinct agreed uses", () => {
    const alternative = { ...material, description: "Second agreed use" };
    const input = { type: "PART" as const, productId: material.productId!, quantity: 1 };
    expect(() => priceAgreedWorkInputs([material, alternative], [input])).toThrow(
      /exact item/,
    );
    expect(
      priceAgreedWorkInputs(
        [material, alternative],
        [{ ...input, description: alternative.description }],
      )[0]!.description,
    ).toBe(alternative.description);
  });
});
