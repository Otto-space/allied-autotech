import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import type { BusinessPolicyVersion } from "../../src/generated/prisma/client.js";
import {
  safeCapabilities,
  publicFulfillmentOptions,
} from "../../src/modules/policies/policies.service.js";
import { publicCapabilitiesSchema } from "../../src/modules/policies/policies.schemas.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";

const originalEnvironment = env.DEPLOYMENT_ENV;
const originalMode = env.PUBLIC_LAUNCH_MODE;
const originalBookings = env.BOOKING_REQUESTS_ENABLED;
const originalPurchases = env.PRODUCT_PURCHASES_ENABLED;
const now = new Date("2026-09-24T12:00:00Z");
const address =
  "133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria";
const deliverySettings = {
  collectionEnabled: true,
  collectionAddress: address,
  zones: [
    {
      id: "synthetic-zone",
      label: "Test area",
      city: "Port Harcourt",
      state: "Rivers",
      feeKobo: "10000",
    },
  ],
};
function policy(
  key: string,
  approvalStatus = "APPROVED",
  settings: BusinessPolicyVersion["settings"] = {},
): BusinessPolicyVersion {
  return {
    id: randomUUID(),
    key,
    version: 7,
    approvalStatus,
    effectiveAt: now,
    recordedAt: now,
    source: "PRIVATE TEST SOURCE",
    sourceQuestion: "TEST",
    sourceSignatory: "PRIVATE SIGNATORY",
    approvedByUserId: randomUUID(),
    approvalEvidence: "PRIVATE TEST EVIDENCE",
    settings,
  };
}
afterEach(() => {
  env.DEPLOYMENT_ENV = originalEnvironment;
  env.PUBLIC_LAUNCH_MODE = originalMode;
  env.BOOKING_REQUESTS_ENABLED = originalBookings;
  env.PRODUCT_PURCHASES_ENABLED = originalPurchases;
  vi.restoreAllMocks();
});

describe("public policy availability summary", () => {
  it("blocks both checkout engines before data writes when purchasing is closed", async () => {
    env.PUBLIC_LAUNCH_MODE = "full";
    env.BOOKING_REQUESTS_ENABLED = true;
    env.PRODUCT_PURCHASES_ENABLED = false;
    const transaction = vi.spyOn(prisma, "$transaction");
    const service = new OrdersService(prisma);
    const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
    const branchId = randomUUID();
    await expect(
      service.checkout(
        {
          userId: randomUUID(),
          sessionId: randomUUID(),
          role: "CUSTOMER",
          email: "synthetic@example.test",
          mfaRequired: false,
          mfaVerifiedAt: null,
        },
        { branchId, fulfillmentMethod: "COLLECTION" },
        "synthetic-independent-gates",
        context,
      ),
    ).rejects.toThrow("Online purchasing is not available");
    await expect(
      service.guestCheckout(
        { sessionToken: "synthetic", csrfToken: "synthetic" },
        {
          branchId,
          fulfillmentMethod: "COLLECTION",
          contact: { name: "Synthetic buyer", phone: "+2348000000000" },
          items: [{ productId: randomUUID(), quantity: 1 }],
        },
        "synthetic-independent-gates",
        context,
      ),
    ).rejects.toThrow("Online purchasing is not available");
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([
    [true, false],
    [false, true],
    [false, false],
    [true, true],
  ])(
    "reports independent booking=%s purchasing=%s with approved finance",
    async (bookings, purchases) => {
      env.PUBLIC_LAUNCH_MODE = "full";
      env.DEPLOYMENT_ENV = "production";
      env.BOOKING_REQUESTS_ENABLED = bookings;
      env.PRODUCT_PURCHASES_ENABLED = purchases;
      vi.spyOn(prisma.businessPolicyVersion, "findFirst").mockResolvedValue(
        policy("finance", "APPROVED"),
      );
      const summary = publicCapabilitiesSchema.parse(await safeCapabilities(prisma, now));
      expect(summary.release.bookingRequestsEnabled).toBe(bookings);
      expect(summary.release.inspectionRequestsEnabled).toBe(bookings);
      expect(summary.checkoutEnabled).toBe(purchases);
      expect((await publicFulfillmentOptions(prisma, now)).checkoutEnabled).toBe(
        purchases,
      );
    },
  );
  it("does not require invoice identity or finance approval for unpaid requests", async () => {
    env.PUBLIC_LAUNCH_MODE = "full";
    env.DEPLOYMENT_ENV = "production";
    env.BOOKING_REQUESTS_ENABLED = true;
    env.PRODUCT_PURCHASES_ENABLED = false;
    vi.spyOn(prisma.businessPolicyVersion, "findFirst").mockResolvedValue(null);
    const summary = await safeCapabilities(prisma, now);
    expect(summary.release.bookingRequestsEnabled).toBe(true);
    expect(summary.checkoutEnabled).toBe(false);
    expect(summary.finance.approvalStatus).toBeNull();
  });
  it.each([
    {
      name: "missing finance",
      finance: null,
      deployment: "production" as const,
      delivery: deliverySettings,
      checkout: false,
      enabled: false,
    },
    {
      name: "unapproved production finance",
      finance: policy("finance", "DRAFT", { deliveryTaxable: true }),
      deployment: "production" as const,
      delivery: deliverySettings,
      checkout: false,
      enabled: false,
    },
    {
      name: "private draft testing",
      finance: policy("finance", "DRAFT", { deliveryTaxable: true }),
      deployment: "staging" as const,
      delivery: deliverySettings,
      checkout: true,
      enabled: true,
    },
    {
      name: "approved production finance",
      finance: policy("finance", "APPROVED", { deliveryTaxable: false }),
      deployment: "production" as const,
      delivery: deliverySettings,
      checkout: true,
      enabled: true,
    },
    {
      name: "absent delivery tax decision",
      finance: policy("finance"),
      deployment: "production" as const,
      delivery: deliverySettings,
      checkout: true,
      enabled: false,
    },
    {
      name: "malformed delivery configuration",
      finance: policy("finance", "APPROVED", { deliveryTaxable: true }),
      deployment: "production" as const,
      delivery: {},
      checkout: true,
      enabled: false,
    },
  ])(
    "matches checkout gates for $name",
    async ({ finance, deployment, delivery, checkout }) => {
      env.DEPLOYMENT_ENV = deployment;
      const deliveryPolicy = policy("delivery", "APPROVED", delivery);
      const lookup = vi
        .spyOn(prisma.businessPolicyVersion, "findFirst")
        .mockResolvedValueOnce(deliveryPolicy)
        .mockResolvedValueOnce(policy("vehicle"))
        .mockResolvedValueOnce(finance)
        .mockResolvedValueOnce(finance);
      const summary = publicCapabilitiesSchema.parse(await safeCapabilities(prisma, now));
      const fulfillment = await publicFulfillmentOptions(prisma, now);
      expect(summary).toMatchObject({
        scope: "POLICY_SUMMARY",
        serverTime: now.toISOString(),
        checkoutEnabled: checkout,
        collection: { enabled: true, address },
        delivery: { enabled: false },
        vehicleDeposits: { enabled: checkout },
        finance: { approvalStatus: finance?.approvalStatus ?? null },
        marketing: { enabled: false },
        destructiveRetention: { enabled: false },
      });
      expect(summary.delivery.enabled).toBe(fulfillment.delivery.enabled);
      expect(summary.checkoutEnabled).toBe(fulfillment.checkoutEnabled);
      expect(JSON.stringify(summary)).not.toContain("PRIVATE");
      expect(summary).not.toHaveProperty("settings");
      for (const [args] of lookup.mock.calls) {
        expect(args).toMatchObject({
          where: { effectiveAt: { lte: now } },
          orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
          select: { version: true, approvalStatus: true, settings: true },
        });
      }
    },
  );
  it.each(["full", "browse_enquiries", "catalogue"] as const)(
    "reports the actual %s runtime and never advertises limited-mode checkout",
    async (mode) => {
      env.PUBLIC_LAUNCH_MODE = mode;
      env.DEPLOYMENT_ENV = "production";
      vi.spyOn(prisma.businessPolicyVersion, "findFirst").mockResolvedValue(
        policy("finance", "APPROVED"),
      );
      const summary = await safeCapabilities(prisma, now);
      expect(summary.release).toEqual({
        mode,
        customerAccountsEnabled: mode !== "catalogue",
        enquiriesEnabled: mode !== "catalogue",
        bookingRequestsEnabled: mode === "full",
        inspectionRequestsEnabled: mode === "full",
      });
      expect(summary.checkoutEnabled).toBe(mode === "full");
      expect(summary.vehicleDeposits.enabled).toBe(mode === "full");
      expect((await publicFulfillmentOptions(prisma, now)).checkoutEnabled).toBe(
        mode === "full",
      );
    },
  );
  it("does not fabricate enabled availability when policy reads fail", async () => {
    vi.spyOn(prisma.businessPolicyVersion, "findFirst").mockRejectedValue(
      Error("Synthetic database read failure"),
    );
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/public/capabilities");
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body).not.toHaveProperty("data");
    expect(JSON.stringify(response.body)).not.toContain("Synthetic database");
  });
  it("returns a no-store public API projection without authorizing missing policies", async () => {
    vi.spyOn(prisma.businessPolicyVersion, "findFirst").mockResolvedValue(null);
    const app = createApp({ checkReadiness: async () => undefined });
    const response = await request(app).get("/api/v1/public/capabilities");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(publicCapabilitiesSchema.parse(response.body.data)).toMatchObject({
      checkoutEnabled: false,
      finance: { approvalStatus: null },
      delivery: { enabled: false },
      vehicleDeposits: { enabled: false },
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
  it("does not advertise unapproved vehicle or delivery policies", async () => {
    vi.spyOn(prisma.businessPolicyVersion, "findFirst")
      .mockResolvedValueOnce(policy("delivery", "DRAFT", deliverySettings))
      .mockResolvedValueOnce(policy("vehicle", "DRAFT"))
      .mockResolvedValueOnce(policy("finance", "APPROVED", { deliveryTaxable: true }));
    expect(await safeCapabilities(prisma, now)).toMatchObject({
      checkoutEnabled: true,
      delivery: { enabled: false },
      vehicleDeposits: { enabled: false },
    });
  });
});
