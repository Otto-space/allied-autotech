# Vehicle stock

Locally accepted 17 October 2026, milestone 68. Route `/admin/vehicles`.

## Implemented experience

The index now has a named breadcrumb/header, grouped applied filters, a stock
record band and complete three-column records. Each vehicle has a named detail
link, protected thumbnail/fallback, stock number, recorded trim/specification,
branch name/code and all stored sale listings with exact prices and neutral status.
Historical/inactive branches, unlisted records, zero mileage and multiple listings
remain explicit. No acquisition costs, global totals or availability promises are
introduced. The existing creation and detail routes remain separate page gates.

Filters and cursor history live in the URL and survive reload/back navigation.
Editing fields does not fetch until Apply; applying or clearing resets paging.
Admin/Super Admin have historical branch selection; Staff have their assigned
active scope. The existing branch picker now resolves an off-page selected branch
through the authoritative direct endpoint, including after reload.

Current own profile/identity/active role gates stock reads. Staff require a branch;
the backend independently enforces active assignment, branch scope and MFA. Response
validation rejects inconsistent identities/branch facts, duplicate records,
invalid prices/cursors/images and unexpected Staff acquisition fields. Temporary
refresh failures retain labelled prior records with paging blocked; denied reads
remove them. Revalidated branch changes replace the previous branch workspace.

The backend adds literal wildcard escaping, `listed=true/false` record filtering
and explicit private no-store staff-router responses. See the
[backend contract and remaining query gap](../../../backend/docs/vehicle-stock-discovery.md).
No schema/migration, grant, write workflow or permission expansion was added.

## Concepts and visual comparison

Fresh built-in Image Gen [desktop](work-vehicle-stock-oct-concepts/desktop.png) and
[mobile](work-vehicle-stock-oct-concepts/mobile.png) concepts and the inspected
[specification](work-vehicle-stock-oct-concepts/spec.md) preceded UI edits. The
Browser plugin was unavailable; QA used the production Next.js build in
Playwright/Edge, Axe and direct `view_image` comparison of both concepts and final
native/practical renders in the same pass.

Native dimensions are **1435x1096 desktop** and **1003x1568 mobile**. Both viewport
and full-page views were captured. The generated mobile reference is wide enough
for the existing desktop shell, so that shell is preserved at 1003px; practical
430px and 320px views verify the real mobile shell and complete stacked records.
The fixture uses an existing showroom editorial asset solely to exercise protected
thumbnail loading. It is illustrative QA imagery, not vehicle-specific production
photography; production thumbnails come from each permitted record's image URL.

| Comparison        | Final disposition                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure         | Named heading/actions, grouped filters, thumbnail identity, branch and sale-listing facts follow the reference. The actual full Allied navigation/search/account shell replaces invented abbreviated navigation and logos.                                     |
| Typography        | Computed Quicksand throughout; heading 28px desktop and 24px practical mobile, body/labels/inputs 13px, vehicle identity 14px.                                                                                                                                 |
| Surfaces          | Cool #f4f6f8 canvas, white rounded panels, existing pale semantic row-header identity surface, subtle rules and red primary action. Neutral listing labels replace generated availability colours.                                                             |
| Controls/focus    | Inputs and ordinary buttons measure 44px; narrow wrapped header buttons grow to 61px. Keyboard focus has a clear darker red outline/halo. The border remains its normal colour; the acceptance check measures the actual focus outline.                        |
| Responsive facts  | Mobile retains every stock number, branch code, listing title/status/price and inactive/unlisted fact. It stacks branch/listings rather than duplicating large status/price summaries. Long unbroken names and maximum exact money wrap without page overflow. |
| Images/icons      | Modest protected thumbnails, existing readable fallback and CarFront glyph; existing outline shell/Filter/Refresh/Plus/paging icons. No new raster asset enters the application.                                                                               |
| Counts/navigation | Actual page record count, Previous/Next and known cursor history replace generated global totals and “Page 1 of 1”. Direct cursor entries say Later page and offer First page.                                                                                 |

Copy differences are explicit: “Listing status” becomes **Listing status filter**,
“Branch” becomes **Branch filter**, and “Model year” becomes **Model year filter**.
Make/model/year dropdown mockups become supported exact text/year inputs. The
existing money formatter renders the naira symbol instead of mock “NGN” labels.
Actual fixture branch names/codes and 45,000/120,000 km replace generated repeated
mileage/branch details. Guidance is placed in its own compact strip. **Stock
records**, **Listed records**, **Unlisted records**, accurate inactive labels and
safe error/retry copy clarify supported behavior. No mock listing links, counts,
extra metrics or production photos are fabricated.

## Acceptance evidence

- **31 distinct browser scenarios have passing evidence:** 27 initial passes,
  the three corrected focused repeats, and the existing stock-filter regression
  after its fixture correction. Admin/Super Admin/Staff facts, Customer denial,
  profile loading/error/inactive/unassigned cases, inactive branches, literal and
  combined filters, URL history/reload, historic/off-page branch names, invalid
  links, error/empty/denial/malformed/duplicate/mismatched/private-field states,
  branch reassignment, stale facts, failed images, listing history, direct cursors
  and named detail/back navigation are covered.
- **Six frontend contract tests** and **three real API/database integration cases**
  pass. API cases cover tied-date 25+3 paging, supported combined filters, exact
  large prices, literal percent/underscore/backslash and VIN matching, historical
  listings, listed/unlisted records, role/MFA/active branch checks, acquisition
  omission, malformed/duplicate queries, private headers and unchanged domain rows.
- Seven responsive widths **320/375/430/768/1024/1440/1920px**, three long-content
  views and seven final state/native captures pass **17 Axe scans** and page-width
  checks. Final captures include expanded keyboard filters, error, history and
  external-cursor states; final helper records zero page errors. Seven capture
  states each have viewport and full-page images, alongside responsive evidence.
- Real production Edge -> Express -> isolated PostgreSQL verifies Admin **25+3**
  and assigned Staff **25+2** paging, reload/back history, literal search/exact
  make/model, ten unlisted records, authoritative historic branch labels,
  acquisition omission and cross-branch/Customer/anonymous denial. No stock/listing
  changes or domain audits result from these index reads; before/after complete
  fixture records match. Synthetic domain fixtures are preserved; only owned test
  sessions are removed.
- Frontend/backend TypeScript and focused lint pass; final standalone build passes.
  OpenAPI validates **270 paths**, **323 operations** match mounted routes, client
  types are regenerated and API coverage is updated. **17 SHA-256 source hashes**
  match the tested production snapshot. No application UI source changed after
  that build; subsequent corrections affected test selectors/fixtures only.

Earlier failures are retained honestly: synthetic published/reserved/archived
listings initially lacked mandatory timestamps; a substring-search assertion
incorrectly selected the first of several valid matches. Browser assertions used
ambiguous “0 km”, “Archived” and unscoped Next selectors and assumed a red focus
border. The existing empty-page fixture incorrectly emitted a next cursor. These
were corrected and affected checks passed. The capture runner also needed the
frontend asset working directory; an attempted import.meta-based fixture path was
incompatible with the CommonJS Playwright loader and was reverted. No runtime
behavior was weakened to satisfy these checks.

## Database and release boundaries

Before fixture writes, actual host **127.0.0.1**, port **55480**, database
**allied_work_aftercare_20261017_test** and isolated-test environment were verified.
The existing restricted runtime account was reused. The unchanged 59-migration
empty replay, db:check and privilege evidence from milestone 67 were reused;
there was no reason to repeat migrations or alter grants for this read-only page.
No shared/application database write, backup/restore operation, deployment or push
occurred. The two database fixture corrections preserved the database and earlier
synthetic rows. Shared release and restore-readiness checks remain separate.

Deploy the additive stock filtering/private-header API before its dependent UI and
verify that environment. **ADM-23** records accepted-but-ignored inherited stock
query parameters; this UI offers only the working filters and rejects unsupported
URL keys. Next: separate `/admin/vehicles/new` creation gate, then vehicle detail.
The overall goal remains active.

Evidence files are outside the repository under `C:/Users/PC/.codex/`:
`work-vehicle-stock-e2e.log`, `work-vehicle-stock-focused-e2e.log`,
`work-vehicle-stock-legacy-e2e.log`, `work-vehicle-stock-unit.log`,
`work-vehicle-stock-api-tests.log`, `work-vehicle-stock-real.log`,
`work-vehicle-stock-captures.json`, `work-vehicle-stock-source-hashes.json` and
the matching build/static/contract logs and captures.
