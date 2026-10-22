# Administrator invoices specification — gate 81

Reuse the accepted Quicksand dashboard theme: actual Allied logo/ink sidebar, white
account strip, cool canvas, restrained red primary actions, visible bordered controls
at least 44px high, 30px wide/24px narrow heading and 13px body. No global financial
metrics, invented collected/outstanding totals, customer names or unsupported actions.

Overview > Invoices ordered breadcrumb. Compact title and a short distinction between
invoice value and payment records. Create an invoice/Close invoice form, Refresh
invoices and Refresh invoice access. Creation is a deliberate optional workspace,
not an always-expanded form ahead of discovery.

One compact primary filter row: Exact invoice number, Invoice status, More filters,
Apply invoice filters/Clear invoice filters. Advanced controls group Branch (including
inactive branches), exact Customer profile reference, Source type and optional exact
Source reference. Source reference requires a source type. Preserve filters, cursor
trail, expanded filters/create state and expanded record in URL parameters; only
supported API fields are forwarded. Page-local counts/newest-first order, no invented
global pages or totals. Invalid links and unloaded/error states are explicit.

Desktop uses an intentionally compact invoice list/table: invoice number/date, named
actual source and branch, status badge, exact invoice value and due date, with one
real View invoice action. On narrow screens transform into labelled complete records,
never squeeze amounts or require horizontal page scrolling. A deliberate Details
section retains full invoice/source/branch references, version, exact Lagos lifecycle
timestamps, subtotal/VAT/deposit credit/total and all returned linked payment facts.
Payment facts are records, not a computed remaining balance; do not invent individual
payment detail routes. Real invoice/source detail links use existing routes.

Expanded draft creation is a numbered two-column panel: concise server-pricing/source
guidance beside Source type, searchable paged Source record and optional Lagos due
date. Mobile reads guidance, source and due date in that order. The picker queries
the new minimal server collection, uses literal operational number/service/title
prefix search or exact UUID, and resolves a restored off-page selection independently.
It exposes actual labels/full references, not fabricated amounts or customer contacts.
Loading, error, no matches, pagination and current selection remain distinct.

Selection checks the current source invoice. Existing invoices show a real detail
link and block another draft review. Fresh own profile, current exact source and
current source-invoice lookup precede single-flight POST. Confirmation identifies
actual source kind/name/reference/branch and exact optional due date. The server
calculates the price, deposit credit and policy snapshot; creating a draft does not
issue an invoice, record a payment or collect funds. Validate source/due date, DRAFT
version0 lifecycle and exact arithmetic of the returned record before success.

Confirmed draft appears in a focused, visible saved-result panel with actual amount,
reference and View draft invoice link. Keep creation/detail navigation useful while
the detail route retains its separate quality gate. Cancel preserves fields/focus
with no refresh. Clear only the saved creation draft, not filters or unrelated work.

Minimal actor/role/source pending markers survive uncertain results/reload and redact
reference values on session invalidation while keeping a lock. Explicit Load current
source invoice rechecks authorization and reads the current source mapping without
replay or proof of the original outcome. Absence is a current observation, not proof
an in-flight create failed. Any new review is deliberate; source uniqueness remains
the final duplicate guard. Redacted references require explicit manual reconciliation.
Temporary read failures retain labelled facts read-only; denial clears protected list,
source choices/forms and saved results. Blocked recovery storage prevents dispatch.

Recheck native concept dimensions, seven widths from320px, loading/empty/error/role/
long-content/create/review/recovery/saved states, keyboard and Axe. Before the
production build, inspect every state and all financial/permission copy. Build the
final snapshot once after focused development checks, then verify production flows,
real API/database effects, source hashes and at least five fidelity/copy points.

## Inspected concept corrections before UI edits

Both fresh images have been viewed and saved. Keep the actual Allied logo/sidebar,
white account strip and Find a page navigation search; do not introduce the mobile
concept's unsupported account search. Use exact API numbers/dates rather than the
generated mobile's changed creation/due examples. Invoice values are not paid or
outstanding balances. The filter label must say Exact invoice number.

Desktop shows creation expanded for reference; normal discovery starts collapsed.
At 430px, controls and source facts stack when needed rather than copying the wider
generated reference's compressed two-column controls. Use page-local counts and
Previous/First page/Next without the mobile's invented numbered page button. Details
retains complete actual references/totals/payment facts; no bulk, delete, collect,
issue or void control is added to this list. Actual native PNG dimensions are measured
for comparison. The server-priced draft must be reviewed and issued separately.
