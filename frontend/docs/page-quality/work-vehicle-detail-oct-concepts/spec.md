# Vehicle detail specification

Fresh built-in Image Gen desktop/mobile concepts were inspected before UI edits.
The intended layout is a named record header, compact section links, grouped
vehicle facts/identity, complete listing cards, protected photos, private documents
and latest public condition summary. Preserve the actual Allied shell/navigation,
Quicksand, existing route/export names and all supported management workflows.

- Header: Overview / Vehicle stock / actual year make model; actual stock number,
  trim and branch; Refresh stock record; Back to vehicle stock. Section anchors
  Record details, Sale listings, Vehicle photos, Documents, Condition report.
  No generic duplicate page title or invented availability/count summary.
- Vehicle details show every recorded specification with explicit Not recorded,
  correct zero mileage/doors/seats and readable enums. Stock identity keeps full
  stock number, branch name/code/inactive state, VIN, chassis, registration and
  version/reference. Acquisition cost is Admin/Super Admin only; acquisition time
  stays available to Staff and displays saved seconds/milliseconds when present.
- Existing Edit vehicle specifications disclosure reuses VehicleRecordForm and
  serializer. Review all submitted permitted values. Preserve the exact existing
  acquisition instant if its minute field was not edited. Keep expectedVersion,
  fresh current identity/snapshot checks, draft-preserving conflict and explicit
  reload. A validated newer save must not be replaced by an older delayed read.
- Listing cards show full title/slug, neutral status, exact asking price,
  description, featured setting, relevant publication/reservation/sale/archive
  instants and version. Preserve content/price/publication controls and separate
  versions. Correct generated Available->Available mock choice to actual allowed
  transitions. Public links appear only for Available plus active branch. Preserve
  reserved/sold/archived restrictions from the API rather than inventing actions.
- Photos remain the existing protected gallery, primary/alt/order information and
  edit/replace/remove/upload controls, original hash focus and gallery constraints.
  Use actual permitted image URLs and existing fallback; no generated production
  vehicle photographs or made-up filenames. Keep asset tickets/receipt rules.
- Private documents retain exact byte strings, actual type/status/date/reason,
  assessment and authorized temporary access. No permanent/public download link.
  Latest condition summary retains zero readings/scores and typed false/null
  findings; older reports do not necessarily replace it. Preserve its creation
  form, inspection selection and existing public-information guidance.
- Scope all reads to current permitted identity and active assigned Staff branch;
  Admin/Super Admin may inspect historical inactive branches as supported by the
  backend. Validate requested record ID and full role projection. Denial clears
  facts; temporary refresh errors retain labelled facts with changes disabled.
- All reviewed mutations share a minimal actor/role/vehicle pending lock persisted
  before sending. Fresh access/full snapshot checks precede writes. Uncertain
  outcomes/408/429/reload never automatically resend. Explicit current-record
  reconciliation discards that page's unsaved form drafts and does not claim a
  proven original outcome. Definite first rejection releases only its own lock.
  Preserve safe underlying media receipt behavior while preventing casual replay.
- Tokens: cool #f4f6f8 canvas, ink #01121a, white 12px panels, muted #50616c,
  neutral status borders and restrained brand red actions/focus. Heading 28/24px,
  section headings 16px, body/labels/controls 13px, >=44px controls and disclosures,
  8px controls. Existing outline icons only. No hero, charts, bulk delete, totals,
  acquisition badge for Staff or publication/payment guarantees.
- Desktop first facts use broad main/narrow identity columns; sections below use
  full-width contained cards and modest photo grids. Below ~1000px facts stack;
  <=600px forms/actions/details reflow without hidden values or horizontal scroll.
  The generated mobile reference is a broad framed composition: practical narrow
  views must keep every fact in actual single-column flow with 44px targets.
- Validate initial/error/empty/denied/invalid-record data, roles/assignment changes,
  all existing management actions, fresh/stale version behavior, exact time/money,
  lost-response/reload/reconciliation and draft preservation. Reuse unchanged
  stock/creation/database evidence; run affected media/listing/form regressions.
  Capture seven responsive widths, native PNG sizes, long content and states;
  compare concept/final together and record copy and >=5 fidelity points.
