# Workshop customer detail

Locally accepted 18 October 2026, milestone 75. Route
`/admin/customers/[customerId]`; directory gate 74 is separate.

## Result

One named breadcrumb/header, grouped contact/account and address facts, complete
activity records and independent refresh controls replace the generic summary and
horizontal table. Seven existing collections retain their domain authorization:
Garage, Bookings, Quotations, Orders, Payments, Enquiries and Complaints. Collection
and per-collection UUID cursor/trail persist through reload/Back; switching collection
restarts paging. Page-local counts do not claim totals.

Strict requested-profile identity, active administrator gate, complete/bounded unique
rows, exact decimal strings/dates and cursor validation fail closed. Summary refresh
failure retains labelled facts and blocks activity; summary denial clears both.
Activity errors/denial remain independent of a readable profile. Null/zero amounts,
independent verification, full UUIDs, address nulls and Lagos milliseconds remain
factual. BigInt formatting fixes Number precision loss; non-NGN/unknown currency
is shown explicitly in minor units. Only real booking/order/support detail routes
are linked. No profile/status mutation, portrait, branch or spending total is added.
See [existing API boundary](../../../backend/docs/workshop-customer-detail.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-customer-detail-oct-concepts/desktop.png) and
[mobile](work-customer-detail-oct-concepts/mobile.png) concepts were viewed before UI
edits. [Audit](work-customer-detail-oct-concepts/audit.md),
[specification](work-customer-detail-oct-concepts/spec.md) and exact
[prompts](work-customer-detail-oct-concepts/prompts.md) are saved. No generated image
is used in the application. Browser plugin tools were unavailable; production
Next.js, Playwright/Edge, Axe and `view_image` were used.

Native concept/final dimensions are 1486×1058 desktop and 742×2119 mobile-reference;
actual 320/375/430px checks separately verify narrow layouts. Viewport captures
judge shell placement; full-page images show activity continuation.

| Area        | Final disposition                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition | Named breadcrumb/header, paired account/address panels and one activity section follow the references with the existing Allied shell.                                                             |
| Typography  | Quicksand, 30px wide/24px narrower title, 16px fact-panel headings and 13px body preserve the dashboard hierarchy.                                                                                |
| Surfaces    | Cool canvas, white 12px panels, subtle rules and restrained red controls/selected activity match accepted pages.                                                                                  |
| Facts       | Full profile UUID, independent email/phone verification and exact Lagos timestamps replace generated samples. Unsupported account classification/postcode/coordinates/address-line2 are excluded. |
| Activity    | Actual returned titles/statuses/references/dates/amounts replace invented records. Complete mobile labelled rows replace the generated table; no fake total pages appear.                         |
| Actions     | >=44px controls, real supported detail links and independent summary/activity refresh extend the reference. No unsupported quotation/payment/garage detail route is invented.                     |
| Copy        | Contact and account, Address, Customer activity, Refresh customer and Back to customers are retained. The page-local count says records on this page; null amounts say Not applicable.            |

## Verification

- 20 browser cases passed together: 19 new detail cases and the directory named-detail/
  Back regression. All collections, role/profile gates, malformed/wrong-ID/denied
  summaries, invalid queries,25+3 reload/Back, independent failures, exact maximum/
  zero/non-NGN values and long responsive records passed.
- Five focused units passed for exact requested identity, supported activity/cursor
  state, trail paging, exact/null/foreign-currency amounts, complete rows and links.
- The 22 existing directory API cases passed at gate 74 and are reused unchanged for
  summary/related permissions, private projections, independent cursor scope and
  minimal privacy audits. No backend source/schema/contract changed for this gate.
- Frontend type check, focused ESLint/formatting and production build passed. Fourteen exact source/dependency hashes and one formatter-equivalent TSX file
  verify the final production snapshot. The last copy-only count correction was
  rebuilt and all ten captures/Axe checks rerun; unchanged functional cases were reused.
- 17 Axe scans cover seven widths 320/375/430/768/1024/1440/1920 and ten native/state
  captures. No page overflow/captured errors. States include Super Admin, empty,
  activity error, summary error, own-profile error, invalid and long text.
- Connected production Edge/Express/PostgreSQL verified 25+3 independent garage paging,
  reload/Back, all seven collections, collection persistence, summary refresh,
  unchanged vehicle snapshots, zero domain mutation requests and 17 minimal privacy
  READ audits matching successful requests. Staff made no private reads; Customer/
  anonymous boundaries passed. Real monetary values are covered by unit/mocked
  browser/API projection checks; connected fixtures cover garage plus empty related
  collections. These evidence scopes remain distinct.

## Safety and remaining scope

Actual 127.0.0.1:55480 / allied_work_aftercare_20261017_test, isolated-test environment
and existing restricted runtime credentials were verified before fixture writes.
Existing synthetic customer fixtures were reused and 28 synthetic garage vehicles
added. Domain fixtures remain; owned sessions were removed. No application/shared
database, schema, migration, grant, backup/restore, push or deployment change ran.
Unchanged 59-migration replay/db:check/privilege evidence was reused.

No new backend implementation gap was identified. Existing policy/finance/handover/
receipt/release items remain independent. Next separate gate: staff support
`/admin/support`; its conversations are separate. Deployed/application-wide acceptance
remains open and the overall goal stays active.

Evidence: C:/Users/PC/.codex/work-customer-detail- browser/real/build logs, real/
captures/source-hashes JSON and final PNGs. Temporary harnesses remain outside repo.
