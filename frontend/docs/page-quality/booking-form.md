# Booking creation quality report

Route: `/services/[serviceId]#service-request` for a fixed-price service with a published price and duration.

Status: **complete — local creation-flow gate passed, 7 October 2026.** This report covers creation only; `/dashboard/bookings/[bookingId]` and its rescheduling, cancellation and quotation decisions remain separate milestones. The [expanded October brief](expanded-brief.md) remains open across the application.

## Audit and design

The existing form already used real branches, appointment slots, customer vehicles and booking terms. It submitted immediately and had no progress indicator or visible receipt reference. The September Service detail gate did not satisfy those separate Booking requirements.

Baseline screenshots were captured and inspected at 390, 768, 1280 and 1440px before changes (`C:/Users/PC/.codex/booking-form-before-*-{viewport,full}.png`). The [generated flow concept](booking-form-concepts/01-flow.webp) defines Details → Review → Received within the existing service page. The [concept notes](booking-form-concepts/README.md) record actual-data and October-brief amendments. Nippo, Quicksand, the existing automotive hero/context, compact bordered controls and responsive branch picker remain in use.

The current Login styling was inspected as the form reference: visible control boundary, restrained radius and a brand-colored focus treatment. Booking retains its accessible explicit focus ring and adds a subtle major-panel shadow. No new dependency or production image is required.

## Behavior and contracts

All API paths below are relative to `/api/v1`.

| Capability       | Existing contract and behavior                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service identity | `GET /public/services/{serviceId}`; validate the requested ID, pricing and published details                                                                                                                                            |
| Terms            | `GET /public/booking-policy`; use the returned version and advance/reschedule rules; current policy requires no deposit                                                                                                                 |
| Branches         | `GET /public/branches?limit=20&cursor=…`; preserve selected identity across bounded pages                                                                                                                                               |
| Appointments     | `GET /public/services/{serviceId}/slots?branchId=…&limit=50&cursor=…`; reject mismatched service/branch identities and invalid dates                                                                                                    |
| Account          | Optional-session `GET /auth/session`; check before presenting customer-only actions and again before mutation                                                                                                                           |
| Saved details    | Existing owner-only `GET /customers/profile` and paginated `GET /customers/vehicles`; load only on an explicit customer action                                                                                                          |
| Booking creation | CSRF-protected, idempotent `POST /customers/bookings`; submit `slotId`, `policyVersion`, optional `vehicleId` and normalized optional `customerNotes`; legacy deposit acknowledgement is sent only when the returned policy requires it |
| Receipt          | Validate the returned booking; show its real ID, status, service, branch, appointment, vehicle and notes; link to `/dashboard/bookings/{bookingId}`                                                                                     |

Review captures the exact submission payload and displayed service, branch, slot, vehicle, price and policy. It creates no record. Editing keeps the mounted form values. Changed appointment or policy information requires another review. Notes normalize line breaks/tabs consistently before both review and submission; errors retain safe input and focus the relevant field or summary.

While submitting, the operation guard prevents duplicate mutations. An uncertain outcome keeps editing locked and repeats the original payload and idempotency key. A later account change aborts pending client operations and clears the review, notes, selected vehicle, slot and receipt. Cancellation of a client request is not treated as cancellation of a server mutation.

The receipt says **Booking request received**, not appointment confirmed. Its reference is the actual backend UUID, with clipboard feedback and a selectable manual-copy fallback. It does not invent a booking number, deposit, upload capability or response-time guarantee.

## Roles and recovery

- Customers can review and submit, subject to the backend's policy, ownership, availability and authentication checks.
- Anonymous visitors can review the public appointment choices and use **Sign in to request booking**. Submission is unavailable until a customer session is established.
- Staff, Admin and Super Admin see dashboard/contact guidance instead of the customer booking form, saved-customer-data controls and booking mutation button.
- A failed account read shows an explicit retry. It does not assume either customer permission or anonymous status.
- Public quotation enquiry remains a separate supported path on quote-required services; its regression checks do not mark the Quotation milestone complete.

No backend gap was required for this workflow. Authorization remains enforced by the server.

## Visual refinement ledger

| Finding                                                | Implemented correction                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Direct submission gave no review opportunity           | Inline, rule-separated summary with Edit and Request actions                                    |
| No indication of workflow position                     | Compact semantic progress list with `aria-current="step"`                                       |
| Receipt lacked a usable reference                      | Labeled, wrapping real reference with copy feedback and manual selection fallback               |
| Receipt appeared as a second card inside the form card | Removed its extra border/background/padding and retained one clear major surface                |
| Receipt repeated its title                             | Kept the contextual heading available to assistive technology while showing one success heading |
| Read-only reference inherited a resize handle          | Scoped non-resizable reference styling without changing ordinary notes textareas                |
| Summary columns could crowd narrow screens             | Stack each label/value below 600px, wrap long values, retain compact controls                   |
| Updated brief calls for form depth and role relevance  | Subtle panel shadow and explicit customer/anonymous/work-account states                         |

## Verification evidence

The final production build is recorded in `C:/Users/PC/.codex/booking-form-build-release.log`, including TypeScript and standalone preparation. Whole-workspace ESLint and type checks passed (`booking-form-lint-all.log`, `booking-form-type-final.log`); the final hero change also passed scoped ESLint (`booking-form-last-lint.log`) and the release build. The existing account/resource/SEO regression set passes **30 tests** in `booking-form-unit.log`.

Real API/database verification was repeated on 7 October against isolated local `allied_vehicles_qa`, never production. `booking-form-real-final.log` records no booking before review confirmation, preserved notes after Edit, exactly one persisted `REQUESTED` booking, the correct saved vehicle/service/branch/notes, null deposit, successful fresh read-after-write, matching displayed reference and zero browser page errors.

The durable browser cases are in [service-detail-quality.spec.ts](../../tests/e2e/service-detail-quality.spec.ts), [brand-refresh.spec.ts](../../tests/e2e/brand-refresh.spec.ts) and [public-account-actions.spec.ts](../../tests/e2e/public-account-actions.spec.ts). **72 distinct browser cases passed:** 57 route cases (`booking-form-browser-final.log`), 8 saved-details cases (`booking-form-saved-details.log`) and 7 account/quotation-lock regression cases (`booking-form-account-regression.log`). After the final role-aware hero link change, 5 affected cases passed again on the release build (`booking-form-browser-release.log`); repeats are not counted as additional cases. The earlier two failures were test-selector mistakes in branch-loading/error assertions; both were corrected and passed in the full run.

Browser plugin not available; verification used the repository Playwright suite with Microsoft Edge. The flow tested was service selection → appointment/details → review/edit → server-confirmed request receipt. Checks include keyboard branch/slot choice, touch/short-viewport dropdown behavior, errors and focus, exact payload/CSRF/idempotency, uncertain retry, server validation, rate limits, account changes and late responses, all four roles, anonymous sign-in, no privileged customer reads, clipboard success/fallback and policy changes. Automated accessibility checks reported no violations in the tested states; this is not a claim of manual screen-reader certification.

Review/receipt screenshots use `booking-form-{width}-{review,receipt}.png` and `*-full.png` in the OS temporary directory. Required widths are 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Existing Service detail captures cover the details form and surrounding page. Fixtures use isolated synthetic records only; actual production components contain no substituted records or simulated success.

Screenshots were inspected against the generated concept, including all review/receipt widths and the final release's 320px receipt and native 1536px review. There was no horizontal page overflow in the tested layouts. The service's public quote path also passed its ten-width regression; its separate redesign milestone remains pending. The final real-API preview returned HTTP 200 with the correct service identity. Documentation links, scoped Prettier and `git diff --check` passed.

## Changed scope

- `app/components/service-detail.tsx`: review, progress, reference, access-aware rendering and existing mutation integration.
- `app/services/[serviceId]/service-detail.css`: summary, progress, reference and receipt styling, subtle form depth.
- Existing `CopyControl` reused without changing its other consumers.
- The three browser suites above updated for the explicit review stage; additional workflow, reference, role, narrow-width and recovery checks added.
- Concept, milestone report and expanded-requirements register documented locally.

Local acceptance does not verify deployed email delivery, storage, payment providers or a configured Maps embed. The workshop landmark remains **beside Kilimanjaro**. Neither this milestone nor its tests establishes completion of the entire expanded frontend objective.
