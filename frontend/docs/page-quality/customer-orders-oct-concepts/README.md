# Customer orders list concept specification

Prepared 8 October 2026 before production edits to `/dashboard/orders`. Baseline inspected at 390, 768, 1280 and 1440px. Built-in ImageGen produced three fresh concepts: [desktop](desktop.webp), [mobile](mobile.webp), [states](states.webp). Originals remain under the Codex generated-images directory; WebP copies change encoding only.

## Implementation specification

- Retain the existing customer shell, approved logo, navigation and account controls. Add one semantic Overview / Orders breadcrumb inside the page.
- Use Quicksand throughout this operational page. Heading 30px desktop / 27px mobile; guidance/state headings 18px; body and controls 13px; labels 12px; supporting record metadata 11–12px. Nippo remains the established marketing display face elsewhere.
- Ink `#01121A`, brand red `#E60301`, white surfaces, cool gray canvas `#f4f6f8`, slate text `#435563`, panel borders `#cbd5df`, control borders `#82939f`. Radius 6px controls / 8px panels. Controls at least 44px, selects 48px. Use Lucide Package, RefreshCw, ChevronRight and directional arrows.
- Heading **Your orders**; subtitle **Review items, collection or delivery, totals and payment records.** Actions **Browse parts** and **Refresh**.
- Ink guidance strip: **Your next step is in the details** and **Open an order to review its items, payment options and available actions.**
- Bordered filter panel: **Order status**, **All statuses**, supported status names, **Rows per page** 10/20/50, **Reset filters**. Persist validated status, limit and cursor in the URL; browser Back/Forward and reload preserve state. No unsupported order search or global count.
- Result heading counts the current page only. Desktop table: **Order & items**, **Collection or delivery**, **Status**, **Total & payment**, one **View order** link per row. Show at most two item snapshots and remaining line count; full items remain in detail. Display exact server totals and only the payment record evidenced by `paidAt`.
- Below 1100px use labeled table records; identity and fulfillment span the record, status/payment share two columns, and the detail action spans the mobile record. Preserve semantic table headers and caption. Page overflow must remain zero at all ten target widths.
- Pagination uses Previous / Page N / Next when the URL contains a known traversal, otherwise Later page / First page. Do not infer a global page count. Footer: **Dates shown in Lagos time.** and **Need help with an order? Contact support**.
- Loading uses table-shaped skeletons; manual failed reads hide stale records and offer Retry orders. Background failures retain readable data with the explicit stale notice. Empty states distinguish initial, filtered and later-page emptiness. Session changes discard customer data and pending results.

## Deliberate corrections to generated artwork

The existing shell and official logo take precedence over generated alternatives and invented account names. Use actual backend dates, quantities and amounts instead of the sample artwork. Keep Page N as text, not a blue selected button. Maintain the established neutral status and outlined secondary button styling. The states board's invented “Customer orders” heading, eyebrow, USD row and “Shipped” status are excluded; it specifies result-state composition only. Use real API error copy and the primary concept's five-column record anatomy in every state. Keep the real Help/WhatsApp utilities from the shell. No generated raster is rendered as application UI.

The implementation review refined select typography to 14px desktop / 16px mobile and labels to 13px. The mobile size avoids focus zoom on mobile browsers; explicit scoped control borders and red focus treatment prevent the shared form cascade from overriding the intended tokens. Record paragraph spacing is 2px with 1.5 line-height, and desktop cells use 12px vertical padding to match the compact concept. State icons are centered within their result panel.

## Prompt record

Three separate built-in generation requests specified: (1) complete landscape 1440×1000 desktop composition, existing 256px sidebar and 70px toolbar, four snapshot rows and full pagination; (2) two readable 390px mobile views covering header, controls, collection/delivery records and continuation; (3) a focused board of loading, initial empty, filtered empty, failed read and background stale-data notice. Every prompt specified the palette, Quicksand typography, exact functional copy above, 44px controls, neutral statuses, actual supported fields and no product photos, charts, fake totals or unsupported controls. The saved concepts are visual specifications, not backend evidence.
