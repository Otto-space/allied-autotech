# Service invoice payment stages - held D03 source

This is implementation evidence, not a finance-policy publication or a completed
materials/vehicle-handover journey. Existing feature flags stay unchanged.

## Definitions and eligibility

- `service-request` v30, existing public gate and `/services` target. The payment
  explanation is combined with the price-review step, retaining twelve steps.
- `financial-policy-work` v6, existing independent `financial-policy` gate and
  financial-policy workspace target. It does not grant invoice or payment access.
- Booking-confirmation remains v14; attendance, resource and calendar guidance is
  preserved. No restricted corpus is imported into frontend code.

New staged service invoices retain one accepted sale and one saved tax amount.
Materials payment does not mark workmanship paid. The next request binds the
reviewed invoice version, exact stage and amount. Workmanship requires recorded
completion and settled materials. Customer uncertainty uses the original request;
refunds, disputes and unresolved payment anomalies require financial review.
Historical issued invoices retain their original treatment.

Deferring fees with workmanship is an implementation choice, not a newly supplied
owner approval. Procurement/install timing still needs the remaining D03 controls;
this guide does not claim that all installation or release actions are guarded yet.

## Acceptance

Existing eligibility/retrieval/identifier suites pass 51 cases. The financial gate
and the public service guidance are asserted without expanding permissions. The
client step bound remains twelve. A stale identifier-guide version assertion was
updated to the current v6; identity requirements were preserved. Native invoice,
payment, receipt and scoped administrator acceptance passes 122 cases; seven local
synthetic browser scenarios cover the presentation. See the completion tracker for
failed setup/guard/timeout attempts and the exact limitations of that evidence.

## Remaining financial policy fields

- Verified `invoiceTaxId` and applicable `invoiceCacNumber`, recorded by the actual
  authorised owner/accountant. Missing identifiers are not replaced with "none".
- Accountant verification of the retained VAT configuration/applicability; the
  existing 750 basis points and VAT-exclusive display are not silently reapproved.
- Actual authorised policy approval, provenance and effective time. Software and
  the synthetic example cannot create or impersonate this approval.
- Preserve the approved arithmetic, accepted-quote validity and distinct purchasing
  workflow. Seven-day quotation validity is not a credit period. D03's approved
  materials-first/workmanship-after-completion timing is already settled.
- Provider and real operational acceptance remain independent of invoice identity,
  quotation acceptance, booking readiness and synthetic test success.

A synthetic `SAMPLE-D03-NOT-ISSUED` two-page PDF is retained outside Git at
`%TEMP%/aat-d03-service-payments-20261109/sample-d03-not-issued.pdf`. It is marked
draft/not issued, contains no real customer/payment and explicitly notes unresolved
identity/tax verification. The actual renderer generated it; text and both rendered
pages were checked using existing PyMuPDF. It must not be used to request payment.

Full D03 publication still needs the materials-use, amendment and vehicle-release
controls, their complete acceptance, and the repository's exact-source release
and database safeguards. The wider D01-D17 goal remains active.
