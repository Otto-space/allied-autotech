# Verified invoice identity support — 2 November 2026

Status: implementation and local verification; not yet published. Purchasing,
payment-provider and booking-deposit gates are unchanged. No actual identifier,
policy approval, invoice, payment or customer record was created or modified.

## Change and compatibility

New finance approvals require the owner/accountant-verified Tax ID and CAC
registration number. Empty values, common placeholders, control characters and
values longer than 80 characters are rejected. Unresolved applicability is a
remaining owner/accountant decision, not an automatic exemption. Existing
capability, MFA, source/evidence, effective-date, concurrency and review checks
remain authoritative. Entering an identifier is not verification by this software.

Historical finance settings remain readable without identifiers. Newly recorded
issuer fields flow from the transaction's policy snapshot into invoice/receipt
snapshots and PDFs; customer and staff invoice previews show only recorded fields.
No lookup against current policy is added and no historic snapshot is backfilled.
Policy settings and invoice snapshots already use JSON; no Prisma schema or SQL
migration changes are required. Backend and frontend contracts are regenerated.

Financial-policy Help content is version 4, behind its existing eligibility gate.
No tutorial or feature flag grants access or activates purchasing. Existing tax,
discount rounding and payment terms are unchanged; the finance review packet still
lists the unresolved approvals and arithmetic difference.

## Evidence so far

- Backend focused units: 36 passed; frontend contract/receipt units: 11 passed.
- Restricted learning/catalogue/retrieval: 18 passed; API validation: 414 paths.
- Initial fresh isolated database: all 85 migrations replayed and db:check passed;
  40 tests passed, 3 provisioned-only tests skipped. Restricted runtime role used;
  task-owned temporary container removed. Final portable HTTP verification passed
  40 tests in four files with no skips, including missing-identifier rejection and
  no-policy-write checks, after another fresh 85-migration replay/db:check. Its
  uniquely owned temporary container was removed. Evidence: temporary directory
  aat-invoice-identity-c69c8334e4.
- Initial local Edge browser matrix: 47 passed, 4 failed. Three finance fixtures
  omitted the notification summary response; corrected the fixture, not runtime.
  One concurrency fixture changed the invoice before review, so development effect
  replay consumed the change; it now changes the record after opening review.
- Corrected focused browser run: 7 passed, 1 failed. Admin/owner approval, stale
  invoice rejection, 320/1440 invalid-field focus and staff identifier rendering pass.
  Staff approval interactions/Axe checks complete but the strict console assertion
  reports a Next development not-found.css preload warning. The assertion remains
  intact; final production-build hosted verification is required before release.
- Customer identifier wrapping, scoped Axe and legacy omission passed at 320/1440.
  Safe synthetic captures: invoice-identifiers-320.png and -1440.png in the task's
  visualization folder. These are fixture acceptance, not real-account acceptance.

No real merchant transaction, financial approval or fitment sign-in acceptance is
claimed. Owner cannot currently access fitment. Broader brief and external policy
requirements remain tracked in MOBILE_FITMENT_SIMPLIFICATION_20261101.md.

## Publication requirements

Require exact-master frontend/backend/secret CI, final hosted form/document checks,
matching four-image backend release, fresh read-only production safety and backup/
restore evidence, held frontend candidate, then verified backend readiness and both
public aliases. Existing runtime remains frontend c44d7d68 / backend f0402b67 until
those checks pass. Preserve the preceding releases and all unrelated worktrees.

Final local backend/frontend types and scoped lint passed. Real multi-page PDF generation with an 80-character identifier passed. Both live aliases were rechecked and still map to dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6; no premature promotion occurred.
