# Customer privacy requests - extracted design specification

Prepared before implementation on 12 October 2026. Scope: `/dashboard/privacy`, the customer intake and history surface. Staff review remains a separate page gate.

## Retained concepts

- [Desktop](desktop.webp): ink guidance / white form split above an open request-history section.
- [Mobile and states](mobile-states.webp): compact stacked guidance/form, confirmation, empty, loading, stale and unconfirmed-result states.

Original PNGs remain in the external generated-image directory. Both were inspected with `view_image`; the retained WebP files are encoding-only copies.

## Implementation specification

Use actual bundled Quicksand, ink `#01121A`, red `#E60301`, white and cool gray `#f4f6f8`. H1 28px desktop / 24px mobile, section headings 20px, body 14px with readable line height. Existing dashboard shell, logo, breadcrumbs, navigation and support controls remain authoritative. Main panel uses approximately 32/68 columns, 10px outer corners and a restrained shadow. Form controls have visible borders, 44px minimum height and the existing accessible focus style. The guidance shield is a small outline icon. History uses full-width rows with a thin red left rule, a neutral text status and a pale response inset; no status is communicated by color alone.

At 900px and below stack guidance and form. Keep the vital review-only statement and profile link visible; hide only the decorative numbered process on narrow screens. Stack record titles/statuses where needed. Preserve support-widget clearance and the existing cursor pagination. No photography belongs in this private settings workflow.

Allowed primary copy: `Privacy requests`; `Request a review of your personal information and follow the response.`; `A request for review`; `Submitting a request does not delete or anonymize your information, even after approval.`; `Request a review`; `Tell us what information you would like reviewed.`; `Request type`; `Why are you making this request?`; `Review privacy request`; `Your requests`; `Refresh privacy requests`.

## Contract adaptations fixed before coding

- The explanation is required, trimmed and 10-2,000 characters. Discard the generated optional placeholder.
- Preserve backend request-kind and status labels, actual dates and review notes. Sample data is QA-only. Do not add a completed/deleted state, response deadline, totals, cancellation or export.
- Keep the actual application logo, shell and support dock rather than generated branding, customer identity, phone status bar or marketing footer.
- Use existing Previous / Page N / Next pagination, not a decorative red current-page button or an always-enabled Next action.
- Confirmation uses the existing accessible MutationReview dialog with cancel-first focus, exact request facts, duplicate protection and bounded scrolling. No extra close icon is required.
- Approval remains a review decision. Records in APPROVED_PENDING_POLICY explicitly explain that information has not been deleted or anonymized.
- Initial loading, empty, error, stale, denied, success and uncertain submission must have meaningful text. Mutations remain disabled while history is unavailable/stale or reconciliation is pending.
- Uncertain submission is not automatically replayed: open-request deduplication is not durable idempotency. Refresh the latest page, then explicitly acknowledge checking the saved requests. Preserve a non-sensitive account-scoped uncertainty marker across reload; never store request explanations in that marker.
- Refresh/pagination must not discard a form draft. Clear its account-scoped draft only after a confirmed successful response. All owner and role boundaries remain enforced by backend and frontend.

## Acceptance required

Ten widths 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536; native desktop viewport; keyboard/dialog focus; accessibility; meaningful loading/error/empty/stale/recovery states; exact intake body; owner/role/session/CSRF boundaries; duplicate and changed-reason behavior; real API/database persistence. Compare retained concepts to final screenshots, record mismatches, and pass scoped regressions plus lint/type/build checks before marking the page accepted.
