# Order fulfilment — extracted design, 17 October 2026

Generated desktop and mobile concepts are stored alongside this file and were inspected before implementation. Reuse the accepted dashboard shell, real Allied logo and role-specific navigation; generated brand lettering and unauthorized Staff navigation are not application assets.

## Composition and tokens

- Cool pale dashboard background, white filter panel and records, ink `#01121a` desktop records band, restrained red primary Apply action. No photography, gradients or media overlays on this operational page.
- Open breadcrumb and heading, right-aligned neutral Refresh orders. White bordered filter strip: full order number, fulfilment status, administrator-only branch, Clear filters and Apply filters.
- Supporting line: “Fulfilment status and recorded payment are shown separately.” Ink desktop records heading with actual page count. Five columns: Order, Branch, Fulfilment, Payment, Order value. Named order link, created timestamp in Lagos time and collection/delivery method; recorded payment timestamp where available.
- Mobile uses an open records heading and individual labelled records, retaining every column. The generated four-column mobile metadata strip cannot fit a 320px viewport: use a two-column metadata grid, with long branch/value text wrapping safely. This is a required responsive correction.
- Previous / page / Next below records. No invented overall totals or financial actions.
- Quicksand throughout dashboard; accepted existing scale: 28px desktop / 24px mobile heading, 18px section headings, 13px content, 12px labels/captions. Controls at least 44px tall; 7–8px corners, pale borders, login-derived focus treatment. Generated oversized bold typography is corrected to the user's controlled dashboard scale.
- Reuse neutral status badges and secondary buttons from accepted operations pages. Payment “Recorded” reports only the API's paidAt timestamp; it must not imply invoice settlement or lack of a refund. Human-readable fulfilment labels independently describe order state.
- Lucide outlined refresh, breadcrumb chevron and pagination arrows at 14–16px. No decorative icon containers. Existing shell icons and navigation remain authoritative.

## Behaviour and allowed copy

The static copy above plus “Order fulfilment”, “Manage orders within your permitted branches.”, “Order number”, “Enter the full order number”, “Fulfilment status”, “All statuses”, “Branch”, “All branches”, “Order records”, “Collection”, “Delivery”, “Recorded”, “Not recorded” and the six human-readable order states form the primary view. Counts, dates, amounts, branch names and references come from the API.

Required workflow states extend the same system: loading skeleton, filtered empty with clear action, error with retry, invalid URL with clear action, stale retained records with disabled pagination, denied data removal. A customer deep link shows “Filtered to one customer” and a clear-customer action. Filters use server queries and URL history. Staff never fetch administrator branch choices; customers never fetch staff orders. Search is an exact, case-sensitive full reference; no client catalogue scan. No mutations on this list.

## Verification pending

Compare browser desktop/mobile to these concepts for composition, copy, palette, type scale, row density, field hierarchy, icons and responsive continuation. Browser/IAB is unavailable in this session; use Playwright and Axe. Acceptance requires role/query/recovery and real API evidence as well as rendered inspection.
