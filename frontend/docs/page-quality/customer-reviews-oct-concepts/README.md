# Customer reviews concepts and implementation specification

Status: concepts inspected and specification extracted before production edits; page locally accepted; see the [gate report](../customer-reviews.md).

## References

- [Desktop](desktop.webp), generated 1505 x 1045.
- [Mobile and states](mobile-states.webp), generated 1402 x 1122.
- Baselines: `C:/Users/PC/.codex/customer-reviews-oct-before-{390,768,1280,1440}.png`; all four inspected.
- Original generated PNGs retained in the Codex generated-images directory for this thread.

## Composition

Preserve the existing customer shell, logo, search, navigation and Help/WhatsApp dock. Main heading has the existing red Your feedback eyebrow, Reviews, a short explanation and a Read public reviews link. Quicksand throughout this private workflow. At desktop widths use a compact white authoring panel beside a history panel with an ink heading band. Both align at the top; history grows with real data. Use a 24px gap, approximately 55/45 split. Stack below 1100px; pair type/rating controls when at least 540px is available. Small-screen form precedes history, with 16px padding and dock clearance. Stack history filter and refresh controls below 600px so the refresh label remains on one line. No sticky authoring form or synthetic review counts.

Main heading follows the existing 30px desktop / 24px mobile shell. Section headings 20px; record headings 16px; readable body/control text 14px or existing accessible inherited size. Ink #01121A, red #E60301, white and cool neutral background. Panel radius 10px, understated border/shadow, thin separators between history rows. Form spacing 16-20px; controls at least 44px; textarea 132-150px minimum and vertically resizable. Buttons use the existing visible borders and focus ring. Reduced-motion support is retained.

## Components and interactions

- ReviewsPanel: customer/account guard, history resource, filter/cursor controls and recovery state; keyed per current user.
- ReviewCreateForm: existing validation, type/rating/title/comment fields, conditional source picker, existing MutationReview confirmation. Account-scoped draft identity and cleanup on confirmed submission.
- ReviewSourcePicker: existing completed-record endpoints, loading/error/stale handling and fresh selected-source validation before POST.
- Customer review record: compact stars plus numeric accessible rating, moderation label, target, title, complete comment, Lagos date, explanatory status and actual moderation note/time when supplied. Do not change public/staff ReviewCard rendering.
- Existing Feedback and CursorPagination primitives; skeletons follow record geometry.
- Dedicated review write recovery: fresh customer session, source preflight, pending marker before POST, response validation, Retry-After, no automatic replay. Unknown outcomes survive reload and require explicit successful history refresh then acknowledgement. Failed refresh must not enable acknowledgement through later background refresh.

## States

Initial loading; no reviews; filtered/page empty with clear filter/previous navigation; foreground read failure without stale rows; background failure with stale warning and mutation lock; source unavailable/changed; field validation; confirmation/cancel; success; known rejection; rate limit; unknown/contradictory response; marker storage failure; current-account change and role denial. Long review and moderation content wraps without truncation. Normal motion and reduced motion must both remain usable.

## Intentional corrections to generated artwork

Keep the actual Allied logo, existing sidebar and help dock; omit invented slogans, footer and named account. Use the existing button label Review submission, followed by Submit for moderation only in confirmation. Do not adopt Submit review from the desktop artwork. Keep the real 2,000-character maximum, not the generated 500 counter. Overall business reviews need no transaction; do not adopt the mobile empty-state suggestion that a service is required. Use neutral pending/approved status styling and red rejected styling, not generated orange/green. Only APPROVED reviews are public; generated confirmation copy must not imply that all submissions are published. Show Page N, never invented total pages. Use actual dates and full comments; do not copy generated dates, ellipses, moderation reasons or customer identities into production data. The mobile board depicts continuation/states, not three simultaneously rendered page columns. History remains ruled rows per desktop composition.

## Verification gate

Baseline -> concepts/spec -> implementation -> browser and real API/database -> final screenshots at 320/360/375/390/430/768/1024/1280/1440/1536, native concept viewport and short/mobile state views -> fidelity corrections -> lint/type/build -> acceptance. The separate [gate report](../customer-reviews.md) records local acceptance and verification limits.
