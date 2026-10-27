import { assertPublicLaunchEnvironment, env } from "../../src/config/env.js";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { publicLaunch } from "../../src/common/middleware/public-launch.js";
import { errorHandler } from "../../src/common/middleware/error-handler.js";

function fixture(mode: "full" | "browse_enquiries") {
  const app = express();
  app.use("/api/v1", publicLaunch(mode));
  app.use((_req, res) => res.status(204).end());
  app.use(errorHandler);
  return app;
}

describe("public browsing/enquiries launch boundary", () => {
  it.each([
    "/customers/cart/items",
    "/customers/orders/checkout",
    "/customers/bookings",
    "/customers/payments",
    "/customers/vehicle-transactions",
    "/customers/vehicle-transactions/record/reserve",
    "/customers/vehicle-inspections",
    "/public/booking-response/confirm",
    "/CUSTOMERS/ORDERS/checkout",
  ])("rejects direct transaction requests: %s", async (path) => {
    const result = await request(fixture("browse_enquiries")).post(`/api/v1${path}`);
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("FORBIDDEN");
  });
  it.each(["put", "patch", "delete"] as const)("also rejects %s", async (method) => {
    expect(
      (
        await request(fixture("browse_enquiries"))[method](
          "/api/v1/customers/cart/items/item",
        )
      ).status,
    ).toBe(403);
  });
  it.each([
    "/public/support/enquiries",
    "/public/support/complaints",
    "/auth/login",
    "/auth/register",
    "/auth/email/verify",
    "/admin/services",
    "/staff/vehicles",
    "/webhooks/paystack",
    "/webhooks/monnify",
    "/customers/support/enquiries",
  ])("preserves existing security/handler checks for %s", async (path) => {
    expect(
      (await request(fixture("browse_enquiries")).post(`/api/v1${path}`)).status,
    ).toBe(204);
  });
  it.each(["get", "head", "options"] as const)(
    "leaves %s routing intact",
    async (method) => {
      expect(
        (await request(fixture("browse_enquiries"))[method]("/api/v1/customers/orders"))
          .status,
      ).toBe(204);
    },
  );
  it("preserves full-mode transactions and does not match lookalike paths", async () => {
    expect(
      (await request(fixture("full")).post("/api/v1/customers/orders/checkout")).status,
    ).toBe(204);
    expect(
      (await request(fixture("browse_enquiries")).post("/api/v1/customers/orders-help"))
        .status,
    ).toBe(204);
  });
});

it("refuses payment provider activation in browse/enquiries mode", () => {
  const safe = {
    ...env,
    PUBLIC_LAUNCH_MODE: "browse_enquiries" as const,
    PAYSTACK_MODE: "disabled" as const,
    MONNIFY_MODE: "disabled" as const,
    PAYSTACK_LIVE_ENABLED: false,
    MONNIFY_LIVE_ENABLED: false,
    PAYMENT_RECONCILIATION_ENABLED: false,
  };
  expect(() => assertPublicLaunchEnvironment(safe)).not.toThrow();
  expect(() =>
    assertPublicLaunchEnvironment({ ...safe, PAYSTACK_MODE: "test" }),
  ).toThrow();
  expect(() =>
    assertPublicLaunchEnvironment({ ...safe, MONNIFY_MODE: "sandbox" }),
  ).toThrow();
  expect(() =>
    assertPublicLaunchEnvironment({ ...safe, PAYSTACK_LIVE_ENABLED: true }),
  ).toThrow();
  expect(() =>
    assertPublicLaunchEnvironment({ ...safe, PAYMENT_RECONCILIATION_ENABLED: true }),
  ).toThrow();
});
