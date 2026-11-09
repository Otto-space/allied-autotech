import { describe, expect, it } from "vitest";
import {
  financeSettingsSchema,
  financeApprovalSettingsSchema,
  publishPolicyBodySchema,
} from "../../src/modules/policies/policies.schemas.js";
import { issuerFromPolicy } from "../../src/modules/billing/document-snapshot.js";
import { invoiceSnapshotSchema } from "../../src/modules/billing/document.schemas.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
const historical = {
  vatBasisPoints: 750,
  pricesIncludeVat: false,
  rounding: "HALF_UP_MINOR_UNIT",
  discountTreatment: "BEFORE_VAT",
  deliveryTaxable: false,
  invoiceName: "Synthetic company",
  invoiceAddress: "Synthetic workshop address",
  paymentTerms: "Synthetic terms for testing only",
  applicability: "ALL_PRODUCTS_AND_SERVICES",
};
const verified = {
  ...historical,
  invoiceTaxId: "TEST-TAX-001",
  invoiceCacNumber: "TEST-CAC-001",
};
const publication = (settings: unknown) => ({
  kind: "FINANCE",
  expectedVersion: 1,
  effectiveAt: "2026-11-02T12:00:00Z",
  source: "Synthetic test source",
  approvalEvidence: "Synthetic test evidence only",
  settings,
});
describe("verified invoice identifiers", () => {
  it("reads historical settings but rejects a new approval without verified identifiers", () => {
    expect(financeSettingsSchema.parse(historical)).toEqual(historical);
    expect(publishPolicyBodySchema.safeParse(publication(historical)).success).toBe(
      false,
    );
    expect(publishPolicyBodySchema.parse(publication(verified))).toEqual(
      publication(verified),
    );
  });
  it.each([
    "",
    "none",
    "N/A",
    "pending",
    "unknown",
    "awaiting verification",
    "not applicable",
    "TEST\nID",
    "x".repeat(81),
  ])("rejects missing, placeholder or unsafe identifier %j", (value) => {
    expect(
      financeApprovalSettingsSchema.safeParse({ ...verified, invoiceTaxId: value })
        .success,
    ).toBe(false);
    expect(
      financeApprovalSettingsSchema.safeParse({ ...verified, invoiceCacNumber: value })
        .success,
    ).toBe(false);
  });
  it("copies only the recorded issuer fields and does not backfill older snapshots", () => {
    const policy = { settings: { ...verified }, approvalEvidence: "private evidence" };
    const issuer = issuerFromPolicy(policy);
    expect(issuer).toEqual({
      name: historical.invoiceName,
      address: historical.invoiceAddress,
      paymentTerms: historical.paymentTerms,
      taxId: "TEST-TAX-001",
      cacNumber: "TEST-CAC-001",
    });
    policy.settings.invoiceTaxId = "LATER-TAX";
    expect(issuer.taxId).toBe("TEST-TAX-001");
    expect(
      invoiceSnapshotSchema.shape.issuer.parse(
        issuerFromPolicy({ settings: historical }),
      ),
    ).not.toHaveProperty("taxId");
  });
  it("keeps identifier guidance behind the existing financial-policy eligibility gate", () => {
    const article = learningArticles.find(
      (entry) => entry.id === "financial-policy-work",
    )!;
    expect(article.gate).toBe("financial-policy");
    expect(article.version).toBe(6);
    expect(article.steps.join(" ")).toContain("never substitute placeholders");
  });
});
