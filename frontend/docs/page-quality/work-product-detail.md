# Administrator product detail — local acceptance

Route `/admin/products/[productId]`, Admin and Super Admin. Gate 57 accepted locally
on 13 October 2026. The accepted frontend count is 57. Application-wide and deployed
acceptance remain open.

## Page and contracts

The direct URL previously returned the public 404. A dedicated page now reads the
existing private administrator product endpoint independently of catalogue paging.
Product names in the catalogue link to it. The page supplies a named breadcrumb,
ink pricing/visibility/category/featured summary, product identifiers and description,
Lagos timestamps, actual images, availability by branch and complete compatibility
records. Missing values and images are explicit. Prices remain exact integer-kobo
strings through formatting; no stock quantities are inferred from availability flags.

The [desktop and mobile concepts](work-product-detail-oct-concepts/spec.md) preceded
implementation. The existing shell, Quicksand typography, role checks, API client,
safe media component, product editor, mutation review and media workspace are reused.
No new dependency, endpoint, Prisma schema change or migration was needed.

`?view=edit` and `?view=media` are reloadable workspaces. Unsupported or repeated view
parameters cannot open an editor. Non-UUID paths produce 404 before product fetching.
Editing retains explicit review, cancellation, observed-timestamp protection, draft
restoration and owner-scoped uncertain-save recovery. Temporary read errors retain
the draft while blocking changes; denied, missing or mismatched records remove private
content. Media management retains image versions, private upload preview and explicit
read recovery after interruption. No automatic replay or original-request receipt is
invented. Branch inventory remains in its existing management route.

Compatibility freshness is checked before submission, but the backend has no atomic
observed revision for compatibility updates/removals. Another write can occur between
that read and the mutation. This pre-existing limitation is now documented as
[ADM-09](../../../BACKEND_IMPLEMENTATION_GAPS.md#adm-09---atomic-compatibility-conflict-protection-p2);
it must not be confused with product timestamp or image-version protection.

## Verification

Browser/IAB was unavailable; the installed Playwright suite used Microsoft Edge.

- **87 distinct browser scenarios passed:** 25 dedicated detail cases, 27 catalogue,
  12 product/media and 23 shared navigation cases. The packaged build passed all
  52 detail/catalogue cases after catalogue-link styling was placed in its owning
  stylesheet. After removing duplicate media headings/records, the final build passed
  37 detail/media cases; catalogue and navigation sources were unchanged by that fix.
- **40 unit cases passed** across product catalogue parsing/forms, product extras and
  money/media handling. Full frontend lint, TypeScript, scoped formatting and the
  production build/postbuild passed.
- **34 final-build screenshots** cover 13 portrait/desktop widths
  (320, 360, 375, 390, 430, 768, 900, 901, 1024, 1280, 1440, 1467, 1920),
  844×390 landscape, two editor/review pairs and eight states at 390/1467px.
  Thirty screenshot-associated Axe scans passed with no page overflow or observed
  browser exceptions. Dedicated browser cases also passed 15 Axe scans for detail,
  editing and maximum-length review dialogs.
- Maximum name, SKU, slug, brand, part number, description, category and compatibility
  notes remained usable at 320/375/430/1440px and short landscape. Review dialogs fit
  the viewport and restored focus. Explicit inspection confirmed opening the editor
  focuses its heading. Staff made no product read; Super Admin could access the page.
- Six changed production source files match the final tested snapshot by SHA-256.

The real browser/API/PostgreSQL check used the actual Express routes, session cookies,
CSRF and a newly created isolated database. It verified catalogue 25+2 pagination,
search beyond page one, direct detail and reload, reviewed edits, one audit per
successful catalogue write, unchanged state after cancellation, exact large-money
creation, stale-update 409 and missing-CSRF 403. A committed edit with a deliberately
lost response recovered after reload without a second write.

Actual PNG bytes passed upload, confirmation, processing and authorized preview. The
detail gallery displayed the uploaded image and the saved compatibility record;
image description changes and removal persisted. A committed compatibility update
with a lost response recovered through an explicit saved-record reload without
duplicating the child. Admin/Super Admin reads returned 200, Staff/Customer 403 and
anonymous 401; the direct response remained `private, no-store`. Media storage used
the existing test-only in-memory adapter; production storage/CORS is not certified.

## Database safety and scope

Before fixture writes, the actual target was verified as PostgreSQL 18 at
`127.0.0.1:55440`, database `allied_product_detail_20261013_test`, local test environment.
Cluster identity and database absence were checked before creation. All 58 existing
migrations replayed into the empty isolated database, and `db:check` passed schema and
history verification. Runtime credentials were separate from migration credentials;
no table ownership, schema CREATE, TRUNCATE, superuser, role creation, replication or
bypass-RLS privileges were present. Existing roles and grants were unchanged.

Only synthetic isolated fixtures were written; the helper removed its own temporary
sessions. Application/shared/staging/production data was not changed. No backup or
restore rehearsal, off-device recovery verification, commit or deployment occurred.
Node emitted existing experimental Web Crypto and PostgreSQL query-queue deprecation
warnings; the successful run had no browser page errors.

## Visual comparison

Both saved concepts and the latest final-build desktop/mobile screenshots were opened
with `view_image` in the final comparison pass. Editor and mobile review screenshots
were also inspected. The following ledger records the accepted differences explicitly.

| Point                  | Concept evidence                                                   | Final render and disposition                                                                                             |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Navigation and copy    | Named three-level breadcrumb; product title and two header actions | Same copy/order, one breadcrumb, real sidebar and existing mobile search/account controls retained.                      |
| Summary                | Ink band, four labelled facts; two columns on mobile               | Same palette, hierarchy and wrap behavior; neutral status text replaces generated green.                                 |
| Information and images | Approximately 1.1:1 desktop split, white bordered surfaces         | Same split and section order; exact Lagos date/time replaces abbreviated concept dates.                                  |
| Typography             | Restrained rounded interface type, compact controls                | Quicksand throughout; existing heading/body/button scale preserved across widths.                                        |
| Media                  | Honest pale fallback with Package outline                          | Existing 42px icon and safe image component retained; real uploads use contained image framing, no invented product art. |
| Branches and fitment   | Full-width sections and compact tables                             | All branch and compatibility fields retained; small screens use labelled records, including open-ended year ranges.      |
| Mobile density         | Two-column summary, stacked sections, wrapping actions             | Labels stack to fit actual long data and 44px controls; no clipped controls or horizontal page overflow.                 |
| Editing and recovery   | Reuse of accepted catalogue editor/review/media design             | Complete forms and review remain usable; failure/recovery states match the established feedback system.                  |

No unrecorded first-viewport copy or decorative sections were added. The initial mobile
concept was rejected for its white summary and invented branding; a fresh ink-summary
concept was used. The generated concepts' imprecise shell details did not replace the
real logo or established navigation. The final local visual gate is accepted.

The last media-view inspection found a duplicated compatibility heading and a repeated
compatibility summary below the workspace. Both were removed, the media heading count
is now asserted, and the affected browser checks and screenshots were repeated.

## Evidence and next gate

Private local evidence is under `C:/Users/PC/.codex/`: `work-product-detail-before.png`,
`work-product-detail-final-build-path.txt`, `work-product-detail-final-build.log`,
`work-product-detail-release-browser.log`, `work-product-detail-accepted-browser.log`,
`work-product-detail-regression.log`,
`work-product-detail-captures.json`, `work-product-detail-state-captures.json`,
`work-product-detail-source-hashes.json`, `work-product-detail-real.log`,
`work-product-detail-migrations.log`, `work-product-detail-dbcheck.log` and
the `work-product-detail-*.png` captures. Concept PNGs and their spec are retained in
this repository; local QA artifacts are not application assets.

Next: administrator product categories `/admin/categories`, followed by its separate
detail gate if the route/workflow requires one. The whole-application goal remains active.
