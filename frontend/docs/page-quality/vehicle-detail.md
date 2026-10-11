# Vehicle detail quality milestone

Route: `/vehicles/[listingId]`  
Date: 30 September 2026  
Status: complete; local acceptance passed. Product detail is the next route.

## Audit and design

The [7 October expanded reassessment](vehicle-detail-expanded.md) adds the current visual, role-visibility and ten-width acceptance evidence. The September findings below retain their original scope.

The baseline was inspected at 390, 768, 1280 and 1440px. On mobile, the original page placed the title, price and request actions after the gallery and the complete specification list. The date input had no visible boundary. Breadcrumbs lacked an ordered list, Home and `aria-current`. Enum values were displayed as raw uppercase strings; available trim/body and additional specifications were omitted. The gallery had no expanded view. Route-specific recovery, related listings and detail structured data were absent.

Three coordinated [ImageGen concepts](vehicle-detail-concepts/README.md) were generated and inspected before implementation: desktop upper page, desktop lower page, mobile and state board. The implementation uses local Nippo display and Quicksand UI fonts, the existing public shell, a navy price/request panel, paired specifications and a compact inspection form. Generated example inventory and altered brand details are not used as production content.

## Source and contract verification

| Purpose           | Actual contract and boundary                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing           | `GET /public/vehicles/{listingId}`; UUID validation; AVAILABLE listing and active branch; parsed response identity must match the route. Metadata and page share the cached read.                                                                          |
| Published photos  | Backend-supplied image URLs through the existing public-media allowlist. No private stock preview is exposed. Missing or failed photos have an honest fallback.                                                                                            |
| Related listings  | `GET /public/vehicles?make=…&limit=3`; exclude the current ID, retain matching makes and show at most two alternatives. Read failure does not discard the primary listing.                                                                                 |
| Customer identity | Optional `GET /auth/session` before an action; anonymous and non-customer accounts receive guidance without attempting the mutation. Server policies remain authoritative.                                                                                 |
| Save              | CSRF-protected `PUT /customers/saved-vehicles/{listingId}` with `{}`. The button reflects a successful save during the current page session; no unchecked persistent favourite state is claimed.                                                           |
| Enquiry           | CSRF-protected `POST /customers/vehicle-transactions` with `vehicleListingId`. A response receipt is required before success. Follow-up links use `/dashboard/vehicle-transactions`.                                                                       |
| Inspection        | CSRF-protected `POST /customers/vehicle-inspections` with listing ID, future ISO `preferredStartAt` and optional trimmed notes, maximum 2,000 characters. The entered wall time is interpreted as Lagos UTC+1. A request does not confirm the appointment. |

The inspection form is part of this route and is included in this milestone. The later inspection/enquiry milestone must record any additional related-route/state requirements rather than treating this form as unfinished work.

No backend routes, models, permissions, payment flows or publication policies were changed. Existing account mutation cancellation, CSRF handling and duplicate in-flight guards are preserved. Network/timeout/server uncertainty never triggers automatic mutation replay; feedback directs the customer to account records first.

## Interaction and state coverage

- Breadcrumbs use real listing titles, semantic ordered navigation, chevron icons, clickable ancestors and a truncatable current item with the complete title available.
- The gallery supports thumbnails, previous/next controls, arrow/Home/End keys, touch navigation, a native modal, Escape, background scroll locking and restored trigger focus.
- Specifications and reports use actual public fields. Missing reports, descriptions and media are explained without invented claims. Zero mileage and condition scores remain valid values.
- The inspection anchor accounts for the sticky header, respects reduced motion and focuses the form heading. Controls are bordered, labelled, compact and associated with their help/error text.
- Confirmation headings receive focus. Values survive recoverable API errors. Account changes clear private drafts and stale results; the account notice receives focus and remains readable on the navy panel.
- Missing listings receive a route-specific unavailable page. Read failures have a retry action using the installed Next.js `retry` API. Primary validation precedes streaming to retain crawler 404/500 responses; related reads stream with their own loading state.
- Breadcrumb and Vehicle/Offer JSON-LD use validated data, exact decimal currency conversion, configured canonical origin and a CSP nonce. Structured data is omitted when indexing is disabled or query parameters mark the page non-indexable.

## Fidelity ledger

| Mismatch or risk                                   | Concept / baseline evidence                                                              | Implemented correction                                                                            | Verification                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Vehicle identity arrives too late on mobile        | Baseline puts title beneath specifications; concept 03 starts with identity/price        | Move heading and mobile price before the gallery                                                  | Seven-width captures and long-title case         |
| Gallery dominates the desktop vertical layout      | First implementation used a tall 4:3 frame beside a shorter summary                      | Use 16:10 desktop frame, retain full-image containment and 4:3 mobile framing                     | Upper-page captures compared with concept 01     |
| Date field has no clear border                     | Baseline input blends into the page; concept 02 uses a framed control                    | Explicit default, hover, focus, invalid and disabled styling                                      | Form captures, keyboard and error-state tests    |
| Raw enums and omitted public detail                | Baseline renders AUTOMATIC/PETROL and omits available trim/body                          | Readable labels and additional supported specifications                                           | DOM assertions and real API read                 |
| Generated brand/content differences                | Concepts include illustrative records, a changed footer logo and incorrect example phone | Preserve actual logo, approved business contacts, 2,000-character contract and API-only inventory | Source review and live page captures             |
| Mis-encoded metadata separators                    | First browser review showed question marks between summary facts                         | Use explicit `&middot;` entities                                                                  | Updated upper-page and related-listing captures  |
| Validation keys do not match API convention        | Error parser retains `body.*` keys                                                       | Use `body.preferredStartAt` / `body.notes`; keep safe field messages                              | 422 response case                                |
| Streaming shell changes crawler status             | Initial route-level loading boundary returned 200 before missing/failing validation      | Validate main record before streaming; independently stream related results                       | Explicit crawler 404, 500 and noindex assertions |
| Session-change notice loses contrast in navy panel | Scoped summary text could override the notice's light-surface colour                     | Restore notice foreground and focus the notice after account changes                              | Account-state accessibility and regression cases |
| Success heading skips a level                      | Upper summary follows the page h1                                                        | Use h2 in summary feedback and h3 beneath the inspection heading                                  | Full axe scan of saved-success state             |
| Mobile modal lets Shift+Tab leave its controls     | Native dialog focus cycling reached browser chrome in the touch-context check            | Add explicit first/last control wrapping while retaining native modal semantics                   | Touch gallery and keyboard focus-trap test       |

## Verification results

| Check                        | Result    | Evidence                                                                                                                                                                                                                               |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detail browser suite         | 18 passed | `vehicle-detail-browser-release.log`; eight widths, axe, gallery, touch, focus trap, action payloads/CSRF, duplicate guard, validation, errors, account changes, missing data, long content, loading, SSR identity and structured data |
| Existing account regressions | 7 passed  | `vehicle-detail-account-regression.log`; completed/late save, enquiry and inspection across accounts; expired-session recovery                                                                                                         |
| Existing SSR/SEO regressions | 2 passed  | `vehicle-detail-seo-final.log`; no-JavaScript detail content/metadata and crawler 404/noindex                                                                                                                                          |
| Unit tests                   | 3 passed  | `vehicle-detail-unit-final.log`; Lagos conversion, invalid/past dates, zero versus absent mileage                                                                                                                                      |
| Lint, type check, formatting | Passed    | Targeted ESLint with zero warnings; TypeScript; Prettier check                                                                                                                                                                         |
| Production build             | Passed    | `vehicle-detail-build-release.log`; webpack compilation, TypeScript, static generation and standalone packaging                                                                                                                        |
| Real API and database        | Passed    | `vehicle-detail-real-final.log`; persisted save, one ENQUIRY, one REQUESTED inspection, correct UTC time, refresh and zero page errors                                                                                                 |
| Production-preview health    | Passed    | `vehicle-detail-health.log`; two real related listings, honest no-photo state, no unexpected failed requests/console/page errors and no overflow                                                                                       |
| Recovery-state accessibility | Passed    | `vehicle-detail-states.log`; zero axe violations for error/unavailable pages at 390 and 1440px; screenshots inspected                                                                                                                  |

The real workflow used only synthetic accounts and records in the isolated `allied_vehicles_qa` PostgreSQL database. The QA PostgreSQL reader was corrected to interpret Prisma's UTC timestamp columns explicitly; application requests and persisted values were already correct. Fixture checks cover controlled loading, unavailable and error states; they do not establish deployed storage or provider delivery.

Verified scope: 360, 390, 430, 768, 1024, 1280, 1440 and native-concept 1536px; short mobile/reduced motion; desktop/mobile gallery; keyboard/focus; field errors; account changes; duplicate submissions; server recovery; no-JavaScript SSR and crawler metadata; real local API persistence.

Command logs listed above are in `C:/Users/PC/.codex/`. Browser captures in `C:/Users/PC/AppData/Local/Temp/` include `vehicle-detail-quality-{width}-{viewport|full}.png`, focused `details` / `inspection` / `related` captures at 390/768/1440/1536px, `vehicle-detail-gallery.png`, `vehicle-detail-mobile-gallery.png`, `vehicle-detail-inspection-success.png` and `vehicle-detail-long-mobile.png`. The Codex directory also contains `vehicle-detail-real-page.png` and `vehicle-detail-{error|missing}-{390|1440}.png`. Upper/lower sections, mobile specifications/form, gallery, confirmation and recovery states were visually inspected against the three concepts.

Reproduction: run the detail suite with `RUN_VEHICLE_DETAIL_TESTS=true`, `VEHICLE_DETAIL_FIXTURE_PORT=5021` and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002`; the standalone preview must use `BACKEND_ORIGIN=http://127.0.0.1:5021`, `SITE_ORIGIN=https://allied.example` and `SITE_INDEXING=enabled`. Run the account regression subset with `RUN_PUBLIC_ACTION_TESTS=true` and `PUBLIC_ACTION_FIXTURE_PORT=5021`. Run the two vehicle SSR/SEO cases with `RUN_SEO_SERVER_TESTS=true` and `SEO_FIXTURE_PORT=5021`. Run these fixture suites sequentially because they bind the same port. Unit validation uses `npm run test -- tests/unit/vehicle-detail.test.ts`; source validation uses the existing lint/typecheck/format tools and `npm run build`.

No remaining local blocker was found for this route. Production photo availability remains source-data dependent; no generated image is inserted into a listing. Design references remain in `vehicle-detail-concepts/`. No production data or deployment was changed.

## Files in this milestone

- `app/vehicles/[listingId]/page.tsx`
- `app/vehicles/[listingId]/vehicle-gallery.tsx`
- `app/vehicles/[listingId]/vehicle-detail.css`
- `app/vehicles/[listingId]/vehicle-state.tsx`
- `app/vehicles/[listingId]/error.tsx`
- `app/vehicles/[listingId]/not-found.tsx`
- `app/components/vehicle-actions.tsx` (used only by this route)
- `lib/vehicle-detail.ts`
- `tests/unit/vehicle-detail.test.ts`
- `tests/e2e/vehicle-detail-quality.spec.ts`
- `tests/e2e/public-account-actions.spec.ts` (vehicle receipt/copy fixtures and configurable isolated server port; existing assertions retained)
- This report, its three concept references and concept README; milestone register.

The overall redesign goal remains active. Product detail is next; no other route was redesigned during this milestone.
