# Workshop inspection specification

Fresh desktop/mobile concepts were inspected before UI edits. Apply them to the
actual `/admin/inspections` index with inline progress management. Preserve the
Allied shell/logo/navigation, Quicksand, existing role boundaries and every
supported transition. No separate detail route exists.

- One Overview / Vehicle inspections breadcrumb and named header, brief Lagos
  scheduling/progress text, Refresh inspection records. No invented last-updated
  timestamp or business-wide count. Existing record UUIDs replace generated human
  reference numbers. No thumbnails: the inspection API exposes no photo URL.
- Compact white status/branch filter panel with Apply filters and Clear inspection
  filters. Admin branch choices include historical inactive branches; Staff use
  only their verified active assigned scope. Persist valid supported filters,
  cursor and previous-page trail in the URL. Reject unknown/duplicate/invalid
  filters and foreign Staff branch IDs before collection reads.
- Inspection records band shows only records on this page. Each compact card has
  actual listing title, stock number, customer name, neutral status and full UUID/
  numeric version. Group preference, complete scheduled start/end and assignment
  into readable columns; retain notes, cancellation reason and saved lifecycle
  instants, including seconds/milliseconds. Expose branch UUID factually rather
  than inventing a branch label absent from the response. Retain existing stock
  guidance without fabricating a direct stock ID or branch-active public link.
- Manage inspection progress reuses the existing form, staff picker and mutation
  review. Actual lifecycle choices replace generated mobile 'No' mock options.
  Keep complete start/end interval, Admin eligible assignment, Staff self-assignment,
  cancellation reason, backend expectedVersion and read-only terminal states.
  Complete review must accurately show who is assigned and all submitted facts.
- Current own active profile/Staff assignment gates reads. Strict collection and
  branch/status validation, duplicate detection and accurate failure states keep
  denied data hidden and temporary stale data read-only. A fresh profile and
  relevant current-page record must still match before POST. If the record is no
  longer on that page, send nothing and require refresh. Backend atomic version
  checks protect the remaining race.
- Validate full success identity, next version, status, assignment, schedule and
  reason before success. Keep drafts on conflicts and support explicit field
  reload. Validated success updates local version; older reads must not replace
  it. Status-filtered records may leave the page after a valid transition.
- Persist only a minimal owner/role-scoped pending marker before a write. Uncertain
  results/reload stay locked without automatic replay. Explicit fresh current-page
  reconciliation replaces this page's drafts and releases the lock without
  claiming proof of the original outcome. Temporary read failure cannot clear a
  lock. Session invalidation redacts metadata while retaining recovery locking.
- Condition reports remain immutable read-only linked evidence. Retain date,
  summary, zero/null odometer/score and typed findings. Completed requests without
  reports keep the existing stock guidance. No payment/reservation guarantee.
- Actual shell and cool canvas, white 12px cards, subtle rules, restrained red
  action/focus, neutral statuses, 28px desktop/24px mobile h1, 16px h2, 14px card
  heading, 13px body/labels, >=44px ordinary controls/disclosures. Four fact columns
  on desktop, two on tablet, one at narrow widths; forms reflow without hidden
  facts. Use existing outline icons only. No hero/chart/new image assets.
- Reuse the accepted setup, database replay and privilege evidence. Verify
  supported filters/paging/history, role/branch access, all lifecycle controls,
  stale/uncertain/reload behavior and connected real API mutations. Run targeted
  responsive/Axe checks, native concept/final comparison and a copy/fidelity ledger
  of at least five points. This page remains unaccepted until those checks pass.
