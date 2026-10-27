# Managed workforce finance — milestone 110 specification

Only `/admin/workforce/finance` is active. Previous goal turn completed milestone 109 and is classified as progress. The objective, repository rules, route contracts and four native baselines were revalidated before design.

## Audit and scope

The generic finance queue repeats large cards containing only payment number, raw status and floating-point formatted money. It has no filtering, named branch/source context, current detail or reloadable paging. ACCOUNTANT alone grants branch-scoped FINANCE_READ. Existing scope includes direct order/booking payments and invoices linked to permitted orders/bookings; vehicle-only payments remain outside this contract. Preserve active account/MFA/workforce boundaries and read-only authority. No provider calls, transfers, refunds, approvals or financial mutations are added.

## Accepted design

Fresh built-in Image Gen references: desktop.png, mobile-overview.png and mobile-detail.png. All were inspected before implementation. The mobile overview's crowded bottom dates are superseded by the fresh standalone detail reference. Use the actual existing logo, navigation, Quicksand interface, 28/24px page heading, 19px section heading, 14px text, 44px controls, ink #01121A, red #E60301, cool #f4f6f8 canvas, white surfaces, #ccd6df borders and 6px corners.

Sequence: Overview / Payment records breadcrumb; Payment records heading; “Review recorded payments within your permitted branches.”; outlined Refresh records and current read time; compact filter panel; six-column table; real cursor paging; selected read-only payment workspace.

Filters: Search payments / Payment, order or invoice reference; Payment status / All payment states; Purpose / All purposes; Apply filters; Clear filters. Helper: “Search covers all payments in your current scope.” Table: Payment with created date, Related record, Branch, Amount, Status, Open. Selected row pale-red wash/left accent; View payment outlined. Footer: current page count, First page / Previous page / Next payments reflecting availability. Phone uses stacked labels above values.

Detail: payment number and status, Close selection; facts Amount, Purpose, Currency; Related records and Recorded dates. Dates: Created, Updated, Succeeded, Payment window ends, Cancelled, Expired; actual timestamps in Lagos time or Not recorded. Note: “Recorded payment state. Bank settlement and refunds are handled separately.” Desktop columns align at the top with intrinsic panel height; phone stacks all content and dates. No mutation controls or unauthorized legacy detail links.

Intentional corrections: actual logo/sidebar and accessible typography replace generated substitutions; fixed 256px desktop shell; flat red primary and existing outlined secondary buttons; normal semantic badges without invented dots/gradients; refresh outside filter panel; canonical “Close selection” rather than generated “Close”; real two-row fixture rather than one illustrative mobile row; normal 16px phone gutters instead of image canvas margins. Existing reusable containers provide accessible focus and intrinsic height. No invented metrics or images.

## Compatible backend work

Collection gains bounded literal payment/order/invoice-reference search, known status and purpose filters, current access/evaluation time and a minimal scoped related-record projection. Only permitted source branches/references may be returned or influence source search. Currency and integer-kobo amounts remain exact strings. Add GET `/staff/workforce/finance/:id` for current scoped payment facts and timestamps, with private/no-store and atomic READ audit. Exclude customer contacts, provider references, account details, policy snapshots, attempt metadata and unrelated source fields. No schema/migration/grant changes.

## Interaction and acceptance

Validated URL state preserves filters, cursor trail and selection. Hide facts on failed, denied, invalid or mismatched reads. Refresh checks current access and detail; selection moves focus into detail and close restores the row when present. Strict parsers reject unknown states, malformed money and out-of-scope sources. Use BigInt-safe amount presentation.

Gate: meaningful query/scope/money units; branch/role/source/filter/detail/privacy API checks against a verified isolated target; browser filters/paging/reload/Back/current selection, error/loading/empty/denied states, revocation and keyboard/long content; seven widths/Axe; native reference comparison; affected workforce regressions; type/lint/format/generated contract/build/source hashes; connected read-only browser/API with unchanged domain hashes and temporary-session cleanup. No next route or acceptance before all gates pass. Full-application and deployed acceptance remain separate.
