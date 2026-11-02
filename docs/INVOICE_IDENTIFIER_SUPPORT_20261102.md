# Verified invoice identity support — 2 November 2026

Status: runtime 59068ee4 published on both domains and backend on 2 November. Purchasing,
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

## Publication gates (now passed)

Require exact-master frontend/backend/secret CI, final hosted form/document checks,
matching four-image backend release, fresh read-only production safety and backup/
restore evidence, held frontend candidate, then verified backend readiness and both
public aliases. The preceding runtime was frontend c44d7d68 / backend f0402b67. Preserve the preceding releases and all unrelated worktrees.

Final local backend/frontend types and scoped lint passed. Real multi-page PDF generation with an 80-character identifier passed. Both live aliases were rechecked and still map to dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6; no premature promotion occurred.

## Production publication

Runtime: 59068ee4f89efc9ba33c44967d99642563b7914b. Exact-master CI passed:
frontend 41403654184, backend 41403654187 and secrets 41403654199. Frontend CI
passed 1,314 units (12 existing skips), types/lint/format/build and zero production
dependency audit findings. The development-inclusive install still reports the
existing 22 findings (21 moderate, one high); dependencies were not changed.

All four immutable images built and nine packaged-image/TLS/runtime checks passed.
Backend deployment 3141a019-da25-4231-80e8-7935f6a33b9c became ACTIVE, 16/16,
with all four digests matched. Only image digests changed; no SQL migration,
permission, tax/rounding, provider or feature-flag setting changed.

Frontend dpl_9HWiLQfY5421gq2etamHH7Mv3eyc is live on alliedautotech.com and
www.alliedautotech.com; www redirects to apex. The preceding frontend
(dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6) and backend source f0402b67 are retained.

The initial hosted run passed nine cases and reported asset preload advisories in
the staff console check. The original test passed on the preceding live release.
The unchanged candidate then passed all ten final hosted checks with strict console
assertions intact and no retries/skips. This is a recorded transient advisory,
not a claimed font/CSS fix. Two actual public candidate checks passed at 390/1440.

Read-only production verification at 07:22 UTC passed strict TLS, all 85 migration
checks, restricted runtime privileges and eight worker heartbeats. Temporary
firewall access was removed and verified. Eight managed backups were listed,
latest 2 November 05:22 UTC; the 1 November 17:59 populated restore rehearsal is
reused only because schema/migration/safety code is unchanged. This was not a new
PITR restore or production data write.

Changed runtime surfaces: finance policy schemas/form, invoice snapshot/document
schemas, customer/staff invoice previews, PDF renderer and restricted learning
content. Canonical API types were regenerated. Exact owner/accountant identity,
applicability, rounding approval and service-invoice timing remain unresolved in
finance-review-20261101.md; no placeholder was recorded as business data.

Four live public checks passed after promotion (apex/www, 390/1440), with no page
errors and booking gates preserved. The adjacent finance-workspace test helper was
updated to enter the new verified-identifier fields; all 15 hosted cases passed,
including seven widths, draft retention, stale-version denial, revoked access and
lost/wrong-actor receipt reconciliation. This follow-up changes tests/docs only;
it does not require rebuilding the already checked and published runtime.

Before/after: the approval form previously had no dedicated identifier fields;
it now asks for verified values and focuses invalid fields without losing other
entries. Recorded identifiers appear in invoice previews/PDFs. Old records remain
unchanged and do not acquire identifiers from a newer policy. No calculation,
transaction scope or authorisation was relaxed.
