# Customer purchase detail concept and implementation specification

Generated with the built-in ImageGen tool on 9 and 11 October 2026, before production edits. [Desktop](desktop.webp) and [mobile/payment/handover/recovery states](mobile-states.webp) are visual references; all shown records are synthetic examples.

## Extracted specification

- Preserve the existing customer shell, actual Allied logo, search, navigation, account controls and Help/WhatsApp support. This is a customer-only owned-record route.
- Cool grey page background (#f4f6f9), white connected price/payment surfaces, deep-blue (#091b38) vehicle identity, ink (#01121a) text and restrained red (#e60301) actions. No warm neutrals.
- Quicksand interface; 27?30px page heading, 22px vehicle title, 18?20px section headings, 14?16px body and 12?13px supporting labels. 44px minimum action targets and 48px select.
- Entity breadcrumb then compact heading/refresh row. Desktop summary uses a 32% vehicle image and 68% identity, followed by a connected three-column exact-price strip. Compact 220px media height; mobile image over identity and prices in clear rows.
- Recorded reservation deadline is a slim bordered information strip. Below it, a 60/40 desktop split puts payment history/request on white and recorded progress/terms/handover on a quieter open rail. Mobile stacks payment, timeline and handover; no horizontally scrolling table.
- Timeline shows actual API history only, chronological order, 10px outlined dots and a subtle connecting rule. No inferred future/completed stages. Handover distinguishes its status from purchase status, preserves zero values and missing values, and displays ready/completed dates.
- Lucide RefreshCw, ChevronRight, CarFront and MessageCircle: 16?20px outline, 1.5?2px stroke; fallback car can be 32px. No decorative oversized icons.
- Retain MutationReview for payment confirmation, exact original idempotency key recovery, complete payment-history traversal, preflight reads, CSRF and existing checkout handoff. Requesting an amount is not settlement, terms acceptance or a hold extension.
- Manual loading/error hides private content; background refresh retains visibly labelled content with payment mutations disabled. Session changes discard private records. Skeleton reserves summary shape. Missing/unsafe/failed image uses PublicMedia fallback.
- Scope CSS to this page and its payment region; preserve shared component behavior. 320?1536px, keyboard, reduced motion, long content and fixed-support spacing must be verified.

## Intentional corrections to generated artwork

The actual logo/shell replaces invented branding. Do not include invented trim, colour, fuel, image counts or handover actions. Do not display a requested payment amount before the server responds. Keep current payment review wording and layout for financial clarity. Do not promise collection from a READY record: advise contacting the team. Use neutral readable statuses instead of unrelated blue/green/orange decoration. Terms version is a historical record, not a downloadable terms document; online reservation remains unavailable until an approved versioned document and server validation exist. Never use the generated sample vehicle image as live inventory.

## Prompt record

Desktop prompt: complete compact Allied AutoTech customer purchase detail at 1440px, existing ink sidebar, cool-grey body, photographic/deep-blue identity, three exact prices, reservation date strip, asymmetric payment/timeline grid, approved terms record and support; no balance, future stages or unsupported mutations.

Mobile/state prompt: four separate 390px screens for full detail, payment review dialog, handover and loading/error/stale/unknown-payment recovery; matching palette/type/controls, actual recorded information only and safe-area support spacing.
