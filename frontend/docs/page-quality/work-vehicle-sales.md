# Workshop vehicle sales index

Locally accepted 17 October 2026, milestone 72. Route `/admin/vehicle-sales`.
Transaction detail is a separate route and gate.

## Result

The index now has one named breadcrumb/header, compact status/branch filters and
complete named purchase records. Actual transaction links lead into the existing
detail. Records retain vehicle title, stock/year/make/model, customer, branch
reference, numeric version, purchase/handover status, exact asking/agreed/required-
reservation amounts and relevant creation/payment/reservation dates. Existing
protected thumbnails are used when supplied, with a readable failure fallback.
No synthetic locations, semantic versions, total pages, current payment balances
or collected/refunded sums are invented.

Supported filters and cursor history persist in the URL through reload and Back.
Admin/Super Admin can select historical inactive branches; Staff use their verified
assignment. Current own identity gates reads. Unknown/duplicate/invalid filters and
foreign Staff branch links stop before collection reads. Strict unique-record,
scope/status/version, exact money and date parsing prevents malformed data from
rendering. Temporary failures retain factual records and disable paging; denial
clears protected facts. Empty, filtered-empty, invalid links and outages remain
distinct. The index adds no mutation or creation action.

Purchase labels/query handling, cursor operations, own-profile gate, branch picker,
money/time formatting, protected media and the accepted inspection filter styling
are reused. No new backend endpoint, schema, permission or generated request
contract is needed. See the
[existing API projection and boundaries](../../../backend/docs/workshop-vehicle-sales-discovery.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-vehicle-sales-oct-concepts/desktop.png) and
[mobile](work-vehicle-sales-oct-concepts/mobile.png) concepts were inspected before
UI edits. The [audit](work-vehicle-sales-oct-concepts/audit.md),
[specification](work-vehicle-sales-oct-concepts/spec.md) and exact
[prompt set](work-vehicle-sales-oct-concepts/prompts.md) are saved in the workspace.
No generated image enters the application. Browser plugin tools were unavailable;
verification used production Next.js, Playwright/Edge, Axe and `view_image`.

Native comparison used **1800x874 desktop** and **1024x1536 mobile-reference**
PNGs, plus practical 430px, Staff, empty and long-content views. The generated
mobile composition includes a phone frame within a wide canvas; the actual native
1024px view retains the existing tablet/sidebar shell. Practical 320–430px checks
verify the actual single-column mobile flow. Fixed shell positioning is judged
from viewport captures; full-page images show continuation.

| Comparison      | Final disposition                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition     | Named breadcrumb/header, compact filter panel, factual page-count band and grouped records follow the references. Actual Allied logo/navigation/account controls replace generated approximations.                                            |
| Typography      | Computed Quicksand, 30px wide/24px narrower heading, 13px body and filter labels/controls follow the existing dashboard hierarchy.                                                                                                            |
| Surfaces        | White 12px panels, cool canvas, subtle rules and restrained red links/actions are consistent with the accepted workshop pages. Neutral badges replace arbitrary generated status colors.                                                      |
| Records         | Five desktop groups retain identity, customer/branch, status, prices and dates. They reflow into complete labelled cards; full UUIDs and long values wrap without clipping.                                                                   |
| Facts/copy      | Generated branch locations, Version 1.0.0 and Page 1 of 1 become actual branch UUIDs, numeric record versions and cursor controls. Asking/agreed/required-reservation amounts remain separate; null is not converted to zero.                 |
| Media           | Actual optional protected 80x64 thumbnails extend the reference layout without invented photos. Missing/broken media leave the named record usable.                                                                                           |
| Controls/states | Filter selects measure 46px and ordinary controls >=44px. Mobile actions stack. Empty/outage/invalid/access states extend the concepts; an unnecessary generic-container ARIA label was removed after the empty-state Axe scan identified it. |

Copy preserves **Vehicle sales**, **Refresh vehicle sales**, **Purchase status**,
**Apply filters** and **Clear purchase filters**. The branch label becomes
**Branch filter**, because inactive historical branches are supported. Values use
**Recorded asking price**, **Agreed price**, **Required reservation**, **Not agreed**
and **Not recorded**. Counts explicitly say **on this page**. One full transaction
link replaces redundant generated Manage purchase links.

## Verification

- **20 distinct browser cases** have passing evidence: 17 initial new index cases,
  one new empty/outage/access accessibility case and two existing index-to-detail
  workflows. The legacy customer-handover fixture omitted the image array required
  by its current API projection; adding the actual empty-array shape fixed its
  customer half, which passed in a focused rerun. Production customer UI was not
  changed.
- **Four focused unit cases** passed for exact money/null/date/thumbnail data,
  scope/status/duplicate validation, zero handover values and shared query/cursor
  handling. Frontend/backend type checks, focused ESLint/oxlint, formatting and
  final production build passed.
- **Three API/database scenarios** passed: stable 25+3 paging, private exact
  projections/no collection audits, combined status/branch filters, negotiated
  values, historical inactive branches, Staff assignment/isolation and Customer/
  anonymous/unverified-MFA denial. Unsupported query fields return 422.
- **20 Axe scans** across responsive/state views have passing evidence: seven
  responsive widths, three focused empty/outage/access scans and ten final
  native/state captures. The empty-container ARIA correction was rebuilt and all
  final state captures rerun. No overflow at 320/360/390/768/1024/1280/1440 or in
  narrow long-name/reference/price captures; no captured page errors occurred.
- All **16 frontend source/dependency hashes** match the final tested production
  snapshot. Unchanged query, branch, media and database setup were reused.
- Connected production Edge/Express/PostgreSQL verified **25+3 paging**, reload,
  Back, combined filters, named transaction detail and return navigation, exact
  maximum/negotiated prices and honest empty results. Transaction snapshots stayed
  unchanged, with **zero domain mutation requests and zero mutation audits**. The
  one privileged detail navigation produced its expected single READ audit.
- Staff reassignment removed old-branch facts; after reload the foreign branch
  link failed before reads. Customer/anonymous browser access was denied. The
  connected workflow produced no page errors.

## Database and remaining scope

Before fixture writes, actual **127.0.0.1:55480 /
allied_work_aftercare_20261017_test** and isolated-test environment were verified.
Existing restricted runtime credentials were reused. Synthetic records are
preserved; only owned test sessions were removed. No application/shared database,
schema, migration, grant or startup change occurred. Unchanged 59-migration
db:check/replay/privilege evidence was reused. No backup/restore, push or deployment
operation ran.

No new backend implementation gap was identified for this index. Existing
receipt, policy, finance and release items remain independent. Next: vehicle sale
detail `/admin/vehicle-sales/[transactionId]`. Application-wide and deployed
acceptance remain open; the overall goal remains active.

Local evidence under `C:/Users/PC/.codex/work-vehicle-sales-`:
`browser.log`, `legacy.log`, `legacy-fixed.log`, `state.log`, `unit.log`,
`api-tests.log`, `real.json`, `captures.json`, `source-hashes.json`, `build.log`,
static logs and final PNGs.
