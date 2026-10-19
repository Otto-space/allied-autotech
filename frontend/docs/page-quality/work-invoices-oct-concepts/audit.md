# Administrator invoices audit — gate 81

Pre-implementation audit, 18 October 2026. Route `/admin/invoices`; listing and
inline draft creation belong to this gate. `/admin/invoices/[invoiceId]` remains
the next separate gate. Existing issue/void/document behavior is not redesigned here.

## Baseline evidence

Production 430/768/1280/1440px captures were saved and viewed before UI changes as
`C:/Users/PC/.codex/work-invoices-baseline-{width}.png` and matching viewport images.
Expanded creation was also captured at 430/1440px. Synthetic browser fixtures made
no database/domain writes. No page-width overflow occurred, but mobile relies on a
clipped horizontally scrolling table: totals/due dates are initially off-screen.
Large gaps separate title, actions, status, additional filters and the plain table.
Money can wrap mid-number; statuses lack hierarchy and the source/branch context is weak.

## Existing contracts and weaknesses

- Admin/Super Admin with verified MFA only. FinanceAccess currently checks session
  role; add current active own-profile gating, safe retry and protected-data removal.
- List supports status, branch, exact customer reference and cursor/limit. Filters,
  paging and form-open state are component memory only. Add persistent supported URL
  state and compact grouped controls. Reuse AdminBranchPicker with inactive branches.
- Missing exact invoice-number and source predicates limit discovery and current
  creation reconciliation. Add compatible staff-only filters; sourceId requires a
  sourceType. Invoice number is literal exact match, not an invented fuzzy search.
- Collection reads lack explicit private no-store headers/minimal READ audits; detail
  already has privileged READ auditing. Add collection audit/caching consistently.
- Source picker uses three broad operational collections, pages filtered options in
  the browser and cannot search globally or resolve a restored off-page source name.
  Add a minimal authorized searchable source collection, retaining server paging and
  eligibility checks, and use exact source reads for selection/preflight. Avoid
  fetching customer contacts, financial documents or thousands of records to pick one.
- Existing creation is server-priced and serialized by source, with unique source
  relations and an atomic CREATE audit. Preserve that behavior, approved finance
  policy, booking deposit/refund guards and separate draft review/issue. No source
  amount is promised before the draft exists and is reviewed.
- Create review has no fresh identity/source check; any invoice-shaped response can
  navigate to detail. Validate exact source, due date, draft/version/lifecycle and
  financial arithmetic before confirming. No invoice issuing or payment is added.
- Uncertain creation locks exist only in memory and disappear after reload. Persist
  minimal owner/role/source markers. Explicit current source-invoice lookup does not
  resend or prove the original outcome. Backend one-invoice-per-source remains the
  duplicate guard; durable original-request receipts are a separate optional capability.
- Cancel currently refreshes invoices unnecessarily. Keep draft/opener focus without
  a read. On confirmed creation show/focus the saved draft with a real detail link;
  preserve deliberate detail navigation without changing the detail page design.

## Planned verification

Fresh desktop/mobile concepts and corrections precede UI edits. Verify supported
URL filters/paging/reload/Back, three sources, historical branches, exact large money,
dates, balances versus invoice values, source search/paging/restoration, creation
validation/cancel/single-flight/receipts, competing source creation, reload-persistent
uncertainty, current-read reconciliation, access revocation and roles. Include
production browser/responsive/Axe/native comparison, meaningful units, focused API
and real connected database acceptance. Reuse unchanged database-safety evidence;
verify the actual isolated target before writes. No schema/migration is planned.
