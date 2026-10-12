# Customer care concept specification

Route: `/dashboard/support`. Recorded before production edits on 12 October 2026. Gate 45 has [passed local acceptance](../customer-care.md); thread detail routes are separate subsequent gates.

## Audit and scope

The existing customer page uses a full-width category select, oversized status-filter wrapper, separated action row and rounded record cards. The creation form begins below the first desktop viewport. Four baseline captures at 390, 768, 1280 and 1440 were inspected. They have no horizontal overflow but weak density and hierarchy. Unknown creation outcomes only lock local component state; reload loses the lock. Background read failures and failed later-page navigation need explicit handling.

This page is CUSTOMER only, with account-keyed state. Preserve the existing staff SupportPanel, public Contact presentation, roles, CSRF, branch/source rules, confirmation, DTO parsing and server-authoritative statuses. Customer enquiry and complaint creation have no durable idempotent replay. No new backend endpoint is needed for this layout. Do not claim provider delivery, live-agent presence or response guarantees.

Affected reusable components: SupportPanel routes the customer view, SupportCreateForm receives optional dashboard presentation/recovery, SupportSourcePicker and SlotCatalogPicker gain opt-in availability/draft context support. The existing MutationReview, Feedback, cursor paging and dashboard shell remain reused. New customer-specific layout and recovery are scoped to this route.

## Accepted direction

- [Desktop](desktop.webp): 1505 x 1045, compact heading, category toolbar, two aligned columns with a 24px gap. White form at left, white history with an ink heading at right. History uses ruled records, not independent cards or a compressed table.
- [Mobile and states](mobile-states.webp): complete stacked form/history, complaint source selection, confirmation, empty/error and unknown-outcome recovery.
- Actual Quicksand UI font; dashboard heading 24-30px, section headings 20px, body 14px; mobile inputs 16px. Existing Nippo brand assets and approved shell remain authoritative.
- Canvas uses existing cool gray, surfaces #fff, ink #01121a, brand red #e60301; readable links use #b60201 and supporting text #536478. Borders #dce3e9; input borders follow existing login styling.
- 10px section radius, 24px desktop padding, 18px mobile padding. Controls at least 44px. Type/branch pair stacks on mobile; source selection and message span the form width. Textarea remains resizable.
- Reuse actual account shell, breadcrumb, sidebar and mobile navigation; no fictional account, generated logo replacement, extra slogans or footer.
- Heading: Your conversations. Intro: Track enquiries and complaints, read responses and continue the conversation. Help centre links to `/help`. Category selector switches Enquiries/Complaints. View your records anchors to history.
- History heading Your records, subtitle Open a record to read or reply. Status filter and refresh/clear controls wrap or stack. Full subject, branch, Lagos date and actual status; complaint priority remains visible. Previous/Page N/Next without invented counts.
- Creation preserves all six enquiry types and four complaint related-transaction options, conditional related-record/branch choice, subject 160 and message 4000 limits. Review before submission, then route to returned owned detail.

## Required corrections to generated output

The first desktop draft used a table, blue links and invented footer, so it was replaced before coding. The accepted revision still substitutes privacy copy, oversized headings and a full-width desktop button; use the exact privacy instruction from the brief, established heading scale and compact desktop CTA. The mobile board omits the ink history band and colors Refresh red: preserve the desktop ink band and secondary refresh styling. Generated dates, subjects, branch names, account details and statuses are fixture examples only. Use actual created timestamps, not mislabeled last-updated timestamps. Inherited branch is explanatory text unless returned source data supplies a verified name; do not invent a disabled branch value. Confirmation retains all existing business-impact wording. No decorative empty-state illustration is required.

## Recovery and validation plan

Use an account/category-scoped session marker containing only pending state before POST; no request body or token storage. Verify fresh CUSTOMER identity before sending. Unknown/contradictory outcomes survive reload and category switches; no automatic replay. Explicit successful unfiltered first-page refresh precedes acknowledgement; remind customers that missing first-page history does not prove failure. Keep further history navigation available. Failed refresh cannot be satisfied by a later background success. Block submission for unavailable/stale history or required picker data, respect Retry-After and fail closed if recovery storage is unavailable. Preserve account-scoped drafts and clear after confirmed success.

Verify full source/branch forms, confirmation/cancel, owner/role boundaries, empty/loading/error/stale/recovery, status/cursor navigation and long text at 320-1536px, keyboard/dialog focus, reduced motion, accessibility and real local API/database behavior. Run existing support/public regressions as well as focused new cases. Compare final images to both accepted concepts before acceptance.
