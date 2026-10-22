# Managed workforce orders — milestone 109 specification

Only `/admin/workforce/orders` is active. The preceding turn completed milestone 108 acceptance and is classified as progress. The objective, current contracts, permissions and four native baselines were revalidated before design.

## Audit and authority

The generic queue repeats large preparation forms, raw status text and item paragraphs. It has no search/filtering, named branch, current-detail read or durable URL paging/uncertainty. Operations Supervisor, Customer Service and Sales Supervisor have branch-scoped ORDERS_READ; only Operations has ORDERS_PREPARE. Existing preparation accepts expectedVersion, PROCESSING/READY and a trimmed 10–1000 character reason. Only paid COLLECTION orders can advance CONFIRMED to PROCESSING to READY. Preserve all other workflows and existing actor/MFA/CSRF/workforce boundaries. No release, delivery, cancellation, payment, refund or inventory action is added.

## Accepted visual specification

Fresh built-in Image Gen desktop and corrected narrow phone concepts are `desktop.png` and `mobile.png`. Both were inspected before coding. The first phone concept was rejected for tablet-like horizontal fields; it remains outside the repository. Prompts are retained here.

Reuse the actual shell/logo/navigation, Quicksand UI, compact 28px/24px main headings, 19px section titles, 14px text, 44px controls, ink #01121A, red #E60301, cool #f4f6f8 canvas, white surfaces, #ccd6df borders and 6px corners. Use the existing outline search/refresh/chevron icons. No new imagery, KPIs or navigation.

Sequence: Overview / Order progress ordered breadcrumb; Order progress heading; “Track orders and prepare paid collections within your responsibilities.”; Refresh records and actual current-read time; compact filter panel; queue; paging; selected workspace. Filters are Search orders (Order number or product), Order status (All order states), Fulfillment (All methods), Apply filters and Clear filters. Helper: “Search covers all orders in your current scope.” Desktop filters fit inline where space permits; phone labels appear above stacked fields.

Queue columns: Order with created date, Branch, Fulfillment, Payment (Paid recorded / Not recorded), Status, View order. Selected row has pale-red wash and left accent. Phone uses vertical labeled facts. Footer reports current-page count and First page / Previous page / Next orders, reflecting actual cursor availability.

Selected workspace: order number/status, Close selection, named branch, fulfillment method and payment-recorded date. Left desktop column: Order items (Product / Quantity), then Recorded progress (Created, Confirmed, Processing, Ready, Completed, Cancelled, each actual timestamp or Not recorded). Right: Prepare collection with server-available next state, “Only paid collection orders can advance. Customer release requires separate authority.”, Preparation note, 10–1,000 characters, Review preparation update. Phone stacks all panels and facts. Read-only roles/noneligible orders receive a truthful explanation without a mutation form.

Locked corrections to generated examples: preserve real logo and shell; no added sortable column, blue links, gradients, last-page or numeric pagination, or fabricated activity. View order is an ink outlined control; refresh stays outlined; primary actions are flat red. Use existing readable semantic status colors. Phone outer image margins are not UI gutters; layout fills the viewport with established 16px margins. Actual two-row fixture/count and intrinsic content heights replace illustrative one-row phone data. Keep the normal 10–1,000 character hint below a usable textarea, not only as a placeholder. Render named headings and existing MutationReview/error/recovery primitives.

## Compatible contract additions

GET collection gains optional bounded literal q, known order status and fulfillment filters combined with branch scope and existing UUID cursor. Preserve item names/quantities, add branch identity/name, updatedAt, server-computed availableNextStates, access and generatedAt. New GET `/staff/workforce/orders/:id` returns a current scoped record and recorded progress timestamps, with parent shared lock and READ audit. Exclude customer contacts, financial amounts, transaction/policy identities and internal notes.

PATCH preparation takes the parent update lock before fresh scope/version/payment/fulfillment/state validation. Return additive exact actor/action/prior-state/prior-version/reason receipt and current scoped order with next-state availability. Mutation/audit remain atomic. No schema, migration, role/grant expansion or different business transition.

## Interaction and gate

Validate URL search/filter/cursor/trail/selection. Fail closed for invalid/mismatched scope or failed refresh. Preserve harmless drafts, require explicit adoption after the base changes, and recheck fresh access/current order before exact review submission. Validate exact receipt. Persist a minimal hash marker before dispatch; unknown results including 408/429 stay locked through reload and require current inspection plus independent reconciliation. No automatic replay; session changes redact metadata and clear private drafts.

Gate includes meaningful helper/receipt/recovery units, branch/role/search/transition/concurrency API checks on a verified isolated database, browser filters/paging/selection/errors/roles/preflight/recovery/long content, seven responsive widths/Axe, native concept comparison, affected existing workforce regressions, type/lint/format/generated-contract/build/source hashes and connected browser/API evidence with preservation and session cleanup. Do not mark accepted or advance routes until these pass. Deployed/full-application acceptance remains separate.
