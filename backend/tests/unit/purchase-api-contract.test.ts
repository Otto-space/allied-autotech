import { describe, expect, it } from "vitest";
import { createOpenApiDocument } from "../../src/openapi/document.js";

describe("separate purchase API contract", () => {
  it("documents the guest cookie without granting an account role or misdirecting guest CSRF recovery", () => {
    const doc = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
    expect(doc.components?.securitySchemes?.purchaseGuestCookie).toMatchObject({
      name: "__Host-aat_purchase",
      in: "cookie",
      type: "apiKey",
    });
    const read = doc.paths?.["/purchase/orders/{orderId}"]?.get;
    expect(read?.security).toEqual([{ purchaseGuestCookie: [] }]);
    expect(read?.["x-required-roles"]).toEqual(["PURCHASE_GUEST"]);
    expect(read?.["x-access-boundary"]).toBe("verified-purchase-guest");
    const checkout = doc.paths?.["/purchase/orders"]?.post;
    expect(checkout?.["x-csrf-required"]).toBe(true);
    expect(checkout?.["x-idempotency-required"]).toBe(true);
    expect(checkout?.["x-trusted-origin-required"]).toBe(true);
    expect(checkout?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "x-csrf-token",
          description: expect.stringContaining("/purchase/access/csrf"),
        }),
      ]),
    );
    const bootstrap = doc.paths?.["/purchase/access/csrf"]?.post;
    expect(bootstrap?.security).toEqual([{ purchaseGuestCookie: [] }]);
    expect(bootstrap?.["x-trusted-origin-required"]).toBe(true);
    expect(bootstrap?.["x-csrf-required"]).toBe(false);
    expect(doc.paths?.["/purchase/access/verify"]?.post?.security).toEqual([]);
  });
});
