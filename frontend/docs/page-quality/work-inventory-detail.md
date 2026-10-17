# Inventory detail

Locally accepted 17 October 2026 — milestone 64.
Route `/admin/inventory/[inventoryId]`.

## Implemented workflow

The existing component now has a named part breadcrumb/title, actual SKU/branch,
four-part stock summary, subordinate catalogue price/update facts, a movement form
beside the reservation/reorder rail, then complete reservation and history sections.
Mobile stacks forms and transforms history into labelled facts. Existing fields,
references, Lagos expiry, validation, reviewed mutations and backend business rules
are retained. Inactive parts/branches cannot offer new reservations; expired active
holds retain release but do not offer reserved sale. Release still lets the server
determine expired status. Physical stock operations remain distinct from payments.

Current identity/role/status and assigned active Staff branch are checked. Private
facts disappear on denied or mismatched access. Every write checks a fresh inventory
record/profile; changed review snapshots block submission. Response validation checks
scope, balances, movement deltas, reservation facts and exact versioned threshold
results before reporting success. No optimistic stock update is used.

Existing in-memory idempotent retries preserve their exact original body/key.
Account/inventory session markers store only a pending flag before a write and keep
other changes locked through reload. Storage failure blocks submission. Explicit
saved-record reconciliation reads current stock, reservations and recent history;
it never sends a mutation or claims that those reads prove a particular request's
outcome. Original same-request replay is available only while its reviewed payload
remains in memory. Threshold writes remain versioned and are not automatically
replayed. A fresh known rejection clears its marker; a rejected or interrupted original-request
retry retains the original pending flag. Timeout/throttling responses remain pending
until receipt or saved-record review. The same conservative response handling applies
to inventory creation. Cancel preserves drafts, restores focus and sends no write. History and
reservation filters survive parent refreshes; stale reservation reads block their
actions, while denied reads remove cached records.

## Design and fidelity

Fresh [desktop](work-inventory-detail-oct-concepts/desktop.png) and
[mobile](work-inventory-detail-oct-concepts/mobile.png) concepts were generated and
inspected before UI changes. The
[extracted specification](work-inventory-detail-oct-concepts/spec.md) records tokens,
copy and intentional corrections to generated material. Browser plugin was absent;
Playwright/Edge and Axe provided browser verification. Concepts and final native
desktop/mobile/dialog screenshots were inspected directly with `view_image`.

| Comparison           | Result and corrections                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell/copy           | Real Allied brand and authorised navigation; named part/branch replace generated fake navigation and arbitrary labels. No tax-inclusive price claim or invented customer search.           |
| Summary/palette      | Actual four stock values on the generated white summary, pale canvas and blue factual guidance; subdued secondary facts and red primary writes.                                            |
| Typography/controls  | Established Quicksand scale; final computed heading 28px, input 13px and input height 44px. Existing enum labels and neutral secondary controls remain consistent with the work dashboard. |
| Desktop forms        | Equal columns, movement action aligned with the right rail. Screenshot review exposed inherited field-margin overrides; scoped spacing now separates labels/controls and primary actions.  |
| Reservations/history | Complete ruled reservation facts/actions and four meaningful history columns, without nested fact cards, fake row numbers or global totals.                                                |
| Mobile/dialog        | Two-by-two stock meanings, complete stacked fields and labelled history records replace cramped generated mobile tables. Review/cancel/confirm controls are fully visible.                 |

The native desktop viewport was 1024×1536. Complete real help text and 44px controls
make the full document taller than the generated mockup; no required fields were
removed to force its height. Above-the-fold copy follows the extracted specification;
access/error/pending guidance is required workflow copy. Real branding, compact type,
neutral controls, complete existing guidance and intentional mobile stacking are the
documented differences. The final implementation was faithfully verified against
that specification; no material visual mismatches remain in the checked renders.

## Evidence

- **27 distinct browser scenarios have passing evidence:** 22 new detail cases,
  one creation recovery edge case and four existing inventory regressions. The combined run passed 22; its two remaining
  cases passed in a focused repeat after disambiguating the summary/dialog threshold
  locator and movement/history select labels. These were test locator corrections.
  Three further focused cases passed for interrupted original-request retries and
  throttled stock/creation responses. The complete suite was not repeated after
  these refinements.
- Coverage includes Staff/Admin/Super Admin controls, Customer denial, named facts,
  error/denial/malformed/mismatched reads, zero-write cancel/draft/focus, stale review,
  revoked access before POST, all four operation types' unknown-outcome reload locks,
  failed/successful read recovery without replay, contradictory results, unavailable
  storage, expired holds, inactive historical parts and long responsive content.
  Existing movement/replay, reservation/release/reserved-sale, creation/threshold and
  low-stock/history/known-rejection flows passed.
- **Four unit cases passed:** receipt/balance/scope validation, replay after later
  stock changes, exact versioned threshold result and duplicate/inconsistent history
  or malformed reservations. One new backend boundary case passed; the
  [backend report](../../../backend/docs/staff-inventory-detail.md) distinguishes it
  from reused gate-63 regression evidence.
- **19 responsive/state captures and seven dedicated Axe scans passed:** 320, 375,
  390, 430, 768, 900, 1024, 1440, 1467 and 1920px; native desktop; Staff, empty,
  error, denied, expired, review, pending and landscape. **Six final layout captures
  and Axe scans** passed at 320, 390, 1024 and 1440px, native desktop and mobile
  review. Long-content browser checks cover six widths with Axe. No checked page
  overflow, browser errors or Axe violations. Full-page captures start at scroll
  position zero; the modal uses a viewport capture.
- **Real browser/Express/PostgreSQL passed:** stock receipt, reservation, release,
  threshold update, zero-write cancel, same-key receipt replay after committed
  response loss, second response loss/reload/read recovery, six mutation attempts,
  five audited changes and four stock transactions. Final on-hand 12, reserved zero,
  threshold eight; no customer order created. Customer read denial, private headers
  and zero browser errors were verified.
- Scoped lint/format, frontend TypeScript including new tests, production build and
  final CSS rebuild passed. Backend lint/typecheck passed. Nine source/dependency
  hashes match the final production snapshot. A final browser probe confirmed URL,
  title, meaningful content, no framework overlay and zero console warnings/errors
  or page errors. Request/response shapes and routes did not change; contract/type
  regeneration was not repeated.

## Database and release scope

Only the existing newly isolated local database
`allied_work_aftercare_20261017_test` on `127.0.0.1:55480` was used. Helpers confirmed
their actual target before writes. The previous 58-migration empty replay, db:check
and restricted runtime-role evidence were reused because the schema is unchanged.
Fixtures remain preserved, with only helper-owned synthetic sessions removed.

No shared/application/staging/production data or grants changed. No schema migration,
backup operation, restore rehearsal, off-device recovery verification or deployment
occurred. Deployed role/branch/private-cache and recovery acceptance remain open;
ADM-15 remains a separate finance follow-up. Private evidence is under
`C:/Users/PC/.codex/work-inventory-detail-*`, excluding credentials from repository
reports. Next separate gate: promotions `/admin/promotions`. The full goal remains
active.
