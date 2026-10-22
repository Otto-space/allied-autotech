# Workshop sales index specification

Fresh desktop/mobile Image Gen concepts were inspected before UI edits. Translate
their compact filter/list hierarchy into `/admin/vehicle-sales`; the transaction
detail route is a separate gate. Preserve actual shell/logo/navigation, Quicksand
and supported roles. No new write/creation controls belong on this index.

- Named Overview / Vehicle sales breadcrumb, one title and brief enquiry/progress
  description. Refresh vehicle sales. Reuse the accepted inspection filter/paging
  visual treatment rather than introducing another incompatible dashboard shell.
- Purchase status and Branch filters, Apply filters and Clear purchase filters.
  Admin/Super Admin include historical inactive branches; Staff use verified own
  active assignment. Persist supported status/branch/cursor/trail in the URL;
  reject unknown/duplicate/invalid/foreign keys before reads. No unsupported search,
  date ranges, total pages or business-wide totals.
- Sales records band shows records on this page. Named transaction/vehicle records
  show full transaction number linking to the existing detail, title, year/make/
  model, stock number, customer, full branch reference and numeric version. Correct
  generated location names and Version 1.0.0 to actual data; no made-up request IDs.
- Group actual purchase status, exact recorded asking/agreed/required-reservation
  amounts, created/paid/reservation dates and handover status. Null amounts retain
  Not agreed/Not recorded. Preserve seconds/milliseconds in Lagos time. No current
  paid/refunded total, payment balance or eligibility guarantee is supplied by this
  collection, so do not infer one from purchase status or paidAt.
- Use full read-only records in a compact multi-column desktop layout; reflow into
  labelled rows/cards below tablet widths. Complete values/references remain
  available. Named transaction link is sufficient; avoid redundant identical
  Manage purchase links from the generated concepts. Existing actual optional
  protected thumbnail data may be used with the existing PublicMedia/fallback;
  never invent a photograph or a branch-active public listing guarantee.
- Current own active profile gates reads; Staff assignment gates scope. Validate
  unique IDs, supported status/branch, numeric versions, exact amounts and ISO
  dates. Initial/loading/empty/filtered-empty/invalid links/temporary/denied data
  remain distinct. Stale data is factual and paging disabled until fresh success;
  denial clears private records. Named detail navigation remains functional.
- White 12px surfaces, cool canvas, fine rules, restrained red accents/focus and
  neutral status badges. Actual dashboard heading hierarchy with 13px body/labels,
  > =44px ordinary controls, wrapped long labels/values, no clipped price/reference.
  > Keep real application breakpoints rather than a fictitious phone frame.
- Reuse existing query labels/cursor/profile/branch/formatting pieces, production
  build cache and isolated database evidence. Run focused unit/API/browser checks,
  real read-only pagination and permissions, seven widths/Axe, native concept/
  final comparison and at least five copy/fidelity points. Do not count this gate
  accepted until verification is complete.
