# Administrator product-category detail — gate 59

Locally accepted 17 October 2026 at `/admin/categories/[categoryId]`, including
`?view=edit`. This is milestone 59; deployment and application-wide acceptance remain
open. Next: order fulfilment `/admin/orders`, with order detail a separate gate.

## Delivered behavior

Category names in the catalogue now link to a dedicated read page. It uses the
existing private administrator direct read, independently of list paging, with a
named breadcrumb, visibility/URL-name summary, complete category facts and Lagos
timestamps, description and a real category-filtered products link. Inactive records
are supported; absent descriptions read “Not provided.” Guidance states the product
deactivation rule accurately and makes no inventory-count claims.

The existing four-field reviewed editor is reused. Its new optional parent-blocked
input also disables editing when the detail read is stale or unavailable. Reload,
browser history, cancellation, focus restoration, observed-timestamp updates and
explicit lost-response reconciliation remain supported. Invalid UUIDs are rejected
by the route; unsupported/repeated views expose recovery without an editor. Denied,
missing and mismatched records cannot expose editable fields. No backend or schema
change was needed; ADM-10/ADM-11 supply the required contract.

## Design and fidelity

Fresh [desktop](work-product-category-detail-oct-concepts/desktop.png) and
[mobile](work-product-category-detail-oct-concepts/mobile.png) concepts were generated
and inspected before implementation. The [extracted spec](work-product-category-detail-oct-concepts/spec.md)
records copy, tokens, intentional differences and reused editor design. Browser/IAB
tools were unavailable, so Playwright with installed Edge produced actual screenshots.
Both concept files and current desktop/mobile/editor screenshots were inspected with
`view_image`; native browser widths include 320, 390 and 1467px.

| Comparison               | Final disposition                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and breadcrumb     | Real logo/navigation/account/search preserved; one named breadcrumb. Generated branding and invented mobile search copy were rejected in the spec. |
| Heading and typography   | Established Quicksand scale, compact title and exact subtitle; no oversized generated text.                                                        |
| Ink summary              | Two desktop columns; stacked mobile labels and separator; complete real visibility/slug values.                                                    |
| Facts and description    | White bordered section, responsive label/value rows, complete description and truthful absence text.                                               |
| Grouping guidance        | Exact three paragraphs and working filtered-products link; approximately 1.8:1 desktop split, stacked mobile.                                      |
| Controls and editor      | Existing outlined refresh, pencil/arrow icons, 44px actions and accepted editor/review/recovery; no duplicate guidance panel.                      |
| Long content and density | Long names/slugs/descriptions wrap; all controls remain reachable at 320px and in landscape.                                                       |

Above-the-fold copy matches the extracted spec; record values differ only with actual
data. The real shell and neutral refresh style intentionally resolve differences
between generated concepts. The implementation was faithfully verified against the
extracted design; no material visual mismatches remain.

## Verification evidence

- **43 production-browser cases passed in one run:** 21 new detail cases plus 22
  category catalogue/editor regressions. Coverage includes named direct/reloaded
  records beyond page one, list links, history, review/cancel, stale rejection,
  committed/uncommitted save recovery, failure/retry, private-data removal, roles,
  invalid routes/views and long content. The first implementation passed this run.
- **31 unit cases passed** across category and product contract parsers. TypeScript,
  scoped lint, full frontend lint, formatting and production build passed. Eight
  source/dependency hashes match the tested isolated snapshot.
- **36 captures and 36 associated Axe scans passed:** list-independent detail/editor
  at 320, 360, 375, 390, 430, 768, 900, 901, 1024, 1280, 1440, 1467 and 1920px;
  ten additional states cover inactive/missing description, temporary error, denied,
  malformed, missing, mismatch, unsupported view, review, stale draft and 844×390
  landscape. No capture page errors or horizontal overflow. The dedicated long-data
  browser cases additionally scan detail and editor at four widths.
- **Real browser/Express/PostgreSQL acceptance passed:** 25+2 paging and prefix search,
  direct inactive detail/reload/edit, cancellation without a write, persisted edits
  and exact audit counts, stale/CSRF rejection, active-product preservation when
  deactivation is rejected, committed edit/create response loss and explicit reload
  recovery without duplicate writes, private no-store and role boundaries. Zero
  browser page errors.

## Database safety and limits

The former isolated cluster was confirmed stopped. Windows rejected binding its old
port; an available loopback port was checked and the same test cluster was started
at `127.0.0.1:55480`. A preliminary connection while startup was still in progress
failed before database creation; creation proceeded only after startup succeeded.
Cluster identity and database absence were verified before creating the fresh isolated
`allied_product_category_detail_20261017_test`. All 58 migrations replayed, schema
checks and the database-safety checker passed. A new restricted runtime role was
verified without superuser, role/database creation, replication, bypass-RLS, schema
CREATE, table ownership or TRUNCATE privileges. Migration credentials were separate.
Synthetic records remain preserved; only this run's synthetic sessions were removed.

No application/shared/staging/production data, existing grants, schema/migration,
backup/restore rehearsal, off-device recovery verification or deployment changed.
Creation receipts remain optional ADM-12; the detail page adds no new backend gap.
API-before-frontend rollout and target-environment verification remain required.

Private evidence under `C:/Users/PC/.codex/` uses `work-product-category-detail-`:
`build-path.txt`, `build.log`, `e2e.log`, `real.log`, `lint.log`, `captures.json`,
`states.json`, `source-hashes.json`, `migrations.log`, `dbcheck.log` and PNGs. Generated
concepts are in this repository; private QA captures are not application assets.
