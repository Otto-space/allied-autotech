# Product inventory — extracted design, 17 October 2026

Fresh desktop and mobile concepts were generated and inspected before UI code.
Preserve the real Allied shell, branding, authorised navigation and search. Generated
suppliers/transfers/purchases navigation and slogans are not supported page content.

- Pale `#f4f6f8` canvas, white filter/list/form surfaces, ink `#01121a` record-heading
  band and text, red `#e60301` primary actions, muted borders, 8px corners. No product
  imagery, charts, invented metrics, gradients, bulk operations or decorative cards.
- Quicksand throughout: established 28px desktop/24px mobile title, 18px section
  headings, 13px body, 12px captions. Real shell density and neutral status treatment
  override generated typography, fake branding and yellow/blue status/link colours.
- Overview / Product inventory breadcrumb. Title Parts inventory; subtitle Review
  recorded stock and reservations in your permitted branches. Refresh inventory and
  administrator-only Add inventory record. Lucide chevron/refresh/plus icons, 14–16px.
- Compact filter form: Search part name or SKU, administrator-only Branch (including
  inactive history), Show only low-stock records, Apply filters and Clear filters.
  Mobile uses an accessible Filters disclosure; desktop keeps filters visible.
  Exact product links remain a supported query constraint, with clear scope guidance.
- Inventory records ink band and actual records-on-page count, never a global total.
  Five desktop columns Part & branch / On hand / Reserved / Available / Reorder level.
  Product name links to existing detail; SKU, full branch and inactive facts remain
  visible. Available is on-hand stock less reserved stock. Low stock means available
  is at or below reorder level. Mobile keeps complete labelled facts in two columns,
  rather than squeezing the generated four numeric columns into 320px.
- Previous / Page N / Next cursor navigation; unknown deep-link pages say Later page
  and First page instead of claiming a total. No fabricated showing-X-of-total text.
- Administrator creation uses a collapsed Add a branch inventory record disclosure,
  expanded by the heading action. Mount and preserve the existing form only after
  first opening. Desktop branch/search fields share a row, selected part spans width,
  reorder threshold and review action are compact; mobile stacks. Preserve current
  catalogue choice search/paging, labels, validation and review dialog. Do not add
  generated Cancel, purchase-order or transfer claims. Copy: Create an empty record;
  receive stock separately. Creation does not add physical stock.
- Required additional states use the same system: empty/filtered empty, loading,
  refresh failure with blocked old facts, denied/malformed/mismatched data, invalid
  query, validation, reviewed creation, known rejection and reload-persistent uncertain
  creation. Explicit branch/part saved-record reconciliation never resends a POST.

Browser plugin is unavailable. Verify with Playwright/Edge, Axe, native desktop
concept viewport and direct concept/render image comparison.
