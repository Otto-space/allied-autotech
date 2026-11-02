import { describe, expect, it } from "vitest";
import {
  financeSettingsSchema,
  financeApprovalSettingsSchema,
} from "@/lib/api/policy-schemas";
import { invoiceDocumentSchema } from "@/lib/api/document-schemas";
import { financePolicyRow } from "../fixtures/work-finance-policy";
describe("invoice identifier contracts", () => {
  it("keeps historical settings readable while requiring identifiers for new approval", () => {
    const old = financeSettingsSchema.parse(financePolicyRow(4).settings);
    expect(financeApprovalSettingsSchema.safeParse(old).success).toBe(false);
    expect(
      financeApprovalSettingsSchema.safeParse({
        ...old,
        invoiceTaxId: "TEST-TAX-001",
        invoiceCacNumber: "TEST-CAC-001",
      }).success,
    ).toBe(true);
    expect(
      financeApprovalSettingsSchema.safeParse({
        ...old,
        invoiceTaxId: "none",
        invoiceCacNumber: "pending",
      }).success,
    ).toBe(false);
  });
  it("preserves recorded identifiers and never invents them for historic invoices", () => {
    const old = {
      name: "Synthetic company",
      address: "Synthetic address",
      paymentTerms: "",
    };
    expect(invoiceDocumentSchema.shape.issuer.parse(old)).toEqual(old);
    const saved = { ...old, taxId: "TEST-TAX-001", cacNumber: "TEST-CAC-001" };
    expect(invoiceDocumentSchema.shape.issuer.parse(saved)).toEqual(saved);
  });
});
