import { assertPublicLaunchEnvironment, env } from "../../src/config/env.js";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { publicLaunch } from "../../src/common/middleware/public-launch.js";
import { errorHandler } from "../../src/common/middleware/error-handler.js";

function fixture(
  mode: "full" | "browse_enquiries" | "catalogue",
  controls: Parameters<typeof publicLaunch>[1] = {
    bookingRequestsEnabled: true,
    productPurchasesEnabled: true,
  },
) {
  const app = express();
  app.use("/api/v1", publicLaunch(mode, controls));
  app.use((_req, res) => res.status(204).end());
  app.use(errorHandler);
  return app;
}

describe("public browsing/enquiries launch boundary", () => {
  it.each([
    "/customers/cart/items",
    "/customers/orders/checkout",
    "/customers/parts-quotes/record/accept",
    "/customers/parts-quotes/record/decline",
    "/customers/bookings",
    "/customers/payments",
    "/customers/vehicle-transactions",
    "/customers/vehicle-transactions/record/reserve",
    "/customers/vehicle-inspections",
    "/public/booking-response/confirm",
    "/CUSTOMERS/ORDERS/checkout",
    "/purchase/orders",
    "/purchase/payments/record/checkout",
    "/purchase/parts-quotes/record/accept",
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
    "/purchase/access/request",
    "/purchase/access/verify",
    "/purchase/access/csrf",
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

describe("independent appointment and purchasing release controls", () => {
  it("fails closed if a full-mode router omits explicit module controls", async () => {
    const app = express();
    app.use("/api/v1", publicLaunch("full"));
    app.use((_req, res) => res.status(204).end());
    app.use(errorHandler);
    expect((await request(app).post("/api/v1/customers/bookings")).status).toBe(403);
    expect((await request(app).post("/api/v1/purchase/orders")).status).toBe(403);
    expect((await request(app).get("/api/v1/public/services")).status).toBe(204);
  });
  const appointmentPaths = [
    "/customers/bookings",
    "/customers/vehicle-inspections",
    "/public/booking-response/confirm",
  ];
  const purchasePaths = [
    "/customers/cart/items",
    "/customers/orders/checkout",
    "/customers/parts-quotes/record/accept",
    "/customers/payments",
    "/customers/vehicle-transactions/record/reserve",
    "/purchase/orders",
    "/purchase/payments/record/checkout",
    "/purchase/parts-quotes/record/accept",
  ];
  it.each([true, false])(
    "keeps unpaid appointment requests separate when booking is %s",
    async (bookingRequestsEnabled) => {
      const app = fixture("full", {
        bookingRequestsEnabled,
        productPurchasesEnabled: false,
      });
      for (const path of appointmentPaths)
        expect((await request(app).post(`/api/v1${path}`)).status).toBe(
          bookingRequestsEnabled ? 204 : 403,
        );
      for (const path of purchasePaths)
        for (const method of ["post", "put", "patch", "delete"] as const)
          expect((await request(app)[method](`/api/v1${path}`)).status).toBe(403);
      for (const path of ["/customers/orders", "/customers/bookings"])
        expect((await request(app).get(`/api/v1${path}`)).status).toBe(204);
      for (const path of ["/staff/bookings", "/admin/services", "/webhooks/paystack"])
        expect((await request(app).post(`/api/v1${path}`)).status).toBe(204);
    },
  );
  it("does not make appointments available by enabling purchasing", async () => {
    const app = fixture("full", {
      bookingRequestsEnabled: false,
      productPurchasesEnabled: true,
    });
    for (const path of appointmentPaths)
      expect((await request(app).post(`/api/v1${path}`)).status).toBe(403);
    for (const path of purchasePaths)
      expect((await request(app).post(`/api/v1${path}`)).status).toBe(204);
  });
  it("does not let enabled switches override a restricted mode", async () => {
    const app = fixture("browse_enquiries", {
      bookingRequestsEnabled: true,
      productPurchasesEnabled: true,
    });
    for (const path of [...appointmentPaths, ...purchasePaths])
      expect((await request(app).post(`/api/v1${path}`)).status).toBe(403);
  });
  it("requires explicit independent choices before production full-mode startup", () => {
    const runtime = {
      ...env,
      NODE_ENV: "production" as const,
      DEPLOYMENT_ENV: "production" as const,
      PUBLIC_LAUNCH_MODE: "full" as const,
    };
    expect(() => assertPublicLaunchEnvironment(runtime, {})).toThrow(
      /BOOKING_REQUESTS_ENABLED/,
    );
    expect(() =>
      assertPublicLaunchEnvironment(runtime, {
        BOOKING_REQUESTS_ENABLED: "true",
      }),
    ).toThrow(/PRODUCT_PURCHASES_ENABLED/);
    expect(() =>
      assertPublicLaunchEnvironment(runtime, {
        BOOKING_REQUESTS_ENABLED: "true",
        PRODUCT_PURCHASES_ENABLED: "false",
      }),
    ).not.toThrow();
  });
});

describe("catalogue launch has no public customer intake", () => {
  it.each([
    "/public/support/enquiries",
    "/public/support/complaints",
    "/public/booking-response/confirm",
    "/auth/register",
    "/AUTH/REGISTER/",
    "/purchase/access/request",
    "/purchase/orders",
    "/customers/support/enquiries",
    "/customers/profile",
    "/customers/orders/checkout",
    "/customers/parts-quotes/record/accept",
    "/customers/parts-quotes/record/decline",
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
