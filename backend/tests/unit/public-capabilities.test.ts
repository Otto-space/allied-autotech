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

const originalEnvironment = env.DEPLOYMENT_ENV;
const originalMode = env.PUBLIC_LAUNCH_MODE;
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
  vi.restoreAllMocks();
});

describe("public policy availability summary", () => {
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
