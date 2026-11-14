import { describe, expect, it } from "vitest";
import {
  collectionHoldClock,
  collectionHoldPolicy,
} from "../../src/modules/orders/order-collection-clock.js";
const date = (s: string) => new Date(s);
describe("owner-approved five collection business days", () => {
  it.each([
    ["2026-11-02T08:00:00+01:00", "2026-11-02T09:00:00+01:00", "2026-11-07"],
    ["2026-11-06T08:00:00+01:00", "2026-11-09T09:00:00+01:00", "2026-11-14"],
    ["2026-11-08T08:00:00+01:00", "2026-11-08T09:00:00+01:00", "2026-11-13"],
    ["2026-12-24T08:00:00+01:00", "2026-12-24T09:00:00+01:00", "2026-12-30"],
    ["2026-12-31T08:00:00+01:00", "2026-12-31T09:00:00+01:00", "2027-01-06"],
    ["2026-11-02T23:30:00Z", "2026-11-02T23:40:00Z", "2026-11-09"],
    ["2026-11-04T09:00:00+01:00", "2026-11-02T09:00:00+01:00", "2026-11-10"],
  ])("counts after both actual events: %s / %s", (ready, notified, expected) => {
    expect(
      collectionHoldClock({
        readyAt: date(ready),
        notifiedAt: date(notified),
        now: date("2027-02-01T00:00:00Z"),
      }).collectByDate,
    ).toBe(expected);
  });
  it("keeps the entire collect-by date and changes only on the next Nigeria date", () => {
    const input = {
      readyAt: date("2026-11-02T08:00:00Z"),
      notifiedAt: date("2026-11-02T09:00:00Z"),
    };
    expect(
      collectionHoldClock({ ...input, now: date("2026-11-07T22:59:59.999Z") }).state,
    ).toBe("HOLDING");
    expect(
      collectionHoldClock({ ...input, now: date("2026-11-07T23:00:00Z") }).state,
    ).toBe("OVERDUE");
  });
  it("never starts on payment, estimates, missing notification or future evidence", () => {
    const now = date("2026-11-09T12:00:00Z");
    expect(collectionHoldClock({ readyAt: now, notifiedAt: null, now })).toMatchObject({
      state: "PENDING",
      reason: "NOTIFICATION_REQUIRED",
      collectByDate: null,
    });
    expect(collectionHoldClock({ readyAt: null, notifiedAt: now, now })).toMatchObject({
      state: "PENDING",
      reason: "READINESS_REQUIRED",
      collectByDate: null,
    });
    expect(() =>
      collectionHoldClock({ readyAt: new Date(NaN), notifiedAt: now, now }),
    ).toThrow();
    expect(() =>
      collectionHoldClock({
        readyAt: date("2026-11-10T00:00:00Z"),
        notifiedAt: now,
        now,
      }),
    ).toThrow();
  });
  it("retains owner provenance and the same rule for imported/custom parts", () => {
    expect(collectionHoldPolicy).toMatchObject({
      businessDays: 5,
      weekdays: [1, 2, 3, 4, 5, 6],
      excludePublicHolidays: false,
      includeAnchorDay: false,
      appliesTo: ["IN_STOCK", "SOURCED", "IMPORTED", "CUSTOM"],
      provenance: "OWNER_CHAT_20261109",
    });
  });
});

it("keeps pickup instructions behind current audience eligibility", async () => {
  const { learningArticles } =
    await import("../../src/modules/learning/learning.content.js");
  const { learningEligible, publicLearningAccess } =
    await import("../../src/modules/learning/learning.service.js");
  const customer = learningArticles.find((article) => article.id === "parts-collection")!;
  const staff = learningArticles.find(
    (article) => article.id === "staff-parts-collection",
  )!;
  expect([customer.version, staff.version]).toEqual([7, 6]);
  expect(staff.steps.join(" ")).toContain(
    "exclude only the verified refunded unfulfilled positions",
  );
  expect(staff.steps.join(" ")).toContain("never a zero-quantity handover");
  expect(learningEligible(publicLearningAccess, staff.gate)).toBe(false);
  expect(
    learningEligible(
      { ...publicLearningAccess, role: "CUSTOMER", verified: true },
      staff.gate,
    ),
  ).toBe(false);
  expect(
    learningEligible(
      { ...publicLearningAccess, role: "STAFF", verified: false },
      staff.gate,
    ),
  ).toBe(false);
  expect(
    learningEligible(
      { ...publicLearningAccess, role: "STAFF", verified: true },
      staff.gate,
    ),
  ).toBe(true);
  expect(
    learningEligible(
      { ...publicLearningAccess, role: "CUSTOMER", verified: true },
      customer.gate,
    ),
  ).toBe(true);
});

it("rejects a private pickup code from Allie prompts without blocking instructions", async () => {
  const { containsAllieSecret } =
    await import("../../src/modules/learning/allie.safety.js");
  expect(containsAllieSecret("x".repeat(43))).toBe(true);
  expect(containsAllieSecret("My pickup code is " + "_".repeat(43))).toBe(true);
  expect(containsAllieSecret("How do I create or revoke my private pickup code?")).toBe(
    false,
  );
});

it("retains the saved holding policy across JSONB key ordering and refuses unknown policies", async () => {
  const { assertCollectionHoldPolicySnapshot } =
    await import("../../src/modules/orders/order-collection-hold.js");
  const jsonb = Object.fromEntries(Object.entries(collectionHoldPolicy).reverse());
  expect(() => assertCollectionHoldPolicySnapshot(jsonb)).not.toThrow();
  expect(() =>
    assertCollectionHoldPolicySnapshot({ ...jsonb, version: "UNAPPROVED_REPLACEMENT" }),
  ).toThrow();
});
