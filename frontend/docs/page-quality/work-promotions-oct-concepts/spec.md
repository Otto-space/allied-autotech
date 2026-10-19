# Promotions discovery — extracted design, 17 October 2026

Fresh desktop/mobile concepts were generated and inspected before UI changes. The
first mobile generation failed on connection; one built-in retry produced the
retained full concept. Preserve the real Allied shell/branding, authorised navigation,
search and Quicksand work-dashboard scale. No generated fake navigation or metrics.

- Pale `#f4f6f8` canvas, white filter/table/record surfaces, ink `#01121a` text,
  muted `#dce4ec` borders, 8px corners. Actual concepts use a white records heading,
  rather than the prompt's ink band. No photography/charts, gradients or marketing.
- Established 28px desktop/24px mobile title, 18px section headings, 13px body and
  12px labels/captions. Real branding and controlled Quicksand override generated
  oversized/heavy typography. Neutral configuration labels avoid implying eligibility;
  existing brand-red primary controls override inconsistent navy/red concept variants.
- Overview / Promotions breadcrumb. Title Promotions; subtitle Manage checkout
  discounts, eligibility windows and configured usage limits. Refresh promotions and
  Create promotion. Lucide refresh/plus/chevron/filter icons, 14–16px.
- Compact search/configuration/discount-type/apply/clear toolbar. Exact labels Search
  promotion name or code, Configuration filter, Discount type, Apply filters and Clear
  filters. Configuration options All promotions / Enabled / Disabled; types All types /
  Percentage / Fixed amount. Mobile uses one accessible Filters disclosure and stacked
  fields. All controls have visible borders/focus and at least 44px height.
- Blue factual guidance remains visible: Enabled is a configuration setting. Dates,
  subtotal and usage limits are checked at checkout. These records do not include
  redemption counts or remaining uses. Guidance sits within the desktop filter surface
  and follows its form on mobile; no eligibility or remaining-use claims.
- Promotion records heading with actual promotions-on-page count, no invented global
  total. Five desktop columns Promotion / Discount / Eligibility window (Lagos) /
  Configuration / Usage limits. Name is the single management link. Preserve full code
  or No redemption code, exact percent/fixed amount, minimum/cap, starts/ends including
  sub-minute precision, enabled setting and both configured limits. Nulls say Not set.
- Mobile transforms into separate complete white record surfaces with labelled facts,
  rather than squeezing the generated multi-column fact layout into 320px. No hidden
  names/codes/amounts/dates or duplicate controls. No inline switches/delete/bulk actions.
- Existing cursor semantics: Previous / Page N / Next; a cursor without known trail
  says Later page / First page. No generated total-page counts. Persist filters and
  cursor trail in the URL, reset paging on filter change, block invalid links.
- Required loading, empty/filter-empty, refresh failure with blocked old records,
  denied/malformed/duplicate/mismatched data and branch-free administrator access
  extend the same system. Creation and detail remain separate page audits.

Browser plugin unavailable: verify with Playwright/Edge, Axe, native desktop and
direct concept/render comparison.
