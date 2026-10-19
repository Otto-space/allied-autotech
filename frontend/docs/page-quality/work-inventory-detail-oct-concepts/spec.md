# Inventory detail — extracted design, 17 October 2026

Fresh desktop/mobile concepts were inspected before UI changes. Retain the real
Allied shell, branding, authorised navigation and Quicksand dashboard typography.
Generated supplier/purchase-order navigation, tax-inclusive claims, customer search,
fake totals and arbitrary character counters are not production content.

- Pale `#f4f6f8` canvas, white four-part stock summary and form/history surfaces,
  ink `#01121a` text, muted `#dce4ec` borders, 8px corners, brand red primary writes.
  The generated concepts use a white summary, which takes precedence over the
  prompt's proposed ink strip. No photography, decorative metrics or gradients.
- Compact established 28px desktop/24px mobile title, 18px section headings, 13px
  body and 12px labels/captions. Neutral secondary controls and statuses retain the
  accepted work-dashboard system, overriding generated all-red/green variants.
- Named breadcrumb Overview / Product inventory / actual part name. Actual part
  heading, SKU and branch; Back to parts inventory and Refresh inventory record.
  Four stock meanings On hand / Reserved / Available / Reorder level, four columns
  desktop and two-by-two mobile. Catalogue price and Last updated are subordinate
  facts; never imply recorded stock is a payment or invent a tax breakdown.
- Blue factual guidance: Stock movements do not create orders, invoices or payments.
  Two equal desktop columns: movement left, reservation and reorder right. Stack
  complete forms on mobile. Preserve existing field labels, notes, references,
  validators, optional customer profile reference, Lagos expiry and reviewed writes.
- Full-width Stock reservations below: status filter and Refresh reservations,
  complete ruled records with status/units/expiry/reference/customer facts and
  existing release-note/review/reserved-sale controls. Keep valid expired-release
  handling; do not offer a reserved sale after expiry. Mobile uses stacked labelled
  facts and controls rather than the generated cramped multi-column table.
- Full-width Stock movement history: movement filter, Refresh stock history, four
  desktop columns Movement & time / On hand before-after / Reserved before-after /
  Reference & note, complete deltas and existing pagination. Mobile uses labelled
  rows. No invented row numbers or total counts. Lucide back/refresh/chevrons only.
- Preserve server authority for stock, reservations, versioned thresholds, role/MFA
  and assigned active Staff branch. Hide unavailable new reservations for inactive
  parts/branches, without inventing restrictions on legitimate physical movements.
- Required loading/error/denied/mismatch/empty/stale states extend this system.
  Fresh identity/record comparison precedes writes; minimal pending markers lock
  uncertain outcomes across reload. Preserve current idempotent same-request retries
  in memory; explicit saved-record reconciliation after reload never resends a write
  or claims an unproven outcome. Review cancellation restores focus with zero writes.

Browser plugin unavailable: use Playwright/Edge, Axe and direct concept/render image
comparison, including native desktop and mobile dialog.
