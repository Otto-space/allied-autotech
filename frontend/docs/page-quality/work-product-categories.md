# Administrator product categories — gate 58

Locally accepted 13 October 2026 for `/admin/categories`, including its create and
direct-link edit workspaces. Admin and Super Admin only. This is the fifty-eighth
milestone; deployment and application-wide acceptance remain open. Product-category
detail is the next separate gate.

## Scope and behavior

The former generic list omitted descriptions and search and always displayed the
creation form. The dedicated catalogue has literal name-prefix and visibility
filters, reloadable UUID paging with bounded browser history, complete descriptions,
honest page counts and working links to products in each category. Mobile records
retain every field. The shell keeps one breadcrumb and its real navigation.

`?view=create` opens a blank four-field form. `?edit=<UUID>` loads the category
directly, independently of the list, including inactive records beyond page one.
Forms validate name, URL name, optional description and Active; a full review precedes
each CSRF-protected mutation. Edit requests carry the observed `updatedAt` timestamp.
Concurrent edits preserve the local draft and require explicit replacement/review.
Rejected proposals cannot be retried from the same dialog. Temporary read failures
retain but disable the draft; denied/missing/mismatched responses remove the form.

Uncertain outcomes stay locked through reload using owner-scoped pending markers.
Editing can explicitly discard the draft and read the saved record without replay.
Creation requires manual catalogue reconciliation before starting a new blank draft;
the API has no original-request receipt. The guidance states the actual rule: active
products must be deactivated before their category can be deactivated. No product is
deleted by changing category metadata or visibility.

## Concepts and visual comparison

Fresh [desktop](work-product-categories-oct-concepts/desktop.png),
[mobile](work-product-categories-oct-concepts/mobile.png) and
[editor](work-product-categories-oct-concepts/editor.png) concepts were generated,
inspected and [specified](work-product-categories-oct-concepts/spec.md) before UI code.
They are design evidence, not rasterized application controls.

| Point                  | Concept requirement                                      | Rendered result and disposition                                                                        |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Shell and hierarchy    | Compact heading, breadcrumb, refresh/add controls        | Real shell/logo/navigation retained; one breadcrumb; established 27px Quicksand heading.               |
| Filters                | White strip with name prefix, visibility and two actions | Same ordering; filters stack without clipping at narrow widths. Search copy states prefix behavior.    |
| Catalogue              | Ink band and four complete columns                       | Same hierarchy and density; actual API page count; full descriptions and explicit missing-value text.  |
| Palette and typography | Ink, red, white and cool grey                            | Existing Quicksand, neutral visibility badges and red links replace generated green badges/blue links. |
| Mobile                 | Open heading and individually grouped records            | Matches the mobile concept; URL name, description and visibility labels remain visible at 320px.       |
| Editor                 | Two-to-one form/guidance split                           | Four real fields, reviewed save and ink guidance; stacks on smaller screens with complete controls.    |
| Navigation and spacing | Real catalogue/product links and compact paging          | 44px controls, wrapping row actions, contained pagination footer; actual route/filter links.           |
| Review and recovery    | Existing accessible mutation/feedback patterns           | Full facts, focus restoration, explicit stale/lost-response recovery and truthful disabled states.     |

Generated editor navigation and exaggerated heading details were not adopted; the
real shell and extracted scale govern those elements. No invented metrics, photos,
inventory totals or unsupported actions were added. Actual desktop, 320px/mobile,
editor and stale/review renders were inspected locally against the concepts.

## Verification

- **22 dedicated production-browser cases passed**, including filters/history,
  validation/review/focus, CSRF-bearing creation, independent direct editing, stale
  snapshots, business conflict, committed/uncommitted/contradictory outcomes,
  creation recovery, private-data removal, invalid links and role boundaries.
- **27 product catalogue and 23 shared dashboard navigation regression cases passed**
  on the same final build, for **72 distinct passing browser scenarios** overall.
- **31 unit cases passed** across product categories and the related product
  catalogue parser. The category suite contributes 13 cases.
- Thirteen responsive widths: 320, 360, 375, 390, 430, 768, 900, 901, 1024, 1280,
  1440, 1467 and 1920px, covering both list and editor (26 captures).
  Thirteen additional state captures include empty, failed, denied, malformed,
  missing, mismatched, invalid link, create, validation, review, stale, long content
  and 844×390 landscape. No horizontal overflow or state-capture page errors.
  Dedicated browser checks run 12 Axe scans and state captures run 13 more; all pass.
- TypeScript, full frontend lint, formatting and the packaged production build passed.
  Final source hashes establish the relationship between repository code and the
  tested snapshot; all six checked source hashes match.
- Real browser/Express/PostgreSQL acceptance verified 25+2 paging, prefix search
  beyond page one, direct inactive/reloaded editing, cancellation with no write,
  persisted edits and audit counts, stale/CSRF rejection, active-product preservation
  on rejected category deactivation, committed edit/create response loss and reload
  recovery without replay, private no-store and Admin/Super Admin/Staff/Customer/
  anonymous boundaries. No browser page errors occurred.

The first browser run passed 20/22; two failures exposed the missing
`retryAfterRejection: false` proposal setting. It was added, the production snapshot
rebuilt, and all 49 category/product cases passed. The real-API helper initially used
a nonexistent `CATEGORY` audit enum; it was corrected to the actual `PRODUCT` audit
entity convention and rerun successfully using a new synthetic prefix. Existing test
records were preserved. A concurrent, unrelated MFA edit briefly failed a workspace
TypeScript run; a subsequent full workspace check passed without changes here.

## Backend and data safety

[Backend contract and evidence](../../../backend/docs/admin-product-categories.md)
records the private direct read, literal prefix query, optional atomic observed-update
precondition and shared category lock for product updates. All 34 focused/related
backend cases passed, including a deterministic deactivation/activation race.
OpenAPI validation covered 267 paths and route coverage 320 operations.

Two fresh isolated PostgreSQL 18 databases at `127.0.0.1:55440` replayed all 58
migrations and passed the database-safety checker: `allied_product_categories_20261013_test`
and `allied_product_categories_ui_20261013_test`. Cluster identity and database absence
were checked before creation; runtime roles were verified without ownership, DDL,
TRUNCATE or administrative privileges. No schema/migration, application/shared data,
existing grant, deployment, backup/restore rehearsal or off-device recovery change
occurred. API rollout must precede the dependent frontend.

## Evidence and remaining work

Private evidence under `C:/Users/PC/.codex/` uses the `work-product-categories-` prefix:
`final-build.log`, `final-e2e.log`, `navigation.log`, `real.log`, `captures.json`,
`states.json`, `source-hashes.json`, `api-tests.log`, `migrations.log`, `dbcheck.log`,
`ui-migrations.log`, `ui-dbcheck.log`, `frontend-lint.log` and the PNG captures.
Production fixture responses are not used by the application; synthetic browser
fixtures complement the separate real API/database acceptance.

The backend handoff records ADM-10/ADM-11 as locally integrated contracts and ADM-12
as optional durable product-category creation recovery. The overall goal remains
active; next is the separately addressable administrator product-category detail page.
