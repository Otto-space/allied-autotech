import { describe, expect, it } from "vitest";
import {
  selectedPickupLines,
  samePickupLines,
  pickupIssueResultSchema,
} from "../../lib/order-pickup";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
describe("private collection review", () => {
  it("binds chosen quantities to actual remaining goods", () => {
    const form = new FormData();
    form.set(id, "2");
    form.set(other, "0");
    expect(
      selectedPickupLines(form, [
        { orderItemId: id, quantity: 3 },
        { orderItemId: other, quantity: 1 },
      ]),
    ).toEqual([{ orderItemId: id, quantity: 2 }]);
    form.set(id, "4");
    expect(() => selectedPickupLines(form, [{ orderItemId: id, quantity: 3 }])).toThrow();
    form.set(id, "0");
    expect(() => selectedPickupLines(form, [{ orderItemId: id, quantity: 3 }])).toThrow();
  });
  it("compares actual receipt lines independent of JSON property order", () => {
    expect(
      samePickupLines(
        [
          { orderItemId: id, quantity: 1 },
          { orderItemId: other, quantity: 2 },
        ],
        [
          { quantity: 2, orderItemId: other },
          { quantity: 1, orderItemId: id },
        ],
      ),
    ).toBe(true);
    expect(
      samePickupLines(
        [{ orderItemId: id, quantity: 1 }],
        [{ orderItemId: other, quantity: 1 }],
      ),
    ).toBe(false);
  });
  it("allows an issuance replay with no redisplayed secret, rejecting malformed raw secrets", () => {
    const result = {
      orderId: id,
      authorisationId: other,
      pickupCode: null,
      expiresAt: "2026-11-10T12:00:00Z",
      replayed: true,
    };
    expect(pickupIssueResultSchema.parse(result).pickupCode).toBeNull();
    expect(
      pickupIssueResultSchema.safeParse({
        ...result,
        pickupCode: "public-order-reference",
      }).success,
    ).toBe(false);
  });
});
