# Customer profile design specification

Fresh ImageGen desktop and mobile/state concepts created and inspected on 11 October 2026 before production edits. Source PNGs remain in the session generated-images directory. WebP copies preserve the full concepts.

- [Desktop](desktop.webp): connected ink identity/photo panel on the left, wider white contact form on the right, cool grey page background. Approximately 30/70 columns with a 24px gap, 24px form padding, compact 44px controls, subtle borders/shadows, and a reserved desktop support gutter.
- [Mobile and states](mobile-states.webp): compact horizontal identity, collapsible photo controls, one-column contact form, visible save/discard feedback; expanded upload, confirmation, stale data and uncertain-save recovery treatments.
- Typography: existing Quicksand throughout; title 24-28px, section heading 17-18px, body/fields 14px. Ink #01121A, red #E60301, secondary #526071, cool grey #f3f5f7; disabled controls retain readable contrast.
- Preserve existing dashboard sidebar/header, account-only page search, breadcrumb and support controls. Generated alternative wordmark, marketing footer, unrequested account dropdown and searchable-parts placeholder are not specifications for changing the established shell.
- Country stays read-only from the actual profile; no country selector or unsupported country mutation. No invented email verification/status badges. Names, email and photos come from the owned API record; generated Amara details are QA fixtures only.
- Above-fold copy: Your profile; Keep your contact details up to date.; Refresh profile. Form: Personal details; We use these details to contact you about your bookings and purchases.; Address; Optional. Useful for delivery and service requests.; Save profile; Discard changes.
- Photo workflow preserves selected-file preview, actual transfer progress, upload cancellation, prepared-token confirmation, original-body retry and confirmed removal. Missing storage shows a truthful unavailable state. Failed private image loads fall back to initials.
- Failed refresh retains visibly stale information with mutations disabled. Denied reads remove private content. Unknown profile PATCH outcomes lock further saves until an explicit reload of saved details. Metadata PATCH has no server version or idempotency contract; submit changed fields only, never claim atomic lost-update protection. Media uses its existing expectedVersion and confirmation replay contract.

Baseline screenshots inspected at 390, 768, 1280 and 1440px. Original layout places a very wide uploader before the contact form, pushes editing below the first desktop viewport, and lacks stale-read/uncertain-save locks.
