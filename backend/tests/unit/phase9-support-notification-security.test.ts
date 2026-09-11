import { describe, expect, it } from "vitest";
import { assertPaystackMode, env } from "../../src/config/env.js";
import { renderNotificationEmail } from "../../src/modules/notifications/notification-delivery.templates.js";
import {
  customerComplaintListQuerySchema,
  customerEnquiryListQuerySchema,
  reviewCreateBodySchema,
} from "../../src/modules/support/support.schemas.js";

describe("Phase 9 support, delivery, and staging safeguards", () => {
  it("keeps enquiry and complaint status filters strictly separated", () => {
    expect(
      customerEnquiryListQuerySchema.safeParse({ status: "INVESTIGATING" }).success,
    ).toBe(false);
    expect(
      customerComplaintListQuerySchema.safeParse({ status: "IN_PROGRESS" }).success,
    ).toBe(false);
  });

  it("requires both an owned completed booking and service for service reviews", () => {
    expect(
      reviewCreateBodySchema.safeParse({
        targetType: "SERVICE",
        serviceId: "6d1893bc-d2f8-4bab-a069-7d0814af89ae",
        rating: 5,
        comment: "Synthetic review",
      }).success,
    ).toBe(false);
  });

  it("requires ratings and a purchase line for product reviews", () => {
    expect(
      reviewCreateBodySchema.safeParse({
        targetType: "PRODUCT",
        productId: "6d1893bc-d2f8-4bab-a069-7d0814af89ae",
        orderItemId: "4c52e0f1-4fef-49c5-8fa7-73478a7bcf0e",
        rating: 4,
        comment: "Synthetic verified-purchase review",
      }).success,
    ).toBe(true);
    expect(
      reviewCreateBodySchema.safeParse({
        targetType: "PRODUCT",
        productId: "6d1893bc-d2f8-4bab-a069-7d0814af89ae",
        comment: "Missing rating and purchase line",
      }).success,
    ).toBe(false);
  });

  it("accepts a rated overall business review without a transaction target", () => {
    expect(
      reviewCreateBodySchema.safeParse({
        targetType: "BUSINESS",
        rating: 5,
        comment: "Synthetic overall experience review",
      }).success,
    ).toBe(true);
  });

  it("escapes untrusted notification content before HTML rendering", () => {
    const rendered = renderNotificationEmail({
      channel: "EMAIL",
      recipient: "synthetic@example.test",
      title: "<script>alert(1)</script>",
      message: "Hello & <b>unsafe</b>",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<b>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("requires test-mode Paystack independently of NODE_ENV in staging", () => {
    expect(() =>
      assertPaystackMode({
        ...env,
        DEPLOYMENT_ENV: "staging",
        PAYSTACK_MODE: "disabled",
        PAYSTACK_SECRET_KEY: undefined,
      }),
    ).toThrow("Staging requires PAYSTACK_MODE=test");
    expect(() =>
      assertPaystackMode({
        ...env,
        DEPLOYMENT_ENV: "staging",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_synthetic_not_a_real_key",
      }),
    ).not.toThrow();
    expect(() =>
      assertPaystackMode({
        ...env,
        DEPLOYMENT_ENV: "staging",
        PAYSTACK_MODE: "live",
        PAYSTACK_LIVE_ENABLED: true,
        PAYSTACK_SECRET_KEY: "sk_live_synthetic_not_a_real_key",
      }),
    ).toThrow();
  });
});
