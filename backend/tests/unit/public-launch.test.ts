import { assertPublicLaunchEnvironment, env } from "../../src/config/env.js";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { publicLaunch } from "../../src/common/middleware/public-launch.js";
import { errorHandler } from "../../src/common/middleware/error-handler.js";

function fixture(mode: "full" | "browse_enquiries" | "catalogue") {
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

describe("catalogue launch has no public customer intake", () => {
  it.each([
    "/public/support/enquiries",
    "/public/support/complaints",
    "/public/booking-response/confirm",
    "/auth/register",
    "/AUTH/REGISTER/",
    "/customers/support/enquiries",
    "/customers/profile",
    "/customers/orders/checkout",
    "/customers/reviews",
    "/webhooks/paystack",
    "/webhooks/monnify",
  ])("blocks direct writes before domain handlers: %s", async (path) => {
    for (const method of ["post", "put", "patch", "delete"] as const) {
      const response = await request(fixture("catalogue"))[method](`/api/v1${path}`);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });
  it("also closes customer read routes", async () => {
    expect(
      (await request(fixture("catalogue")).get("/api/v1/customers/profile")).status,
    ).toBe(403);
  });
  it.each([
    "/public/services",
    "/public/catalog/products",
    "/public/vehicles",
    "/public/branches",
    "/public/support/reviews",
    "/health/ready",
  ])("preserves public reads: %s", async (path) => {
    expect((await request(fixture("catalogue")).get(`/api/v1${path}`)).status).toBe(204);
  });
  it.each([
    "/auth/login",
    "/auth/logout",
    "/auth/csrf",
    "/auth/mfa/challenge/verify",
    "/auth/password/forgot",
    "/admin/services",
    "/staff/vehicles",
  ])("preserves existing authentication and permission checks: %s", async (path) => {
    expect((await request(fixture("catalogue")).post(`/api/v1${path}`)).status).toBe(204);
  });
  it("requires payment providers to remain disabled", () => {
    expect(() =>
      assertPublicLaunchEnvironment({
        ...env,
        PUBLIC_LAUNCH_MODE: "catalogue",
        PAYSTACK_LIVE_ENABLED: true,
      }),
    ).toThrow();
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
