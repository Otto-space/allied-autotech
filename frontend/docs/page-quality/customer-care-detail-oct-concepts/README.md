# Customer-care conversation concept specification

Routes: `/dashboard/support/enquiries/[supportId]` and `/dashboard/support/complaints/[supportId]`. Gate 46, in progress. Recorded before production edits on 12 October 2026.

## Audit

The existing detail route validates kind/UUID and uses owned detail/message endpoints. Original message, complaint resolution, acknowledgement deadlines, status, assignment and branch are supported. Replies are paginated oldest first; resolved records permit replies, closed records do not. Staff-only contact and internal messages must never appear in customer views. Replies have no durable server replay key.

Baseline screenshots at 390, 768, 1280 and 1440 show excessive full-width definition rows and vertical gaps, with the reply form below the desktop viewport. All four were inspected. Component-only uncertain state disappears after reload. Background refresh errors are not surfaced or used to block replies, and failed later message pages disable Previous. The shared form already confirms customer-visible messages and checks the latest record before POST.

The old standalone preview on port 3001 returned missing/broken static chunks and did not hydrate. A fresh development preview on port 3002 produced the four successful baseline captures. Browser plugin unavailable; Playwright with installed Edge is the fallback. Development overlays are excluded from final production evidence.

## Accepted direction

Built-in Image Gen produced the complete [desktop](desktop.webp) and [mobile/state sheet](mobile-states.webp). Original prompts are retained in the conversation. Desktop uses a compact subject/refresh heading, original message and ruled message history on the left, record details and reply form on the right. Mobile reads original message, record details, messages, reply form. No live-chat bubbles, decorative photography, invented presence, unread counts or response promises.

Pre-code corrections to generated references:

- Preserve the existing approved logo, sidebar, shell and actual account identity; generated logo, solid-red sidebar selection, phone frame/status bar and account menu are illustrative only.
- Use actual Quicksand, 26px desktop/22px mobile heading, 18-20px section titles, 14px body and 12px supporting text; mobile textarea stays 16px.
- Keep the Messages introduction on white below its ink header at every width, following the desktop treatment. No blue privacy callout or tinted-red recovery surface: use muted text and a white recovery panel with a red left rule.
- Preserve `Reply text` as the accessible label and the full existing confirmation impact/privacy description. Final customer confirmation is `Send reply`; staff retains its existing label.
- Recovery acknowledgement is an explicit button enabled only after a successful manual refresh, not the generated immediate checkbox. Check all relevant message pages; absence on page one never proves failure.
- Breadcrumb uses an ordered list, chevrons, clickable Overview/Customer care and the actual subject as the current title. Truncate only the breadcrumb, with full title available; the main subject wraps.
- Keep content-driven panel height rather than the generated large empty message panel. Original and message panels are distinct, as rendered in the desktop concept.
- Complaint dates, acknowledgement state, escalation, resolution, statuses and assignment use actual data. Missing fields use existing honest fallback text. All messages remain plain text; links/attachments are not invented.

## Tokens and component contract

Cool-grey canvas inherited from the dashboard; white surfaces; ink `#01121A`; red `#E60301`; muted `#536478`; line `#dce3e9`; 10px panel radius; 20px panel padding; 20-24px grid gap; subtle form shadow. Desktop grid approximately 60/40, stacked below 1100px. Inputs/buttons have visible boundaries, existing focus rings and minimum 44px targets. Existing Lucide arrow, refresh and chevron icons: outline, 16px, currentColor. No new raster production assets are needed; references are design artifacts only. Reduced motion disables decorative transitions.

Component plan: customer-only thread wrapper keyed by account/kind/id; owned detail and message reads; existing SupportReplyForm with opt-in presentation and guarded write. Staff components retain their existing flow. Extend the existing support write guard with a record-scoped reply marker, fresh session identity, stale read checks, explicit manual recovery and Retry-After. Store only `pending` in the marker; draft text uses the existing account-scoped draft mechanism. Successful confirmed writes clear the matching draft. Required errors remain recoverable without displaying stale/private content.

Allowed visible copy is the retained concept labels plus existing authoritative record values, existing privacy/business-impact confirmation, honest loading/empty/error/recovery messages and existing shell navigation. No marketing copy or new unrelated controls.

## Acceptance plan

Verify both kinds, owned/private boundaries, original/resolution/acknowledgement content, paginated replies, failed-page Previous, cancellation, exact customer payload/CSRF, fresh closed/session/stale-read guards, draft restoration and clearing, unknown/contradictory response across reload, account/record marker isolation, manual recovery, unavailable storage and rate limits. Check 320-1536 widths, short viewport, long subject/body, keyboard/focus, Axe, breadcrumbs and all states. Run shared staff/customer support and Contact regressions, scoped static checks and production build. Compare native-size desktop and mobile/state references with final production captures before acceptance. Use an isolated real API/database for reply persistence and unknown-outcome recovery; provider delivery remains separate.
