import { expect, it } from "vitest";
import { quoteSchema } from "../../lib/api/booking-schemas";
import { staffQuoteSchema } from "../../lib/api/staff-booking-schemas";
import { emptyServiceLine, serviceLinesFormSchema } from "../../lib/forms/service-lines";
const quote = {
  id: "a7000000-0000-4000-8000-000000000001",
  quoteNumber: "SYNTHETIC-ADDITIONAL",
  version: 2,
  revision: 1,
  status: "ISSUED",
  totalKobo: "5375",
  subtotalKobo: "5000",
  taxKobo: "375",
  expiresAt: null,
  notes: null,
  items: [],
};
it("preserves legacy quotations while requiring a complete additional-work context", () => {
  expect(quoteSchema.safeParse(quote).success).toBe(true);
  const extra = {
    ...quote,
    originalInvoice: { invoiceNumber: "SYNTHETIC-ORIGINAL" },
    amendmentReason: "Explicit additional inspection",
  };
  expect(quoteSchema.parse(extra).amendmentReason).toBe(extra.amendmentReason);
  expect(staffQuoteSchema.safeParse(extra).success).toBe(true);
  for (const invalid of [
    { ...extra, amendmentReason: undefined },
    { ...extra, originalInvoice: null },
    { ...extra, amendmentReason: " " },
  ]) {
    expect(quoteSchema.safeParse(invalid).success).toBe(false);
    expect(staffQuoteSchema.safeParse(invalid).success).toBe(false);
  }
});
it("requires a reason only for explicit additional work and retains the original form contract", () => {
  const base = {
    items: [{ ...emptyServiceLine(), description: "Synthetic check", unitPrice: "50" }],
    notes: "",
    expiresAt: "2027-01-01T10:00",
  };
  expect(serviceLinesFormSchema.safeParse(base).success).toBe(true);
  expect(
    serviceLinesFormSchema.safeParse({
      ...base,
      additionalWork: true,
      amendmentReason: "",
    }).success,
  ).toBe(false);
  expect(
    serviceLinesFormSchema.safeParse({
      ...base,
      additionalWork: true,
      amendmentReason: "Reviewed new items",
    }).success,
  ).toBe(true);
});
