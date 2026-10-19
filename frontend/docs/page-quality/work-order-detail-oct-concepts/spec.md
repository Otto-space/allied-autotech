# Order detail — extracted specification, 17 October 2026

Both fresh full-page concepts were generated and inspected before UI implementation.
Retain the real Allied logo, existing shell and role-specific navigation; generated
lettering/search text and the mobile phone status bar are not application assets.

## Layout, tokens and typography

- Compact named breadcrumb Overview / Order fulfilment / actual reference. Heading
  is the reference, with “Review items, delivery and recorded fulfilment.” Back to
  orders and Refresh order are neutral outlined controls with Lucide arrow/refresh.
- Cool pale canvas `#f4f6f8`, white surfaces, ink `#01121a` summary and value headers,
  red `#e60301` review action, restrained gray borders `#dce4ec`, 8px corners. No
  photography, media effects, gradients or promotional badges.
- Quicksand dashboard type: 28px desktop/24px mobile heading, 18px section headings,
  13px body and 12px labels/captions. This retains the accepted user's compact scale
  instead of generated heavy/oversized lettering. UI controls remain at least 44px.
- Summary strip shows Fulfilment, Payment and Method as independent values. Desktop
  uses three columns with separators; mobile stacks when necessary at 320px. Keep
  the ink treatment on mobile to resolve the conflicting white mobile illustration.
- Desktop 2:1 columns: left order items, customer/collection-or-delivery, actual
  dated activity; right recorded totals, fulfilment form and separate aftercare link.
  Mobile sequence is items, customer/delivery, totals, fulfilment, aftercare, activity.
- Items table has Product / Quantity / Unit price / Line subtotal. Product name and
  SKU come from historical line snapshots. Mobile uses labelled rows with quantity
  and price fields wrapping; the generated three-column strip must not force overflow.
- Customer and method share a two-column section on desktop and stack on mobile.
  Only API-provided collection branch or delivery fields appear: generated branch
  street/city details and invented product descriptions are omitted.
- Recorded order value has ink heading/total, then Products subtotal, Discount,
  VAT (as recorded), Delivery. “These are the saved order amounts.” No recalculation
  using current pricing/VAT policy, and no invented delivery-VAT split without its
  original snapshot. Missing recorded tax reads “Not provided.” Admin-only invoice
  link appears only when the permitted response provides a linked invoice.
- Actual dates form the chronology; no inferred milestones, progress percentages or
  imaginary future timestamps. Payment recorded is independent of invoice/refund status.
- Lucide Package/CreditCard/Store-or-Truck 16px in summary, chevrons 14px, arrows and
  RefreshCw 16px. No oversized containers. Real shell iconography remains unchanged.

## Copy and workflow

Allowed primary copy is the exact text above plus “Order items”, “Customer”,
“Collection”, “Delivery details”, “Recorded order value”, “Update fulfilment”,
“Next status”, “Choose next status”, “Reason (required for cancellation)”,
“Review fulfilment change”, “A status change does not record a payment or refund.”,
“Returns and cancellation review”, “Open aftercare” and “Order activity”. Values,
counts, links and dates are real record data. Duplicate generated aftercare links
become one link to the existing separate request page.

Required system states use these same tokens: loading, missing/denied, malformed or
mismatched record, stale data with disabled edits, unpaid/no-transition guidance,
terminal status, reviewed cancellation, field validation, review dialog, changed
record rejection and explicit lost-response reconciliation. The backend supplies
available transitions; the browser rechecks the saved record before submitting its
observed version. A pending outcome survives reload under the account/order scope
and cannot replay automatically. Aftercare review itself remains the next page gate.

Browser/IAB is unavailable in this session. Use Playwright/Edge and Axe, inspect both
concepts and final renders with view_image, and record a fidelity ledger and exact
verification scope before acceptance.
