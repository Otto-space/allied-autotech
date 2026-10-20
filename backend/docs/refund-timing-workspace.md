# Bank refund timing workspace

Route: `/admin/refund-timing`. [Local milestone 101 accepted](../../frontend/docs/page-quality/work-refund-timing.md) on 19 October 2026.

## Contract

`GET /admin/policies/refund-timing/current` is an additive Super Admin/MFA read. Query parameters are rejected. Successful responses use `Cache-Control: private, no-store` and contain:

- `evaluatedAt`: server time of the consistent selection.
- `current`: highest approved `bank_refund_clock` version whose effective date is at or before that time, or null.
- `nextScheduled`: earliest future approved version greater than the current version; equal effective times choose the highest version, or null.
- `latest`: highest recorded version, irrespective of approval/effective time, or null.
- `history`: latest 100 versions, descending by version, independently of current selection.

This matches `snapshotRefundClock` rather than the effective-date-first ordering used by reservation agreements. A lower version scheduled after an already-effective higher version never supersedes it. Unapproved records remain available in history but are never selected as the refund clock. Unsupported selected settings are explicitly unavailable in the UI; do not silently fall back to an older calendar.

The service checks the current actor/session under the organisation access lock. A repeatable-read transaction with the existing retry wrapper selects all facts and appends one minimal READ audit identifying `REFUND_TIMING_CURRENT` and the returned history count. A failed audit cannot yield a successful read.

## Publication and existing refund behavior

Existing `POST /admin/policies` with kind `BANK_REFUND_CLOCK` retains its strict settings, expected-version conflict, effective time, source/evidence, immutable Q6 provenance and atomic CREATE audit. It now rechecks current actor/session under the same access lock used by other accepted policy editors. No broader permission is granted.

The fixed rule remains ten banking days, excluding the start date, due at the same Lagos time. The owner chooses REQUESTED, APPROVED or TRANSFER_RECORDED, banking weekdays and excluded ISO holiday dates. Africa/Lagos, duration and counting convention are not editable. The engine selects the policy effective at the refund's request time, waits for the chosen event, operates only on manual payment refunds and leaves an already saved deadline/snapshot unchanged. Publication never transfers money, confirms receipt or changes refund status.

The calculator's former 1,000-day search cap could reject a valid sparse calendar. Its search is now bounded by `7 * (10 + uniqueExcludedDates)`: at least one selected weekday occurs each week, and each excluded date can defer at most one counted day. A direct regression covers 150 excluded Mondays followed by ten counted Mondays and proves duplicate exclusions leave the deadline unchanged. The snapshot selection/update guard remains unchanged; existing saved deadlines are not backfilled or recalculated.

The frontend verifies active own-profile identity before loading, refreshes identity and policy before submitting, validates exact actor/Q6/settings metadata in the result, and retires saved drafts only after a confirmed receipt. It preserves the existing draft key and never restores calendar approval consent. Failed/uncertain responses retain a minimal actor-bound recovery marker through reload; explicit current reads and independent reconciliation do not replay the original request or prove its original outcome.

## Remaining capability and rollout

ADM-63's optional durable original-request publication receipts also apply here. Current facts alone cannot identify whether an earlier request committed. Add atomic actor/body/request-bound durable receipts and an authorised read-only lookup if that stronger recovery guarantee is selected; persistence changes must follow the repository forward-migration safeguards.

Deploy the compatible additive API/OpenAPI client and calculator correction with the dependent frontend. Verify real environment access revocation, MFA/CSRF, private caching, version conflicts and response-loss behavior before release. No schema, migration or privilege change is needed. Business calendar approval is distinct from payment readiness and release approval.

## Verification evidence

- Four new isolated API scenarios pass: direct current selection outside the cap, version-first ordering and skipped lower future revisions, access/MFA/query/CSRF/typed boundaries, concurrent one-version publication/audit and distinct calendar publication preserving prior policies.
- Four owner-calendar unit cases pass, including existing exact ten-day bank deadline arithmetic and the sparse-calendar regression.
- Restricted test target verified before writes: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Original snapshots unchanged: 65 users, 57 staff profiles, 544 policy versions, 581 prior audit records, three bookings and 40 branches. Financial/order/vehicle transaction tables are empty; this is not new populated-refund preservation evidence. All temporary sessions removed.
- External evidence: `work-refund-timing-api-tests.log`, `work-refund-timing-api-fixtures.json`, `work-refund-timing-api-preservation.json` under `C:/Users/PC/.codex/`. A harness output filename typo was corrected by copying the successful preservation evidence; mutations were not repeated.
- All 25 browser cases, seven frontend units, final seven-width accessibility checks, native visual comparison and 12 production source hashes pass. Connected Edge/API/PostgreSQL verifies two future approvals/two CREATE audits, 12 READ audits, lost-response recovery without replay, 650 previous policies/current calendar unchanged and zero temporary sessions. No shared database write, migration, backup/restore rehearsal or deployment was performed. See the acceptance document for the exact scope and empty financial-fixture limitation.
