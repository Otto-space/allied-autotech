import { servicePrice, serviceSchema } from "../../src/features/services/contracts";
import { serviceFixture } from "../fixtures/services";

test("displays exact server kobo, zero and unknown pricing without computing payable totals", () => {
  expect(servicePrice(serviceFixture)).toBe("₦12,500.50");
  expect(servicePrice({ ...serviceFixture, priceKobo: "0" })).toBe("₦0.00");
  expect(servicePrice({ ...serviceFixture, priceKobo: null })).toBe("Price unavailable");
  expect(servicePrice({ ...serviceFixture, pricingType: "QUOTE_REQUIRED" })).toBe(
    "Quote required",
  );
});
test.each([
  { priceKobo: 12500 },
  { priceKobo: "12.50" },
  { priceKobo: "12500\n" },
  { currency: "USD" },
  { isActive: false },
  { id: "not-a-uuid" },
  { name: "" },
])("rejects unusable public service data: %j", (change) => {
  expect(serviceSchema.safeParse({ ...serviceFixture, ...change }).success).toBe(false);
});
