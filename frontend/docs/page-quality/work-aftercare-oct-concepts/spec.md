# Operational aftercare — extracted design, 17 October 2026

Fresh desktop/mobile concepts were generated and inspected before UI code. Preserve
the real Allied logo, established shell/search and authorised navigation. Generated
gear branding, slogans, fake navigation and invented “customer decision” claims are
not production content.

## Composition and visual system

- Cool pale canvas `#f4f6f8`, white summary/history/form surfaces, borders `#dce4ec`,
  ink `#01121a` text and real sidebar, red `#e60301` primary review actions. The actual
  generated concepts use a white summary, so retain that rather than the prompt's
  proposed ink strip. No imagery, gradients or decorative media.
- Quicksand throughout; established 28px desktop/24px mobile title, 18px section
  headings, 13px body, 12px captions/labels. All controls at least 44px, 7–8px corners,
  visible login-derived borders/focus. Generated very bold typography is corrected
  to the user's controlled dashboard scale. Existing neutral secondary controls and
  status treatments take precedence over inconsistent generated red/green variants.
- Named breadcrumb Overview / Order fulfilment / actual order reference / Aftercare.
  Heading “Order aftercare”; subtitle “Review requests and record collection or
  delivery evidence.” Back to order and Refresh order requests. One combined refresh
  checks the order, history and current permission, replacing the redundant separate
  permission-refresh control.
- Pale blue factual guidance: “An approved request does not cancel an order,
  restock goods or confirm a refund.” White three-column summary Order / Fulfilment /
  Order value, stacked label/value rows on mobile.
- Desktop approximately 3:2: left Request history with actual count and latest-100
  disclosure; right selected review and fulfilment evidence. Request records use
  restrained separators, human-readable state, date, complete reason/products,
  receipt/inspection/decision/fee/refund-deadline facts. No nested card for each fact.
- Mobile stacks all fields and places the single selected form immediately after its
  request. CSS display-contents/order may expose individual white record surfaces
  instead of one enclosing history border, to achieve the inline form without
  duplicated controls or remounting it at breakpoints. No cramped generated two-column
  labels at 320px. Evidence follows the history/review flow.
- Keep existing AftercareReview and FulfillmentEvidence form fields/review dialogs.
  Receipt and inspection are operational; approval/rejection require the live finance
  approval grant. Terminal/no-authority records have no unusable review button.
- Lucide 14px breadcrumb chevrons and 16px back/refresh arrows. No generated arbitrary
  icons, record numbers, count claims, fake detail links or character counters.

## Allowed primary copy and required states

The exact text above plus existing request-kind/status labels, “Review this request”,
“Next review action”, “Goods in good condition?”, existing note/fee labels,
“Review recorded action”, “Delivery or collection evidence”, “Delivery or collection
time (Lagos time)”, “Supporting evidence reference” and “Review fulfillment evidence”.
Record facts and counts come from the API. Preserve the complete existing operational
guidance and explicitly distinguish reviewed fees from refund amounts.

Required workflow variants extend the same system: no selection, empty history,
receipt/inspection/approval/rejection, saved one-time evidence, validation, stale
read, denied/mismatched data, unavailable permission, reviewed mutation, known
rejection and persistent pending recovery. No automatic replay of review/evidence.
Customer aftercare continues using the separately accepted customer component.

Browser/IAB is unavailable. Verify with Playwright/Edge, Axe and direct view_image
comparison of these concepts with native desktop, mobile and dialog renders.
