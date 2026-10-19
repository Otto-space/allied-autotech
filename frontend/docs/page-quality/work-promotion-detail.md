# Promotion detail

Locally accepted 17 October 2026, milestone 67. Route
`/admin/promotions/[promotionId]`.

## Implemented experience

The page now has a named breadcrumb and heading, neutral configuration label,
direct-read offer facts, precise Lagos schedule, version/timestamps/reference,
grouped editor and contextual guidance. It reuses the creation form theme and
validator. Full codes, optional/null limits, zero/exact amounts, descriptions and
millisecond timestamps remain available. Enabled is configuration, not eligibility;
no redemption counts or remaining-use totals are invented.

Admin/Super Admin access gates the page. A reviewed edit checks current identity,
active role and a fresh full record snapshot before PATCH. Existing backend
expectedVersion protection remains independent. Confirmed responses update the
overview directly; a delayed earlier GET cannot replace that newer version. Stale
records preserve the draft until an explicit fresh reload. Temporary read failures
retain labelled prior facts and lock editing; denied/not-found reads remove facts.

Uncertain saves persist a minimal expected-version marker through reload. No PATCH
is retried automatically. Explicit Load current settings reads permission and saved
settings, replaces the previous draft and loads that observed version. Its message
does not claim that the original save committed or failed. Later changes still use
review, fresh checks and expectedVersion. Older recovery reads, corrupt/unavailable
storage and session changes fail closed. 408/429 and malformed/mismatched responses
retain the pending state. Definite first rejections release only their own marker.

The backend API already supported this workflow. New integration coverage exposed
one database mismatch: zero fixed discounts/caps were accepted by the API/form but
rejected by positive-only CHECK constraints. A committed forward migration widens
those two checks; checkout still rejects a zero payable discount. See the
[backend correction and rollout contract](../../../backend/docs/promotion-detail-recovery.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-promotion-detail-oct-concepts/desktop.png) and
[mobile](work-promotion-detail-oct-concepts/mobile.png) concepts were inspected before
UI edits. The [specification](work-promotion-detail-oct-concepts/spec.md) records
copy, tokens, required states, existing-shell reuse and necessary corrections to
generated content. The Browser plugin was unavailable; verification used production
Next.js, Playwright/Edge, Axe and direct `view_image` comparison of both concepts and
final native/practical renders in the same QA pass.

Native dimensions were **1374x1145 desktop** and **897x1752 mobile**. Both viewport
and full-page captures were checked, with a practical 430px mobile continuation,
320px long-content and scrolled long-review views. The generated mobile concept is
a broad overview; actual narrow fields/dates stack and the complete form continues
below the viewport.

| Comparison          | Evidence and disposition                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure           | Named header, factual overview, grouped editor and guidance rail match the specification. Full real navigation, search and Allied asset replace the generated abbreviated shell.                                             |
| Data/copy           | Actual name/code/value/date/version/reference are shown. Existing field labels and exact currency formatter replace abbreviated mock labels/data. Required eligibility and zero-value guidance remain factual.               |
| Typography          | Final computed desktop heading 28px, group headings 16px, labels/controls 13px, Quicksand throughout. Mobile heading is 24px. No browser-default control font remains in checked states.                                     |
| Palette/focus       | Shared #f4f6f8 canvas, white surfaces, ink text, neutral configuration and red primary controls. Shared form rules initially made the selected checkbox/focus blue; scoped theme rules now produce red checked/focus states. |
| Controls/density    | Inputs measure 44px and the creation-style textarea 90px. Existing field margins/grid overrides were corrected to keep grouped spacing deliberate. No nested generated editor boxes or fixed review toolbar are introduced.  |
| Mobile/long content | All facts/dates remain readable. Long-content QA exposed an unbroken named breadcrumb overflowing at 320px; the current item now wraps. Complete codes, exact large amounts and long descriptions remain in normal flow.     |
| Icons/actions       | Existing shell SVGs remain. ArrowLeft, RefreshCw and Pencil have working back/refresh/editor-focus actions; ClipboardList/Layers/Tag explain the guidance. Generated guidance tiles/number circles are omitted as specified. |

Above-the-fold copy was compared with the extracted allowed inventory. No
unexplained added copy remains. Intentional differences include the real shell,
neutral enabled label, full persisted metadata, existing field labels, readable
stacked dates, complete guidance, empty optional description inputs and red checked
states. Desktop/mobile were faithfully verified against that specification with
these recorded corrections. No material visual mismatches remain in checked states.

## Verification

- **36 distinct browser scenarios have passing evidence:** 30 new detail cases,
  two existing edit regressions and four creation regressions. The first 28-case
  detail run passed. A seven-case focused run verified shared-form/creation/edit
  effects after theme corrections. After the breadcrumb fix, the long-content,
  older-recovery and responsive cases passed together. Repeats are not counted as
  additional scenarios.
  The shared creation form's seven-width responsive/Axe scenario also passed after
  the theme correction, adding eight checks for the affected sibling page.
- Detail coverage includes direct reads beyond a catalogue page, both administrator
  roles, Staff/Customer/invalid-ID boundaries, failed/denied/missing/malformed/wrong
  records, review/cancel/focus, duplicate clicks, exact fixed values/nulls/dates,
  preflight changes, stale PATCHes, lost/503/malformed/contradictory/wrong-ID/408/429
  outcomes, reload/read recovery, definite rejection, current role changes,
  temporary/denied refresh, delayed old reads, busy/Escape, invalid storage, session
  invalidation, full long values and older-than-pending recovery.
- **Four new unit cases and three backend integration cases passed.** The API cases
  passed in focused two-plus-one runs after the constraint correction. They cover
  precise direct reads, concurrent expected-version writes with exactly one winner,
  role/MFA/CSRF boundaries, invalid configuration, zero fixed/cap persistence,
  continued checkout ineligibility, database rejection of negative values and no
  usage additions. The initial API failure identified the positive-only constraint;
  the test was retained and passed after the forward fix.
- Final responsive checks covered **320, 375, 430, 768, 1024, 1440 and 1920px**.
  Seven page Axe scans and one dialog scan passed. Nine native/state/long-content
  scans plus a scrolled long-review scan also passed: **18 final scans**, with no
  horizontal document overflow. There are **23 responsive/state/native/real-success
  captures**. Normal captures had no console warnings/errors or page errors;
  the deliberate 503 state excludes its expected network console error.
- **Real browser/Express/PostgreSQL acceptance passed:** two UI edits committed,
  a third UI PATCH lost the race and returned 409, and one deliberately injected
  external edit committed. Exactly three UPDATE audits and zero usage rows were
  checked. Cancellation sent no PATCH. A committed response loss survived reload;
  Load current settings performed only reads and did not claim a proven save.
  Exact fixed kobo, a zero cap, 12.34%, maximum supported cap, millisecond date,
  disabled setting, concurrent-draft preservation, role boundaries and private
  headers were verified. Synthetic fixtures remain; only helper-owned sessions
  were removed.
- Frontend/backend type checks, focused lint/format checks and the final production
  build passed. **15 relevant source hashes match** the production snapshot.
  Existing 270-path/323-operation API contracts were reused; no endpoint/type
  generation change was necessary. The API usage inventory was updated for the
  new component ownership and verified workflow.

Private evidence is under `C:/Users/PC/.codex/work-promotion-detail-*`, including
`e2e.log`, `final-e2e.log`, `accepted-e2e.log`, `unit.log`, `api-tests.log`,
`zero-tests.log`, `accepted-build.log`, `real.log`, `captures.json`,
`source-hashes.json` and `runtime-check.json`. Helpers and raw screenshots stay
outside the repository. The focus probe was corrected to wait for the CSS border
transition before comparing its final colour; no product behavior was changed to
satisfy that timing assertion.

## Database safety and release

The forward correction, schema note and API regression file are committed together
as **dd995b8**. The client was regenerated. The existing isolated test target
`allied_work_aftercare_20261017_test` at `127.0.0.1:55480` was verified before writes.
Only the guarded **npm run db:migrate** command applied the reviewed correction,
after fresh backup creation/receipt verification and history checks. Its final
`db:check` passed. Counts and whole-table hashes matched before/after for Promotion,
PromotionUsage, AuditLog, Order, Invoice and InventoryTransaction.

All **59 migrations** also replayed on a separately created empty
`allied_promotion_zero_20261017_test`, whose `db:check` passed. The application test
helpers still used restricted runtime credentials, separate from migration/backup
credentials. Current flags/ownership/schema-CREATE/TRUNCATE checks passed without
grant changes. Both test databases and domain fixtures were preserved.

No shared/application/production database was modified, and no push, deployment or
restore rehearsal occurred. Backup archive validation alone does not prove
recoverability. Another environment must receive the forward migration through the
documented safety workflow and pass its own checks before zero-value acceptance is
claimed. Shared/production release still requires encrypted off-device backups,
retention/PITR where supported and a separate restore rehearsal. Financial-policy,
deployed and whole-application acceptance remain open. Vehicle stock
`/admin/vehicles` is the next separate audit.
