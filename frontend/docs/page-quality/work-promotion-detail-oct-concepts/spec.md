# Promotion detail specification

Fresh built-in Image Gen desktop/mobile concepts were inspected before UI edits.
They show a compact named record, factual overview, grouped editor and guidance.
They are design references, never raster UI assets.

- Preserve the existing authenticated shell, full authorised navigation, Allied
  asset and cool-grey #f4f6f8 workspace. Generated abbreviated navigation, invented
  badges/notifications, white mobile brand bar and broad search are illustrative.
- Allowed copy: Promotions / actual name; actual name; Enabled or Disabled;
  Promotion configuration and future checkout rules.; Back to promotions;
  Refresh promotion; Edit settings; Offer configuration; No description recorded.
  (only when description is null); Code; Discount; Minimum subtotal; Discount cap;
  Total usage limit; Per-customer limit; Starts; Ends; Record version; Created;
  Updated; Record reference. Display actual persisted values and full Lagos dates,
  including seconds/milliseconds, without fabricating usage counts.
- Below: Edit promotion; the existing four creation-form groups, field labels and
  Review promotion action. Existing form validation, optional nulls, millisecond
  dates and exact money conversion stay intact. Existing promotions do not show
  the creation-only sentence about a disabled initial default.
- Guidance: Before you save; Future checkout; Changes apply to future checkout
  eligibility. Existing order discounts stay unchanged.; Usage visibility;
  Configured limits are shown here. Redemption counts and remaining uses are not
  available.; Customer redemption; A code is required for customer redemption.
  Enabled does not guarantee eligibility. Code-less offers are not automatically
  applied. These are factual limits, not decorative status widgets.
- Reuse gate 66's form theme and grouped PromotionForm. Desktop overview uses three
  columns of facts, two full-date columns and a compact record footer. Narrow
  screens stack full dates/fields; retain all facts and full name/code/reference.
  The actual editor has all four groups; do not reproduce generated nested boxes,
  missing fields, percentage suffix artwork or fabricated default description.
- Palette: white overview/editor/short guidance, ink text/sidebar, neutral enabled
  configuration label, red primary action/numerals. Generated green enabled pills,
  numbered guidance tiles and yellow warning box are intentionally replaced by the
  established neutral configuration and open guidance rows.
- Typography: Quicksand throughout; 24-28px main heading, 20px section headings,
  16px group headings, 14px guidance headings, 13px control/label text. Preserve
  44px inputs/buttons, visible borders, red focus rings, 8px control corners,
  12px panel corners and subtle shadows. No gradients, photography or fake charts.
- Icons: existing shell SVGs; ChevronRight/ArrowLeft breadcrumb/back, RefreshCw for
  refresh, Pencil for editing, ClipboardList/Tag/Layers for guidance. Outline
  1.75-2px weight at 16-20px. No decorative circle containers.
- Core workflow: direct read of the requested UUID, strict identity/configuration
  validation; summary plus explicit reviewed edit; fresh role and record snapshot
  checks before PATCH; existing expectedVersion boundary; precise response check.
  No delete, bulk, redemptions dashboard or unsupported action is introduced.
- Pending markers contain only expected version, scoped by owner/role/record. An
  uncertain PATCH stays locked through reload. Explicit Load current settings reads
  permission and record without PATCH, discards the prior form draft and loads the
  observed version. It does not prove that the original operation committed or
  failed. Optimistic concurrency still governs any later reviewed save. Unknown,
  denied, corrupt, storage-unavailable and stale/lower-version states fail closed.
- Reuse useResource, MutationReview, PromotionForm, formatters, feedback and session
  identity. Preserve mounted drafts on temporary refresh failures; show labelled
  prior facts and block editing. Denied/not-found reads remove private facts.
- Required states: loading, retryable error, not found, denied, invalid/mismatched
  data, temporary/denied refresh, changed version, review/cancel, busy/rejection,
  success, lost/malformed/408/429 save, reload lock/read recovery, role/session
  changes, fixed/null/zero/extreme amounts and long names/descriptions/codes.
- Native desktop/mobile screenshots and practical 320/375/430/768/1024/1440/1920px
  widths must be checked. Compare both concepts and final renders in one view_image
  pass; record copy diff, computed typography and at least five fidelity points.
  The generated mobile image is a broad overview; narrow readable controls and
  full-date stacking intentionally extend below that overview's height.
