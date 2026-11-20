import { describe, expect, it } from "vitest";
import {
  assertServicePaymentPlanTotals,
  buildServicePaymentPlan,
  servicePaymentPlanSchema,
  servicePaymentBinding,
  servicePaymentPlanFromSnapshot,
  serviceStagePaid,
  serviceStagePayable,
} from "../../src/modules/billing/service-payment-plan.js";

const id = (n: number) => `f7300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const line = (n: number, type: "PART" | "LABOUR" | "FEE", amount: bigint) => ({
  id: id(n),
  type,
  quantity: 1,
  unitPriceKobo: amount,
  subtotalKobo: amount,
});

describe("separate service obligations", () => {
  const plan = buildServicePaymentPlan(quote, totals);
  const paidMaterials = {
    status: "SUCCEEDED",
    amountKobo: 101n,
    policySnapshot: {
      servicePayment: {
        quoteId: quote.id,
        quoteVersion: 3,
        stage: "MATERIALS",
        invoiceVersion: 1,
        amountKobo: "101",
      },
    },
  };
  it("makes only the materials amount payable before work completion", () => {
    const paid = serviceStagePaid(plan, []);
    expect(serviceStagePayable(plan, paid, "MATERIALS", false)).toBe(101n);
    expect(() => serviceStagePayable(plan, paid, "WORKMANSHIP", false)).toThrow(
      /completion/,
    );
    expect(() => serviceStagePayable(plan, paid, "WORKMANSHIP", true)).toThrow(
      /materials/,
    );
  });
  it("keeps workmanship unavailable after materials payment until actual completion", () => {
    const paid = serviceStagePaid(plan, [paidMaterials]);
    expect(paid).toEqual({ MATERIALS: 101n, WORKMANSHIP: 0n });
    expect(() => serviceStagePayable(plan, paid, "WORKMANSHIP", false)).toThrow();
    expect(serviceStagePayable(plan, paid, "WORKMANSHIP", true)).toBe(201n);
    expect(() => serviceStagePayable(plan, paid, "MATERIALS", true)).toThrow(
      /no outstanding/,
    );
  });
  it("does not turn pending, review or expired requests into money received", () => {
    for (const status of [
      "PROCESSING",
      "REQUIRES_REVIEW",
      "REQUIRES_PAYMENT",
      "EXPIRED",
      "CANCELLED",
    ]) {
      expect(serviceStagePaid(plan, [{ ...paidMaterials, status }])).toEqual({
        MATERIALS: 0n,
        WORKMANSHIP: 0n,
      });
    }
  });
  it("refuses duplicate settled stage charges and unbound successful payments", () => {
    expect(() => serviceStagePaid(plan, [paidMaterials, paidMaterials])).toThrow(
      /exceed/,
    );
    expect(() =>
      serviceStagePaid(plan, [{ ...paidMaterials, policySnapshot: null }]),
    ).toThrow(/match/);
  });
  it("binds the exact quotation, stage and amount, never a client-supplied split", () => {
    for (const binding of [
      { ...paidMaterials.policySnapshot.servicePayment, quoteId: id(999) },
      { ...paidMaterials.policySnapshot.servicePayment, quoteVersion: 4 },
      { ...paidMaterials.policySnapshot.servicePayment, amountKobo: "100" },
      { ...paidMaterials.policySnapshot.servicePayment, stage: "UNKNOWN" },
    ])
      expect(() =>
        serviceStagePaid(plan, [
          { ...paidMaterials, policySnapshot: { servicePayment: binding } },
        ]),
      ).toThrow();
  });
  it("retains a missing legacy plan without retrofitting a new allocation", () => {
    for (const snapshot of [null, {}, { schemaVersion: 1 }])
      expect(servicePaymentPlanFromSnapshot(snapshot, totals)).toBeNull();
    expect(servicePaymentPlanFromSnapshot({ servicePaymentPlan: plan }, totals)).toEqual(
      plan,
    );
    expect(() =>
      servicePaymentPlanFromSnapshot({ servicePaymentPlan: null }, totals),
    ).toThrow();
    expect(() =>
      servicePaymentPlanFromSnapshot(
        { servicePaymentPlan: plan },
        { ...totals, totalKobo: 303n },
      ),
    ).toThrow();
  });
  it("reads only the named immutable payment binding and rejects malformed bindings", () => {
    expect(servicePaymentBinding(paidMaterials.policySnapshot)?.stage).toBe("MATERIALS");
    expect(servicePaymentBinding({ purpose: "SERVICE_INVOICE" })).toBeNull();
    expect(() => servicePaymentBinding({ servicePayment: {} })).toThrow();
  });
  it("settles both obligations exactly and offers no second charge", () => {
    const workmanship = {
      status: "SUCCEEDED",
      amountKobo: 201n,
      policySnapshot: {
        servicePayment: {
          ...paidMaterials.policySnapshot.servicePayment,
          stage: "WORKMANSHIP",
          invoiceVersion: 2,
          amountKobo: "201",
        },
      },
    };
    const paid = serviceStagePaid(plan, [paidMaterials, workmanship]);
    expect(paid).toEqual({ MATERIALS: 101n, WORKMANSHIP: 201n });
    expect(() => serviceStagePayable(plan, paid, "WORKMANSHIP", true)).toThrow(
      /no outstanding/,
    );
  });
});
const quote = {
  id: id(1),
  version: 3,
  items: [line(2, "PART", 100n), line(3, "LABOUR", 100n), line(4, "FEE", 100n)],
};
const totals = {
  subtotalKobo: 300n,
  taxKobo: 2n,
  depositCreditKobo: 0n,
  totalKobo: 302n,
};

describe("one accepted service sale with separate payment stages", () => {
  it("preserves the accepted tax total and allocates tied kobo in saved line order", () => {
    const plan = buildServicePaymentPlan(quote, totals);
    expect(plan.materials).toEqual({
      subtotalKobo: "100",
      taxKobo: "1",
      creditKobo: "0",
      totalKobo: "101",
    });
    expect(plan.workmanship).toEqual({
      subtotalKobo: "200",
      taxKobo: "1",
      creditKobo: "0",
      totalKobo: "201",
    });
    expect(plan.lines.map((item) => item.taxKobo)).toEqual(["1", "1", "0"]);
    expect(plan.lines.map((item) => item.stage)).toEqual([
      "MATERIALS",
      "WORKMANSHIP",
      "WORKMANSHIP",
    ]);
    expect(plan.quoteId).toBe(quote.id);
    expect(plan.quoteVersion).toBe(3);
    expect(plan.feeTiming).toBe("DEFER_UNTIL_WORK_COMPLETED");
  });
  it("allocates a genuine legacy credit once without changing the quoted sale", () => {
    const plan = buildServicePaymentPlan(quote, {
      ...totals,
      depositCreditKobo: 101n,
      totalKobo: 201n,
    });
    expect(plan.lines.reduce((sum, item) => sum + BigInt(item.creditKobo), 0n)).toBe(
      101n,
    );
    expect(BigInt(plan.materials.totalKobo) + BigInt(plan.workmanship.totalKobo)).toBe(
      201n,
    );
    expect(
      BigInt(plan.materials.subtotalKobo) + BigInt(plan.workmanship.subtotalKobo),
    ).toBe(300n);
  });
  it.each(["PART", "LABOUR", "FEE"] as const)(
    "supports a %s-only job without inventing another charge",
    (type) => {
      const plan = buildServicePaymentPlan(
        { ...quote, items: [line(2, type, 1n)] },
        { subtotalKobo: 1n, taxKobo: 0n, depositCreditKobo: 0n, totalKobo: 1n },
      );
      expect(plan.materials.totalKobo).toBe(type === "PART" ? "1" : "0");
      expect(plan.workmanship.totalKobo).toBe(type === "PART" ? "0" : "1");
    },
  );
  it("retains zero-price lines and a fully credited invoice without inventing a payment", () => {
    const zero = buildServicePaymentPlan(
      { ...quote, items: [line(2, "PART", 0n)] },
      { subtotalKobo: 0n, taxKobo: 0n, depositCreditKobo: 0n, totalKobo: 0n },
    );
    expect(zero.materials.totalKobo).toBe("0");
    const credited = buildServicePaymentPlan(quote, {
      ...totals,
      depositCreditKobo: 302n,
      totalKobo: 0n,
    });
    expect(credited.lines.every((item) => item.totalKobo === "0")).toBe(true);
  });
  it("uses exact arithmetic above the safe JavaScript integer range", () => {
    const amount = 9_007_199_254_740_993n;
    const plan = buildServicePaymentPlan(
      { ...quote, items: [line(2, "PART", amount)] },
      { subtotalKobo: amount, taxKobo: 1n, depositCreditKobo: 1n, totalKobo: amount },
    );
    expect(plan.materials.totalKobo).toBe(amount.toString());
  });
  it("reconciles every stage and line across mixed small tax and credit remainders", () => {
    for (let tax = 0n; tax <= 13n; tax++)
      for (let credit = 0n; credit <= 19n; credit++) {
        const source = {
          ...totals,
          taxKobo: tax,
          depositCreditKobo: credit,
          totalKobo: 300n + tax - credit,
        };
        const plan = buildServicePaymentPlan(quote, source);
        expect(() => assertServicePaymentPlanTotals(plan, source)).not.toThrow();
        expect(plan.lines.every((item) => BigInt(item.totalKobo) >= 0n)).toBe(true);
      }
  });
  it.each([
    { ...totals, subtotalKobo: 301n },
    { ...totals, taxKobo: -1n },
    { ...totals, depositCreditKobo: -1n },
    { ...totals, depositCreditKobo: 303n, totalKobo: -1n },
    { ...totals, totalKobo: 301n },
  ])("refuses inconsistent accepted amounts instead of repairing them", (amounts) => {
    expect(() => buildServicePaymentPlan(quote, amounts)).toThrow();
  });
  it("refuses unknown classification, duplicate IDs and corrupt source quantities", () => {
    for (const items of [
      [],
      [line(2, "PART", 100n), line(2, "PART", 100n), line(4, "FEE", 100n)],
      [{ ...line(2, "PART", 300n), quantity: 2 }],
      [{ ...line(2, "PART", 300n), type: "UNKNOWN" as "PART" }],
    ]) {
      expect(() => buildServicePaymentPlan({ ...quote, items }, totals)).toThrow();
    }
  });
  it("rejects tampered saved allocations, stage totals and excessive money", () => {
    const plan = buildServicePaymentPlan(quote, totals);
    const bad = structuredClone(plan);
    bad.lines[0]!.totalKobo = "100";
    expect(servicePaymentPlanSchema.safeParse(bad).success).toBe(false);
    const wrongStage = structuredClone(plan);
    wrongStage.materials.taxKobo = "0";
    expect(servicePaymentPlanSchema.safeParse(wrongStage).success).toBe(false);
    const huge = structuredClone(plan);
    huge.materials.totalKobo = "9223372036854775808";
    expect(servicePaymentPlanSchema.safeParse(huge).success).toBe(false);
    expect(() =>
      assertServicePaymentPlanTotals(plan, { ...totals, totalKobo: 303n }),
    ).toThrow();
  });
});
