### 9 November: first hosted order-sourcing acceptance and recovery-selector correction

Frontend run 42693804531 / source 5a9798bd passed production checks, repeated
WebKit calendar/search and all exact-media checks. The early sourcing run passed
five cases: save/review/cancel/reload at 320 and 1440 with strict console, scoped
axe and overflow assertions; synthetic Staff, Admin-ready and older-backend hiding.
The sixth, stale-record recovery, correctly showed an uncertain outcome, disabled
retry and performed no POST, then timed out because the test looked for Go back
instead of the shared dialog's Close & review record label. The seventh contradictory
receipt case did not run. Correct only that final selector; retain write counts,
disabled-retry assertions, freshness checks and all existing execution limits.
The full matrix was skipped, so this is not a passing whole-runtime result.

Safe synthetic mobile/desktop sourcing screenshots and the failed modal were
downloaded and visually inspected. Artifact 13707669692, 1,445,779 bytes; SHA256
554e5ab27d9e8d0bbd6f3e264b8b8c619f673afab871da10eb0edf028ab15f9f matches.
Local receipt: TEMP/aat-d03-service-payments-20261109/sourcing-hosted-42693804531.
The summaries wrap without clipping; the failed-state screenshot confirms the
actual close label and disabled save. Revised-source browser acceptance remains
required. Backend-only source 8f9cc3a7 has its own active safety run 42695676717;
its pickup core is not yet a durable handover workflow. No production change.

Sourcing authoring additionally requires the actual response to advertise its
`timingUpdates` field. Omission by an older backend stays distinct from an empty
supported history, so the frontend cannot expose an unsupported mutation during
an independently managed release. Added explicit legacy/Admin-ready/Staff browser
cases and a bounded focused sourcing run before the full hosted matrix. Existing
assertions and execution limits remain unchanged.

# Per-order sourcing and preparation: D13

Source implements section 7.7 of the 2 November self-contained brief. The explicit
owner instruction is per-product timing and supplier/import progress with
order-specific updates. Existing product defaults remain available in the catalogue; no universal one-day
promise, stock, operational approval, price or deadline is fabricated.

## Current journey

An authorised Admin/Super Admin opens an actual open order, records each actual
line once, selects supplier/import progress and optionally records a paired arrival
range and preparation minutes. Dates are entered/displayed in Africa/Lagos time.
Blank preparation is unknown; zero means no additional preparation. Estimates are
separate from actual order.readyAt and the future holding policy. An internal
reason is required alongside a separate customer note. The review lists the order,
every estimate and both notes. A fresh read precedes the CSRF-protected write;
server version/current-session/MFA and branch checks remain authoritative.

Server history is append-only with a unique replay key and request hash. Equal
replays do not append twice; changed replay, stale versions, wrong/missing/duplicate
items and ready/closed orders refuse the mutation. The Order row serializes updates
and increments its version. The audit references the event without copying private
reason into the customer projection. Customer and guest details show only safe
latest sourcing fields. Existing amounts, issued records, payment and reservations
are not rewritten. An unavailable line stops a new payment attempt/preparation and
fulfilment, including historical-order paths; verified captures remain recorded.
Resolving an estimate does not replace required compatibility/stock/payment proof.

Current verified Admin/Super Admin authoring is an engineering choice reusing the
existing purchase-review authority. It is not a claim that the owner literally
specified those role names or that Newworld Orlu's real account has been mapped.
No new grant or supplier attestation is created. These are operator-recorded facts,
not an external supplier API verification.

## Verification and limits

- Native isolated acceptance: 80/80 tests, six suites; 107 forward migrations replayed,
  empty schema diff, db:check and restricted runtime-role checks passed. All own
  tmpfs containers were removed. Evidence is TEMP/aat-d03-service-payments-20261109/
  native-order-timing-final.log. No shared/application/production database was used.
- Initial run: 64 executed tests passed, two new files failed to load because they
  omitted explicit Vitest imports. Fixed the fixture imports; retained that failure
  in native-order-timing.log. Reviewed run and final payment-hold run each passed
  80/80. These overlapping runs are not 160 unique cases.
- After the final lint-only control-character predicate rewrite, follow-up order
  validation/learning tests passed 17/17. Backend types/scoped lint passed.
- Frontend focused units passed 32/32 (order timing, payment eligibility and existing
  staff order detail); scoped lint passed. Full latest types, contracts and hosted
  browser receipt must be recorded separately; discovery is not rendered acceptance.
- Added browser cases cover review/cancel/save/reload at 320/1440, JSONB key order,
  unknown values, unchanged status, private-reason omission, accessibility/overflow,
  Staff hiding and stale/contradictory outcome recovery without duplicate writes.
  Safe screenshots are requested by these hosted fixtures, not invented locally.
- Browser plugin not available. Use existing hosted Playwright because the local
  Next/browser path's 10 GiB growth allowance does not fit above the 20 GiB reserve.

## Remaining scope and release

D12 five business days is approved; business-day calendar, holiday/ready-day counting
and imported/custom holding remain owner values. No Collect by date is invented.
D14 private, revocable, one-time order-specific parts pickup and partial handover
are still implementation work. D03 vehicle collection is a separate workflow.
The unavailable-item stop is part of bounded delegated D17 handling; it does not
finish alternatives/refund-review journeys or approve general returns/warranty.

Migration 107 is additive and contains no mass update/backfill. It must pass exact
merged-source CI and the existing production migration/backup/restore/privilege
release gates before deployment. No actual operator/guest/physical/provider acceptance,
real customer update delivery, production change or purchasing activation is claimed.
Invoice identity, provider acceptance and other recorded financial prerequisites
remain separate from booking readiness. Preserve the current Home/support/security/
image/product-form repairs when integrating. Full D01-D17 goal remains active.
