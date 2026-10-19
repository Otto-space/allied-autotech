# Administrator product detail — implementation spec

Gate 57, designed 13 October 2026 and subsequently [accepted locally](../work-product-detail.md). Scope: `/admin/products/[productId]`, linked
from the accepted catalogue. Admin and Super Admin only. Baseline direct URL
returned the public 404. The existing private product read supplies every field
needed here; no API, database or stock mutation is required.

## Concepts and content

- [Desktop](desktop.png): complete summary, information, images, branch availability
  and compatibility. Built-in Image Gen; source `exec-3d5934fd-e9b0-4516-be68-eb6c2150b627.png`.
- [Mobile](mobile.png): same content stacked, ink summary in two columns. Built-in
  Image Gen; source `exec-ec93f408-1db8-4b41-ba81-f00b19f2f0c5.png`.
- Reuse the accepted [catalogue editor and media system](../work-products.md)
  for `?view=edit` and `?view=media`, including review, cancellation, version checks,
  draft restoration and uncertain-save recovery.

The prompts requested the complete product detail surface, existing shell and
Quicksand, exact sample product fields, four summary facts, information/image split,
branch table and compatibility table, followed by a fresh narrow mobile version.
The first mobile output was rejected for a white summary and invented branding.
Concept samples are isolated QA data, never production content.

## Extracted system

Ink `#01121A`, red `#E60301`, white panels, cool grey page and media fallback,
thin `#dce4ec` borders, 8px radii, 20–24px section gaps and padding. Quicksand
throughout; approximately 27px heading, 18px section titles, 13–14px body and
12–13px labels. Existing 256px desktop sidebar and responsive shell remain.
ArrowLeft, RefreshCw, Pencil, Images and Package use existing Lucide outlines,
15–17px actions and 42px fallback. Controls retain 44px minimum touch targets.

Allowed first-viewport copy: Overview, Products, the API product name,
“Review pricing, visibility and product information.”, Back to products,
Refresh product, Selling price, Comparison, Visibility, Category, Featured,
Product information, Edit product, Images, Compatibility & images and API values.
Following sections: Branch availability, “Available stock is checked at each
active branch.”, Product inventory, Vehicle compatibility, Vehicle, Model years,
Notes. Missing values are explicit, never inferred.

Desktop information/image split follows the generated approximately 1.1:1 ratio.
Summary becomes two columns on narrow screens; information/images stack and
tables become labelled records. Long names, prices and notes wrap. No overlays,
gradients, new product photography, fake inventory quantities or added metrics.

Intentional contract/design corrections: preserve the real shell logo and mobile
controls; use the existing neutral status treatment instead of generated green;
show precise Lagos timestamps; retain a description subheading; multiple real
images require an accessible image selector. Empty, failed, denied, stale,
invalid-query and missing-record states extend the established catalogue system.
An inactive category is labelled separately from product visibility.

## Verification required before acceptance

Direct reads beyond page one, inactive records, all nullable fields, exact large
money, image fallback/selection/private preview, every compatibility year-bound
combination, branch availability, edit/review/cancel/save, refresh/history/drafts,
stale and uncertain saves, role denial and identity mismatch. Inspect desktop,
320/375/430px and other existing responsive breakpoints, landscape, keyboard,
dialogs and Axe. Run relevant unit/browser checks, lint, types and production
build, then compare latest rendered screenshots to both concepts. No acceptance
is claimed by this pre-implementation spec.
