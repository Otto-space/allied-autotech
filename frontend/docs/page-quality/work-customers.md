# Workshop customer directory

Locally accepted 18 October 2026, milestone 74. Route `/admin/customers`.
Customer detail remains a separate gate.

## Result

A named breadcrumb/header, grouped filters and complete customer records reuse the
accepted workshop theme, own-profile gate, cursor operations and date formatting.
All existing name/email/phone/profile-ID searches, status/email-verification filters
and registration sorts remain supported. Normalized filters and opaque cursor
history persist through reload, Back and named-detail navigation. Search submits
explicitly; typing creates no audited directory request. Page-local counts never
claim a customer/page total. No creation/status-edit/message action is invented.

Admin/Super Admin active identity gates reads; Staff see no directory controls or
collection data. Strict complete-row/status/date, unique-ID, response-filter and
cursor validation prevents malformed pages. Temporary refresh failure retains
labelled old facts with paging blocked; denial removes protected rows. Initial
outage, empty and filtered-empty remain distinct. Records preserve full name/profile
reference, email, phone, independent verification and precise Lagos registration
time. Long values wrap in complete mobile groups. Decorative initials are not photos.

No backend implementation or schema change is needed. The existing API escapes
literal pattern characters, binds cursors to filters and audits private reads with
minimal collection/count metadata. See [contract](../../../backend/docs/workshop-customer-directory.md).

## Concepts and fidelity

Fresh built-in Image Gen [desktop](work-customers-oct-concepts/desktop.png) and
[mobile](work-customers-oct-concepts/mobile.png) concepts were inspected before UI
edits. [Audit](work-customers-oct-concepts/audit.md),
[specification](work-customers-oct-concepts/spec.md) and exact
[prompts](work-customers-oct-concepts/prompts.md) are saved. No generated image is
embedded in the app. Browser plugin tools were unavailable; production Next.js,
Playwright/Edge, Axe and native `view_image` comparisons were used.

Native comparisons use **1486x1058 desktop** and **795x1978 mobile-reference**
canvases. Actual 320/375/430px checks independently verify narrow layouts. Final
viewport images judge shell placement; full-page captures show complete records.

| Area          | Final disposition                                                                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition   | One compact breadcrumb/header, filter panel, factual count band and grouped directory records follow the references. The actual Allied shell/navigation replaces generated approximations.    |
| Typography    | Computed Quicksand, 30px wide/24px narrower headings and 13px body/labels preserve the dashboard hierarchy.                                                                                   |
| Filters       | Visible >=44px input/select/action targets and explicit Search by match the actual API; generated combined name/email/phone search is not offered. Five controls wrap into deliberate groups. |
| Records       | Customer identity, contact, status/verification and registered time form desktop columns, tablet pairs and mobile labelled groups, with complete wrapping UUIDs/long contacts.                |
| Surfaces      | Cool canvas, white 12px panels, subtle rules and restrained red links/actions replace generated arbitrary avatar/status colors with the accepted neutral theme.                               |
| Facts/copy    | Full-name links replace generic View details. Profile reference and precise Lagos timestamps replace sample UUID/date/location claims. No guessed workshop location is shown per customer.    |
| Counts/states | On-this-page counts and cursor Previous/First/Next replace invented total-page information. Empty, outage, invalid and access states extend the concepts without fake records.                |

Copy preserves **Customers**, **Search customers**, **Search by**, **Account status**,
**Email verification**, **Sort by**, **Clear filters** and **Refresh customers**.
The hint explicitly distinguishes prefix searches from a complete customer ID.
Independent phone/email verification labels remain factual; no verification action
or current spending/activity total is implied.

## Verification

- **19 distinct browser cases** have passing evidence: 18 initial directory cases
  and a named-detail return regression. Router navigation now coordinates filter/
  cursor state with Next.js. A return-test race pressed Back after the heading
  rendered but before the detail URL committed; waiting for the destination URL
  resolves the harness race. That regression passed three focused repetitions.
  Paging, explicit filter submission and seven-width checks passed on the final
  production build; unchanged role/error cases were reused.
- **Five focused units** passed for normalization/validation, supported bounded
  queries, opaque cursor trails, complete rows/duplicates/dates and filter/cursor
  response mismatches.
- **22 existing API/database cases** passed for administrator/MFA/Staff/Customer/
  anonymous boundaries, normalization/literal wildcard matching, combined filters,
  sorting, bound cursors, private projections, independent related collections and
  privacy audits excluding contact/search contents. No new backend test duplicates
  these existing contracts.
- Frontend type check, focused ESLint/formatting and final production build passed.
  **11 exact source/dependency hashes** match the tested build.
- **19 final Axe scans:** seven widths (320/375/430/768/1024/1440/1920), three state
  scans and nine final native/state captures. Long identities/contacts fit without
  horizontal page scrolling. Captures include Super Admin, empty, error, profile
  error, invalid and long text, with no page errors.
- Connected production Edge/Express/PostgreSQL verified **25+3 paging/reload/Back**,
  combined filters/sort, exact profile lookup, named detail/Back, honest empty,
  Staff no-collection-read and Customer/anonymous denial. The final continuation
  reused the same 28 preserved customer fixtures and confirmed unchanged snapshots,
  zero domain mutation requests and seven minimal privacy READ audits. A read-only
  audit follow-up corrected the harness field from actorUserId to stored userId;
  the completed browser flow was not repeated for that correction.

## Database and remaining work

Actual **127.0.0.1:55480 / allied_work_aftercare_20261017_test**, isolated-test
environment and restricted runtime credentials were verified before fixture writes.
Domain fixtures remain; owned synthetic sessions were removed where tracked. The
existing API suite preserves its fixture sessions. No application/shared database,
schema, migration, grant, backup/restore, push or deployment change occurred.
Unchanged 59-migration replay/db:check/privilege evidence was reused.

No new backend gap was identified. Existing policy, finance, handover, receipts and
release work remains separate. Next: customer detail `/admin/customers/[customerId]`.
Deployed/application-wide acceptance remains open; the overall goal stays active.

Evidence: `C:/Users/PC/.codex/work-customers-` browser/final/back-final, API, real-
resume and read-only verification logs; real/captures/source-hashes JSON, final PNGs
and build log. Temporary harnesses remain outside the repository.
