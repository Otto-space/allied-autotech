# Promotion creation

Locally accepted 17 October 2026, milestone 66. Route `/admin/promotions/new`.

## Result and boundaries

Creation now uses a named breadcrumb, compact heading, four numbered field groups
and a contextual guidance rail. The existing form validator, exact kobo conversion,
conditional discount clearing, millisecond Lagos timestamps and full review facts
are retained. New frontend offers default to disabled. Creation remains restricted
to Admin/Super Admin, with a fresh active-profile/identity check before submission
and independent backend role/MFA/CSRF enforcement.

A pending original request is stored before POST. Lost, malformed, contradictory,
408/429 and other uncertain responses retain its reference across reload. Reload
never POSTs automatically. Explicit receipt checking is read-only; an absent receipt
does not unlock a fresh creation. Reviewed retries retain the original key and exact
payload. A later rejected retry cannot erase uncertainty about an earlier attempt.
Confirmed recovery stores a minimal record link and removes the old form draft, so
Create another promotion starts cleanly. Session invalidation redacts pending input.
Corrupt, expired and unavailable recovery state stays locked for record review.

The additive backend reuses IdempotencyRecord, with actor-scoped hashes, transaction
serialization, a 24-hour key window and atomic creation/receipt/CREATE audit. A
matching replay returns the current record without overwriting later edits or
creating another audit. Nullable redemption codes are supported. The existing API
default and unkeyed legacy clients remain unchanged. See
[the recovery contract](../../../backend/docs/promotion-creation-recovery.md).

The shared form gained an opt-in grouped layout. The detail editor's existing layout
remains for its separate page gate. A focused regression exposed a stale draft being
restored after explicit Reload promotion editor; that action now removes only its
own account/path/form draft before loading the current version. Drafts remain
preserved until that explicit action.

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-promotion-create-oct-concepts/desktop.png)
and [mobile](work-promotion-create-oct-concepts/mobile.png) concepts preceded UI
edits. The [specification](work-promotion-create-oct-concepts/spec.md) records copy,
tokens, component ownership, necessary workflow states and intentional corrections
to generated content. There are no raster assets in the runtime interface.

The Browser plugin was unavailable. Verification used production Next.js,
Playwright/Edge and Axe, followed by direct `view_image` inspection of both saved
concepts and final desktop/mobile/native renders in the same QA pass. Native concept
viewports 1435x1096 and 786x2001 were captured, alongside practical 430px mobile and
the required width matrix. Viewport and full-page screenshots were both inspected;
the long review was scrolled to its precise dates/configuration and visible actions.

| Comparison              | Evidence and disposition                                                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition             | Desktop retains the four-part white form and narrow guidance rail; mobile moves guidance below. Existing authenticated shell/search/navigation and actual Allied mark replace the abbreviated generated shell.                                                             |
| Typography              | Final computed desktop heading 28px, group headings 16px, guidance headings 14px, Quicksand controls 13px. Shared dashboard overrides initially enlarged headings; scoped rules now enforce the specification.                                                             |
| Controls and spacing    | Inputs measure 44px. Visible borders, red focus treatment, restrained corners and shadows match the form language. Inherited field-grid gaps were removed and the creation textarea made more compact.                                                                     |
| Palette and assets      | White form, ink navigation/text and brand-red action are retained. The shared cool-grey workspace is deliberately preserved at computed #f4f6f8 instead of introducing a page-specific canvas. No gradients, stock photos or generated bitmap UI are shipped.              |
| Copy and order          | Breadcrumb, title, subtitle, back link, four group meanings, review action and three guidance meanings match the extracted inventory. Existing contract labels and required eligibility/zero-value/blank-limit guidance replace shortened or incomplete generated wording. |
| Mobile and long content | Fields and dates stack with readable labels; full-width review action remains available at 320px. Long names/descriptions wrap within the scrollable review; exact starts/ends/configuration and both actions stay reachable.                                              |
| Icons                   | Existing shell icons remain. ArrowLeft/ChevronRight navigate; ClipboardList/Tag/Layers clarify the three guidance rows with consistent outline weight. Decorative generated circles/barcode artwork are omitted as specified.                                              |

Above-the-fold copy was compared with the extracted allowed list. No unexplained
added copy remains. Blank optional fields, existing shell chrome, factual guidance,
single-column dates, the shorter guidance surface and the preserved shared canvas
are intentional differences. More complete labels/guidance and the real shell make
the form longer than the generated overview. These retain readable 44px controls
rather than compressing the full form into one viewport. Desktop and mobile were
faithfully verified against the specification with these recorded differences;
no material visual mismatches remain in the checked states.

## Verification

- **23 distinct browser scenarios have passing evidence:** 16 new creation cases and
  seven focused existing creation/edit regressions. The initial 15-case suite passed;
  the next focused run passed 11/12 and exposed the stale-draft reload defect. After
  its repair, the affected versioned-edit/stale-reload cases and responsive/Axe case
  passed together. Repeats are not counted as additional scenarios.
- Coverage includes both administrator roles, disabled default, exact money/dates,
  review/cancel/focus, duplicate clicks, fixed/code-less offers, validation and type
  switching, lost-response reload recovery, absent/mismatched receipts, identical
  original retries, rejected-retry preservation, initial definite rejection,
  malformed/contradictory/408/429 results, live role changes, invalidation/redaction,
  expired/corrupt/unavailable storage and explicit stale-editor reload.
- **Four recovery unit cases and four backend integration cases passed.** Backend
  coverage includes concurrent code-less creation, canonical-equivalent dates,
  changed-input conflict, current-record replay after editing, minimal actor-bound
  receipts, expiry/future/malformed references, MFA/CSRF/role changes, failed-write
  receipt rollback and unkeyed compatibility.
- Final responsive checks covered **320, 375, 430, 768, 1024, 1440 and 1920px**, with
  no horizontal document overflow. Seven page Axe scans and one dialog scan passed;
  four native/practical capture scans plus the long-review scan also passed. These
  are 13 final scans across the two focused QA passes. Capture inventory contains
  18 page/review/native/real-success images; earlier captures are superseded where
  files were overwritten. Blank native/practical pages had no console warnings,
  console errors or page errors.
- **Real browser/Express/PostgreSQL acceptance passed:** three POST attempts created
  two promotions and two CREATE audits. One committed response was lost, then the
  promotion was edited before same-key replay; its later name, enabled setting and
  version remained intact. Another lost response was recovered through a read-only
  receipt check after reload, with no resend. Exact fixed kobo, 12.34%, zero minimum,
  maximum supported cap, millisecond Lagos dates, null codes, disabled creation and
  zero usage additions were checked. Synthetic domain fixtures were preserved;
  only the helper's own authentication sessions were removed.
- Frontend/backend type checks, focused lint/format checks, the final production
  build, generated API types, coverage inventory, OpenAPI validation and mounted
  route coverage passed. The contract now has **270 paths / 323 operations**. Twelve
  relevant source hashes match the final production snapshot exactly.

Private local evidence is under `C:/Users/PC/.codex/work-promotion-create-*`, including
`e2e.log`, `final-e2e.log`, `repair-e2e.log`, `unit.log`, `api-tests.log`,
`accepted-build.log`, `final-real.log`, `captures.json` and `source-hashes.json`.
QA helpers/logs stay outside the repository. The first unit expectation was corrected
to respect the existing offset-preserving Lagos request representation; the backend
correctly normalizes the equivalent instant to UTC. No production behavior was
changed to satisfy that assertion.

## Database and release boundary

All fixture writes used the previously created isolated
`allied_work_aftercare_20261017_test`, verified at `127.0.0.1:55480` before writes,
with its restricted runtime role. The owned local cluster needed ordinary PostgreSQL
startup recovery after an interrupted prior process; readiness was confirmed before
tests continued. It was not reset or recreated. Current `db:check` passed all 58
applied migrations, checksums and schema compatibility without changes. Existing
empty-database replay and restricted-role evidence was reused because no schema,
migration or grants changed.

No application/shared/production database write, backup/restore rehearsal, staging,
commit, push or deployment occurred. Ordinary PostgreSQL startup recovery is not a
backup restore rehearsal. Release the additive receipt API before this frontend;
target-environment recovery, private headers and role checks remain required.
Promotion detail is the next separate audit. Financial-policy, deployed and
application-wide acceptance remain open.
