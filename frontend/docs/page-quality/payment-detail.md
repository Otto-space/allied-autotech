# Customer payment detail

Route: `/dashboard/payments/[paymentId]`. Review date: 8 October 2026.

**Status: local page gate passed.** BG-07 has local backend/frontend acceptance. This is the eighteenth completed frontend milestone; it does not certify deployed providers, storage or the rest of the application. The full application goal remains open.

## Audit and scope

The previous page used one long column, raw status labels and unconditional Paystack/Monnify controls. Provider configuration was available internally but absent from the owned payment-detail response. Mutation completion could outlive route/session changes, and checkout responses needed provider-specific destination and deadline checks.

This page is customer-only. It retains owned payment reads, server amounts, online initialization and verification, manual reporting, evidence preparation and review. It links existing related records without inventing invoice availability or bank details. Booking deposits remain unavailable.

The new owned read adds `checkoutProviders`, with enabled registered provider names only, after ownership checks. Its controller returns `Cache-Control: no-store`. This is informational availability; initialization still applies current domain rules. No provider is enabled by this change, and no schema migration is introduced. See [BG-07](../../../BACKEND_IMPLEMENTATION_GAPS.md#payment-checkout-availability--implemented-locally).

## Design and interaction

Three [fresh concepts](payment-oct-concepts/README.md) were created before implementation, following baseline captures at 390, 768, 1280 and 1440 pixels. The layout uses a navy reference/amount/status panel, linked records, compact checkout and manual-report sections, and a full-width attempt history. Narrow screens use one column. The existing customer shell and Nippo/Quicksand remain in use.

Online initialization rechecks the current payable and available provider before writing. Unknown outcomes retain the original idempotency key; recovery does not start a different provider request. Returned checkout URLs must be HTTPS, unexpired and allowlisted for the selected provider. Callback navigation alone never confirms payment.

Manual reports retain their reviewed body and key after an uncertain response. Receipt validation binds the returned record to its payment, amount, currency, purpose and payable targets. Successful submissions clear the draft. Session changes abort in-flight work and clear customer input. Review dialog focus restoration waits for refresh to finish, because the opener is disabled during that read.

## Verification

- Backend: 20 focused tests passed for provider availability, payment security and API boundaries. OpenAPI validation passed for 251 paths; coverage matched 299 operations and four infrastructure routes. Backend type checking and lint passed.
- Frontend: 38 unit tests passed across checkout boundaries, evidence, order-payment regression and shared mutation review, including late success/failure after unmount. Final production build/standalone packaging, separate type checking, full lint with subsequent changed-file lint and scoped formatting passed.
- Browser: 110 distinct scenarios have passing evidence across payment detail (32), manual reporting (13), account flows, quotation review and vehicle payments. The broad run passed 108 of 109; its remaining cart test was stale against the completed checkout-review flow and replay label. The final payment/manual/account run passed 52 of 53 before that assertion was corrected; the corrected cart case and one added provider-disable race both passed in the focused final run. The 56 quotation/vehicle scenarios passed in the broader run before the final payment-only layout refinement. This is cumulative evidence, not a claim that one command passed 110 cases.
- Payment coverage includes provider visibility, fresh payable/provider checks, CSRF and original-key handoff/recovery, wrong-provider/expired destinations, delayed session cancellation, verification identity, wrong-target manual receipts, role exclusion, read errors, session draft clearing, four states at all ten widths, dialog focus restoration and short screens. Payment-page Axe scans passed at 390, 768 and 1440; review-dialog scans passed at 390 and 1280 with a 480px viewport height. The existing manual tests also exercise long amounts.
- All four configured-evidence browser cases passed using an explicitly intercepted `storage.invalid` test host: private attachment only after review, expiry before submission, session cancellation and original-key recovery after ticket expiry. The preview was then restarted without this test configuration, and the unconfigured-storage/manual-report fallback passed separately. No deployment environment file was modified.
- Real API/database: `payment-oct-real.cjs` used synthetic records in isolated `allied_vehicles_qa` on local PostgreSQL port 55439. Payment `0c5dee15-8de7-4ca6-91fb-fc0b2a72f2fc` belongs to order `d897a536-1aca-46a9-b5ea-238e2d7503f4`. The owned response returned `checkoutProviders: []` and `no-store`. A browser manual report persisted one `MANUAL/PENDING` attempt and `REQUIRES_REVIEW`, with `succeededAt: null`. Same-key replay returned the original result; cross-customer reads returned 404, anonymous reads 401 and missing-CSRF submission 403. Reload preserved the review state; no page errors occurred.

QA scripts, logs and captures are under `C:/Users/PC/.codex/`, outside the application. The real API/database workflow passed again on the final build without test storage configuration; see `payment-oct-real-final.log` for that run's synthetic IDs. Real provider charges, deployed callback/webhook delivery and deployed private object storage remain separate release checks. Controlled browser responses establish client behavior only.

## Acceptance and remaining scope

- Passed responsive checks at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536 pixels, plus short 390/1280 by 480 dialogs. Final captures cover all ten widths; processing and confirmed states also have mobile/desktop captures. No page overflow was reported.
- Final tablet inspection restored two form columns at 600–800px, where the full-width workspace has room. The affected 768px state/dialog/accessibility case passed again after the final production build (`payment-oct-tablet-final.log`), and all ten viewport captures were regenerated without test storage configuration. Phone fields remain single-column.
- Inspected final mobile/desktop page and review captures against all three concepts; inspected the corrected confirmed desktop and processing mobile layouts. The fidelity ledger below records the changes and intentional deviations.
- Accepted BG-07 locally and retained REL-01/REL-03 for deployed storage/provider acceptance. No live transaction, receipt email, deployment or complete role-dashboard redesign is claimed.
- Invoice/receipt design, secure downloads and sharing are the next separate gate. Saved/favourite pages and the remaining application pages also remain open.

## Fidelity ledger

| Observation                                                               | Concept and browser evidence                                                               | Correction and verification                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The old single column gave amount and status little emphasis.             | Desktop concept 01 versus four baseline widths.                                            | Navy summary, readable status labels and separate checkout/form workspace; desktop and mobile captures inspected.                                                                             |
| Generated provider endorsements and bank/receipt claims were unsupported. | Concepts 01–03 include provider marketing, generated contact details and receipt promises. | Use actual brand assets, supported links, server provider names and explicit server-confirmation copy. No invented bank account, recommendation badge or automatic email claim.               |
| Manual reporting was too tall and upload decoration competed with fields. | Baseline and first desktop/mobile implementation captures.                                 | Desktop field pairs, one column on phones, compact upload area and shorter instructions; preserve 44px controls and the actual 10 MiB limit.                                                  |
| The copy control initially looked detached from the dark summary.         | First desktop capture versus concept 01.                                                   | Correct the scoped selector so the control uses the summary's dark surface with a visible border and focus ring.                                                                              |
| Closing review lost keyboard focus while payment status refreshed.        | Ten initial responsive tests reproduced the failure.                                       | Restore the review opener only when refresh completes; fall back to the page heading when the form is no longer available. All ten corrected cases passed before the final layout refinement. |
| Shared mobile button rules could stretch review actions.                  | Concept 03 requires compact, reachable actions; dialog captures at 390 and 1440.           | Scoped grid actions, bounded dialog with internally scrolling content, minimum 44px buttons; short 480px-high viewport checks passed at 390 and 1280 widths.                                  |
| Recorded states left an oversized empty right column.                     | First confirmed desktop capture versus focused state concept 03.                           | Use the former form column for the outcome, related records and attempts. Final confirmed desktop and processing mobile captures were inspected; the ten-width state regressions passed.      |

Intentional differences: the code uses the existing customer shell rather than generated staff navigation; actual references and dates come from the API; mobile fields use a single column and 16px input text; financial pages use restrained information surfaces rather than decorative automotive photography.

## Implementation and evidence files

Frontend: [payment component](../../app/components/payment-detail.tsx), [scoped styles](../../app/components/payment-detail.css), [keyed route](../../app/dashboard/payments/[paymentId]/page.tsx), [checkout guards](../../lib/api/payment-checkout.ts), [payment parser](../../lib/api/payment-schemas.ts), [manual reporting](../../app/components/manual-payment-form.tsx), [shared mutation review](../../app/components/mutation-review.tsx) and regenerated API types.

Backend: payment service/controller/OpenAPI projection plus the exported API document and endpoint handbook. No database migration or provider credential was added.

Tests: [payment browser scenarios](../../tests/e2e/payment-detail-quality.spec.ts), [manual evidence/report regressions](../../tests/e2e/manual-payments.spec.ts), [checkout unit boundaries](../../tests/unit/payment-checkout.test.ts), [mutation-review lifecycle](../../tests/unit/mutation-review.test.tsx), and provider-aware account/vehicle-payment fixtures.

Local evidence in `C:/Users/PC/.codex/`: `payment-oct-backend-tests.log`, `payment-oct-unit.log`, `payment-oct-browser-final.log`, `payment-oct-browser-accepted.log`, `payment-oct-final-checks.log`, `payment-oct-storage-fallback.log`, `payment-oct-real-final.log`, `payment-oct-build-accepted.log`, `payment-oct-types-accepted.log`, `payment-oct-lint-final.log` and `payment-oct-lint-changes.log`. Captures include `payment-oct-requires_payment-{width}.png` at all ten widths, `payment-oct-processing-{390,1440}.png`, `payment-oct-succeeded-{390,1440}.png`, and `payment-oct-review-{390,1440}.png`.
