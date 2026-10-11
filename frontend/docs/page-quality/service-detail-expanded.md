# Service detail — expanded brief

Route: `/services/[serviceId]`. Date: 7 October 2026. Status: complete; expanded local acceptance gate passed. This extends the [September assessment](service-detail.md) and preserves the separately completed [Booking creation workflow](booking-form.md). Formal quotation and customer dashboard workflows remain separate milestones.

## Audit and scope

Fresh baseline captures at 390, 768, 1280 and 1440px showed a working service/booking route without overflow or page errors. Its predominantly white overview, large heading, sparse supporting context and lack of section navigation made the detail feel less substantial than the expanded brief requires.

Reviewed the server loader and metadata, service component, scoped styles, public service schema and list contract, booking policy/availability, session handling and public enquiry integration. The existing guided request flow already had review, idempotency, account recovery and verified receipts; these remain intact. The installed Next.js guidance informed the server-rendered supporting content and isolated client interactions.

Everyone may browse public service details. Anonymous visitors can prepare and review a booking before signing in; only a customer may submit it. Work accounts receive dashboard/contact guidance instead of customer booking controls. A fresh session preflight and backend authorization remain required for writes. Public service enquiries retain their existing anonymous contract.

## Design and behavior

Three [ImageGen concepts](service-detail-oct-concepts/README.md) were generated and inspected before implementation: overview/request, care/FAQ, and mobile/alternate states. Actual Nippo, Quicksand, approved contact details, existing navigation and API records supersede generated examples.

- A compact ink overview separates the service identity, exact fixed price or quotation requirement, listed duration and published image. Missing media and unavailable duration have explicit text. A duration is not a promised collection time.
- Semantic section links lead to overview, description, request, FAQ and other services. Targets and focused links account for the sticky header. All content stays rendered rather than being hidden in simulated tabs.
- The existing Details → Review → Received booking panel retains its visible input boundaries, restrained shadow, branch/slot choices, saved customer data, review editing and actual policy. Mobile retains form-before-context ordering.
- Preparation guidance asks when the concern occurs, what warning lights or changes the customer has noticed, and relevant service history. It does not diagnose a fault or invent service-specific inclusions.
- An authentic workshop campaign image accompanies three approved principles: understand the concern, discuss the work and keep the customer informed. The image file and technician identity are preserved; responsive CSS controls its crop.
- Three native FAQ disclosures explain published service scope, request/enquiry outcomes and duration. Fixed-price and quotation-required services receive different outcome wording.
- Other services use one bounded public list request, exclude the current record and show at most two results. Published identity, price, duration and media remain authoritative. Loading, empty and unavailable states preserve access to the primary service and request form.

No backend change, new production image, dependency, password field, video or 3D feature was needed. The backend has no separate symptoms, inclusions or service-category relationship fields. The page therefore uses its published description and labels the supporting list “other services,” without claiming recommendations or category matches.

## Contracts preserved

Paths omit `/api/v1`.

| Contract                                   | Verified use                                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /public/services/{serviceId}`         | Valid UUID and matching returned identity before streaming; actual title, description, pricing, duration and public media. Metadata and rendering share the cached read.      |
| `GET /public/services?limit=3`             | New supporting read through the existing contract; remove the current ID, show at most two records, recover independently on failure.                                         |
| `GET /public/booking-policy`               | Existing policy version, advance window, rescheduling and deposit rules. Current policy requires no deposit; unavailable policy blocks submission.                            |
| Public branches and service slots          | Existing bounded cursor pagination and searchable current-page choices; validate service/branch/interval identity and display Lagos time.                                     |
| Session, customer profile and garage reads | Optional access check and customer-only saved details; account changes clear private selections and receipts.                                                                 |
| `POST /customers/bookings`                 | Existing customer preflight, CSRF, idempotency key, selected slot, policy version, optional owned vehicle and normalized notes. `REQUESTED` means awaiting workshop review.   |
| `POST /public/support/enquiries`           | Existing `SERVICE` enquiry, handling branch, service identity, contact fields, subject, required message, review and verified receipt. It does not create a formal quotation. |

Main-record 404/noindex behavior, safe unavailable states, Service/BreadcrumbList structured data and canonical-origin policy remain in place. Uncertain booking retries retain their original payload/key; pending or uncertain public enquiries remain locked through service remounts.

## Fidelity ledger

| Mismatch or comparison                                                   | Concept/browser evidence and final treatment                                                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| White baseline and oversized heading                                     | Concept 01 and final desktop/mobile captures: compact ink introduction with a 36px maximum Nippo heading and separate price/duration hierarchy.                                    |
| Generated header, logo, opening hours and background                     | Concept 01 differs from the real shell. Retain authentic navigation/wordmark and omit unapproved hours; a solid ink surface keeps contrast predictable.                            |
| Generated alternate appointment fields                                   | Concepts 01/02 suggest different selectors. Final appointment/review captures preserve the existing branch/slot contract and completed guided workflow.                            |
| Sparse context                                                           | Concept 02 and final context/care captures: practical preparation prompts, authentic campaign media and three readable workshop principles.                                        |
| Generated technician and eight sample services                           | Final care/other-service captures use the supplied campaign and at most two actual API records. Fixture photos are test data, not live catalogue claims.                           |
| Inconsistent white mobile concept hero                                   | Concept 03 and final 390px capture: retain concept 01's ink treatment across sizes, with wrapping navigation and form-first mobile order.                                          |
| Generated quotation wording and invented reference                       | Final enquiry/receipt captures use “Send an enquiry,” a required message and the real returned reference; no formal quotation or appointment confirmation is implied.              |
| Sticky header intersects a partially scrolled navigation link during Axe | Final links have scroll margin; focused-link center-point hit testing passes after scrolling. Whole-document Axe runs at a stable top position with no rule or element exclusions. |
| Sticky header appeared inside an early section screenshot                | Final section captures position content below the header and use sufficient viewport height; inspected care/FAQ/other-service artifacts are unobscured.                            |

Final visual inspection covered the native desktop overview, mobile overview/enquiry, real-API tablet, care, FAQ and other-service sections alongside all three concepts. Intentional data and shell differences are recorded above.

## Verification evidence

Production standalone preview: `http://localhost:3001`; isolated API: 5012; PostgreSQL: 55439, database `allied_vehicles_qa`. Browser fixtures use preview 3002 and API 5021. Repository Playwright with installed Microsoft Edge is the browser fallback.

| Gate                          | Result                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production build              | Compilation, TypeScript and standalone packaging passed; `service-detail-oct-build-final.log`.                                                                                                                                                                                       |
| Code quality                  | Full frontend lint passed; final targeted ESLint, scoped formatting and diff checks passed.                                                                                                                                                                                          |
| Service/booking browser suite | 60 passed against the final build: section navigation, focused-link hit testing, FAQ keyboard behavior, bounded supporting reads, independent recovery, role states, booking/enquiry review and receipts, availability/policy failures, uncertain outcomes, pagination and metadata. |
| Account isolation             | Seven passed: completed/late booking results, expired session, same-session idempotency, recovery after failed public refresh, and pending/uncertain quotation-enquiry locks.                                                                                                        |
| Server rendering              | Two passed: service content without JavaScript and missing service HTTP 404/noindex.                                                                                                                                                                                                 |
| Responsive/accessibility      | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px; layout, overflow, keyboard, whole-document Axe and booking/quotation states passed.                                                                                                                                       |
| Real API/database             | One persisted `REQUESTED` booking with owned saved vehicle, normalized notes, no deposit and matching receipt; one anonymous `SERVICE` enquiry persisted as `OPEN`. Review caused no premature write; refresh verified the booking.                                                  |
| Real page health              | HTTP 200, correct title/heading, bounded other-service identities matching the live QA list, no unexpected console/page errors, failed responses, overflow, broken rendered images or framework overlay. Expected anonymous session 401 is excluded.                                 |

The initial 60-case run passed 58 cases; two Axe target-size findings involved static navigation partially obscured by the sticky header at arbitrary scan scroll positions. After adding focus scroll margin and stabilizing scan position, all 60 passed without disabling any Axe rules or excluding content. Focus usability is checked separately through actual focus and pointer hit testing.

An initial standalone health script incorrectly expected the sign-in link before review. The existing anonymous workflow shows it after review; the script was corrected to assert the initial Review control. No application behavior was changed for that assertion.

All writes used synthetic isolated QA accounts/records with external providers disabled. No production data or external messages were involved. Local API acceptance does not establish deployed storage, notification delivery, workshop approval or production readiness.

Commands: `npm run build`; `npm run lint`; targeted ESLint; scoped Prettier; `npx playwright test tests/e2e/service-detail-quality.spec.ts`; focused account and SEO regressions; real API/database and page-health harnesses; `git diff --check`. No implementation-mirroring unit tests were added.

Local artifacts live outside the repository under `C:/Users/PC/.codex/`: `service-detail-oct-build-final.log`, `service-detail-oct-lint.log`, `service-detail-oct-browser-final.log`, `service-detail-oct-accounts.log`, `service-detail-oct-seo.log`, `service-detail-oct-real.log`, `service-detail-oct-health.json`, and `service-detail-oct-{before,after}-{width}-{viewport,full}.png`. Native fixture captures live in the OS temporary directory as `service-detail-{width}-*.png` and `service-detail-oct-{width}-{care,questions,more}.png`.

## Files and next scope

Production changes: `app/components/service-detail.tsx`, `app/services/[serviceId]/page.tsx` and `app/services/[serviceId]/service-detail.css`. Regression changes: `tests/e2e/service-detail-quality.spec.ts`. The concept references, this report, historical report link, coverage register and root backend handoff record the milestone.

The updated goal additionally prioritizes Customer Care, Reviews, About and Help, including working logic and security. Next assess Customer Care/Contact, then those related public pages one at a time before returning to the separate Quotation and remaining application gates. Their completion and security must be established by their own evidence. Maps configuration remains pending; the approved address is beside Kilimanjaro.
