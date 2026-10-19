# Workshop vehicle detail

Locally accepted 17 October 2026, milestone 70. Route
`/admin/vehicles/[vehicleId]`.

## Result

The detail now has a named record header, full stock/branch context and section
links. Complete specifications sit beside stock identity at wider desktop sizes;
listing cards retain description, slug, exact price, status, version, featured and
lifecycle dates. Protected photos, private documents, document assessment,
temporary access and latest condition reports retain their existing workflows.
Staff acquisition cost/currency are omitted; precise acquisition time remains
visible. Zero mileage/readings/scores, false findings and nulls remain distinct.

Current own profile and Staff assignment gate reads. Strict requested identity,
branch, role projection and collection parsing prevent malformed/private data from
rendering. Temporary read failures retain previously loaded facts with writes
disabled; denial clears them. Reviewed changes check current access and the
relevant domain before sending, preserve independent listing/document versions and
keep drafts on conflict. Explicit field reload clears only the affected draft.
Confirmed newer versions cannot be replaced by older reads.

Specification review includes all submitted fields. Unchanged acquisition minutes
retain the exact saved seconds/milliseconds; edited minutes use Lagos time.
Creation continues using its existing serializer behavior.

A minimal owner/role/vehicle pending marker is verified before mutations.
Interrupted, malformed, mismatched, throttled and timed-out responses remain
locked through reload. Explicit current-read reconciliation replaces this page's
unsaved fields and releases the lock without resending or claiming proof of the
earlier request outcome. Existing photo attachment keeps its original-reference
safe retry. Authorized temporary document access remains separate from mutation
locking. Backend optimistic version checks remain necessary after preflight.

Real API testing identified incomplete document responses. Document creation and
review now include saved issued/expires/verified dates, rejection reason and
creation time for complete receipt validation. Storage keys remain private. This
additive projection correction requires no schema migration. See the
[backend contract](../../../backend/docs/vehicle-stock-detail.md).

## Concepts, fidelity and copy

Fresh built-in Image Gen [desktop](work-vehicle-detail-oct-concepts/desktop.png) and
[mobile](work-vehicle-detail-oct-concepts/mobile.png) concepts were inspected before
UI edits. The [audit](work-vehicle-detail-oct-concepts/audit.md),
[specification](work-vehicle-detail-oct-concepts/spec.md) and
[concept brief](work-vehicle-detail-oct-concepts/prompts.md) record the intended
translation. No concept image was added to the application. Browser plugin tools
were unavailable; production verification used Playwright/Edge, Axe and
`view_image` inspection.

Concepts and final viewport captures were compared together at native
**1024x1536 desktop** and **838x1877 mobile**. Practical 430px, 1440px Staff, 320px
review, long-content and separately scrolled photo/document/condition views were
also inspected. Full-page screenshots are continuations; native viewport captures
are authoritative for the fixed shell. Offscreen lazy photos were checked after
scrolling into view.

| Comparison                | Final disposition                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composition               | Named header, section links and ordered record/listing/photo/document/report panels follow the brief. The actual Allied logo, navigation and account shell replace generated approximations.                                                     |
| Responsive facts          | Broad/narrow first-row panels appear on 1440px desktop. At <=1180px they stack and facts use two columns, preserving readable identity values within the actual sidebar width. This intentionally differs from the dense native desktop concept. |
| Type and surfaces         | Computed Quicksand, 28px desktop/native-wide heading, 24px practical-mobile heading, 16px section headings and 13px body/labels. White 12px panels, cool canvas, subtle rules and restrained brand accents remain consistent.                    |
| Controls and continuation | Ordinary inputs/back controls measure 44px; disclosures and wrapping section links remain keyboard usable. The real page continues below the concept viewport rather than compressing complete facts and forms.                                  |
| Listings                  | Exact NGN values, full description/slug/version/featured and lifecycle data replace compressed generated summaries. Only actual allowed status transitions appear; Available-to-Available is removed.                                            |
| Media and evidence        | Actual protected media replaces fabricated photo filenames. Private document bytes, dates, assessment and temporary access are separate. Null/false/zero condition values remain explicit.                                                       |
| Review and recovery       | Complete narrow scrollable review, draft-preserving conflicts, precise timestamps and persistent pending/current-read states extend the concepts to real workflow failures.                                                                      |

Copy reconciliation retains the existing **Refresh stock record**, **Back to
vehicle stock**, **Edit vehicle specifications**, **Manage asking price**,
**Request vehicle document** and **Assess this document** labels. Actual headers
are **Sale listings** and **Latest condition report**. The generated mobile
“Version SE” becomes the numeric record version. Acquisition cost is absent for
Staff rather than exposed under an administrator badge. Current-read text
explicitly says the previous request outcome is not proven.

## Verification

- **32 distinct browser cases** have passing evidence: 19 new detail cases and 13
  existing stock/media/listing/form cases, with storage tests enabled. The combined
  run passed 31; the remaining legacy generic-heading assertion was corrected to
  the named record and passed in a focused rerun. No broad suite rerun was needed.
- **43 focused unit cases** passed across detail parsing/storage/receipts,
  timestamp serialization, shared mutation review, form drafts, condition reports,
  upload validation and creation recovery. Eight are new detail unit cases.
- **Three isolated API/database scenarios** passed, including independent
  versions, complete document creation projection/review receipts, exact typed
  condition values, precise timestamp/max-cost preservation, stale writes, Staff
  private-field denial and Admin historical inactive-branch behavior.
- **20 new-page Axe scans** passed: seven responsive widths plus review, nine
  state/native captures and three scrolled evidence sections. Additional existing
  workflow scans passed. Widths 320/360/390/768/1024/1280/1440 have no page overflow;
  practical/native long content, pending and profile-error views also passed.
- Production Next.js build, frontend type/lint checks, backend typecheck/oxlint,
  and formatting passed. All **22 frontend source/dependency hashes** match the
  tested production snapshot. No generated request contract changed.
- Connected production Edge/Express/PostgreSQL verified **seven UI mutation
  requests**: three specification updates, listing creation/price, document
  assessment and condition creation. The vehicle reached version 3 with three
  UPDATE audits; listing/document independently reached version 1. One report was
  created. Exact maximum cost and saved milliseconds remained unchanged.
- A committed update's lost response stayed locked after reload. Explicit reads
  restored the saved facts without another mutation or an outcome-proof claim.
  Staff cost omission, reassignment before confirmation, Customer/anonymous denial
  and zero browser page errors were verified against the real API.

## Database and remaining scope

Before fixture writes, actual **127.0.0.1:55480 /
allied_work_aftercare_20261017_test** and isolated-test environment were verified.
The existing restricted runtime credentials were reused. Synthetic records are
preserved; only owned test sessions were removed. No application/shared data,
schema, migration, grant or startup change was made. The unchanged 59-migration
db:check and earlier empty replay/privilege evidence were reused; no migration,
backup or restore operation was rerun. No push or deployment occurred.

Deploy the additive document projection with the frontend and verify that target.
ADM-25 records the completed correction; ADM-26 records optional durable receipts
for detail mutations. ADM-23/24 and broader financial-policy/release work remain
separate. Next: vehicle inspections `/admin/inspections`. The overall goal
remains active.

Local evidence: `C:/Users/PC/.codex/work-vehicle-detail-` prefixes
`browser.log`, `browser-document.log`, `focused-units.log`, `api-tests.log`,
`real.json`, `captures.json`, `sections.json`, `source-hashes.json`,
`build.log`, static-check logs and final PNGs.
