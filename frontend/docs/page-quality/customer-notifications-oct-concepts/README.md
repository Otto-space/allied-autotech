# Customer notifications design specification

12 October 2026. Gate 43, `/dashboard/notifications`. Concepts prepared and baseline inspected before production edits.

- [Desktop](desktop.webp): complete inbox and delivery preference rail.
- [Mobile and states](mobile-states.webp): mobile continuation, confirmation dialogs, empty, filtered, loading, error and uncertain outcomes.

## Extracted system

Preserve the existing authenticated shell, actual logo, sidebar navigation, account identity, breadcrumb and support dock. Quicksand throughout; shared heading sizing 30px desktop / 24px mobile. Ink `#01121A`, red `#E60301`, white `#FFFFFF`, cool gray `#F4F6F8`, borders `#DCE3E8`, readable muted ink `#52616B`. No decorative imagery for the private inbox.

Page title **Notifications**. Subtitle **Read your account updates and manage optional delivery.** No eyebrow. Compact heading-to-content gap 24px. Desktop grid flexible inbox and 340px preferences, gap 24px; stack below 1100px. White surfaces, radius 10px, thin borders. Body 14px, section headings 20px, row headings 15px, UI 13px. All interactive targets minimum 44px; use existing strong input/focus treatment. Reduce panel padding 20px to 16px on mobile.

Inbox header: **Inbox**, **Refresh inbox**. Two labeled selects (**Notification type**, **Notification category**) and **Unread only**. Toolbar **Latest updates** / **Mark all read**. Filters use server queries, not local filtering of a partial page. Preserve limit 25 and cursor pagination. Rows separated by rules; unread 3px red rail and explicit Unread label, read neutral label/rail. Category/type metadata, title, full message with preserved line breaks, Lagos timestamp and unread-only **Mark as read**. No invented detail links, totals, receipts or status derivation from message text.

Preferences rail: dark header **Delivery preferences** / **Choose optional email and SMS updates.** Four horizontal rows with actual effective saved/default state, neutral readable text, individual Enable/Disable confirmation actions. Operational default on; marketing off without recorded consent. Security and transactional messages stay on; in-app updates unchanged. Marketing delivery is unavailable under existing backend policy; recording a preference does not enable campaigns. Footer **Refresh preferences**. No toggle changes before server confirmation.

Mobile keeps page order, stacks filter fields at narrow widths, wraps metadata, places row actions below message where necessary and preserves dock clearance. Tablet can use paired preference rows only if readability is retained; primary reference is one compact column. Confirmation uses shared MutationReview with safe initial focus, restoration, scrollable content and explicit scope/consent. Read-all includes hidden/expired records and is bounded by the server mutation time, not the currently displayed page.

## States and integrity

Match row-shaped skeletons. Empty includes explanatory copy; filtered empty includes Clear filters; paging-empty retains Previous. Independent inbox/preference errors allow the other region to work. Hide data on foreground read errors; label preserved background data as stale and disable writes. Fresh session identity check before each customer mutation. Persist only an account-scoped pending marker before writes; uncertain outcomes survive reload, require explicit successful refresh and acknowledgement, and never trigger automatic replay. Respect Retry-After. Account changes unmount content/dialogs and cancel in-flight requests. Preference writes have no version/idempotency contract; do not claim concurrent-edit protection.

## Deliberate corrections to generated pixels

The generated logo, tagline, full-red navigation selection, green states, sample dates/copy and Page 1 of 1 are not authoritative. Preserve real shell, actual API content, neutral labels, Page 1 without total and no action on already-read rows. The mobile board abbreviates text and depicts a white shell; retain the real dark mobile header and complete required copy. These contract/brand corrections are specified before coding. Preserve composition, density, dark preference header, rules, controls and responsive hierarchy.

## Verification record

Four baseline widths 390/768/1280/1440 captured and viewed; no overflow, but desktop 2310px and mobile 3106px tall for three rows show excessive spacing. Final ten-width captures, native desktop comparison, empty/loading/error/stale/uncertain/consent states, Axe and keyboard checks, 52 notification browser cases, real API/PostgreSQL ownership/CSRF/filter/read/preference checks, build and lint now pass. See the [acceptance report](../customer-notifications.md) for evidence, corrections and limitations.
