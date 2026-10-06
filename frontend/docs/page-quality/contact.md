# Contact and Customer Care milestone

Route: `/contact`  
Status: complete for the supported configuration, 30 September 2026. The missing-key Maps fallback is verified; live keyed Maps remains an owner configuration check. Later routes are separate milestones.  
Brief: September 30 page-by-page override and breadcrumb/password addendum.

## Audit and design

Before: a large image banner had no enquiry action; contact/location content delayed discovery of the form; text inputs lacked visible borders; branch/source dropdowns were basic; there was no breadcrumb, embedded-map configuration or focused success heading.

Baseline screenshots at 390, 768, 1280 and 1440 pixels were inspected before implementation. Browser plugin not available; the existing Playwright/Microsoft Edge setup is used. Baselines are outside the repository at `C:/Users/PC/.codex/contact-before-*.png`.

Three coordinated concepts define the page: [introduction](contact-concepts/01-introduction.webp), [enquiry](contact-concepts/02-enquiry.webp), [location and guidance](contact-concepts/03-location.webp). Original generated image identifiers: `8ad935ab-5e77-4fbe-83c3-4d27da2be973`, `58d078b9-4d14-474c-b151-2e8ea8e3f5ab`, `9a6c757f-a375-4feb-83e4-abfadad543be`.

Design: white canvas, ink `#01121A`, brand red `#E60301`, accessible focus/link red `#B80201`, control border `#82939F`, rule `#C6D0D7`. Local Nippo display headings and Quicksand interface text. Container maximum 1200px; controls 44px; labels 13px; single restrained form panel. The mobile reading order places the form immediately after the introduction, with process guidance afterward.

Concept corrections before implementation: keep the existing shared header/footer identity and links, use the existing editorial workshop asset, omit invented placeholder identities and business promises, retain the working field label “Your name.” No unrelated header/footer redesign is included.

## Contract audit

| Endpoint                                         | Use and constraints                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `GET /auth/session`                              | Existing optional public-header session check; anonymous access remains supported                       |
| `GET /public/branches?limit=20&cursor=…`         | Active branch choices; real cursor pagination; search explicitly covers only the loaded page            |
| `GET /public/catalog/products?limit=20&cursor=…` | Product choices for product enquiries                                                                   |
| `GET /public/services?limit=20&cursor=…`         | Service choices for service enquiries                                                                   |
| `GET /public/vehicles?limit=20&cursor=…`         | Vehicle listing choices; selected listing determines handling branch                                    |
| `POST /public/support/enquiries`                 | Public discriminated union: GENERAL, PRODUCT, SERVICE or VEHICLE; only the matching resource ID is sent |
| `POST /public/support/complaints`                | Public contact details, subject and description; no authenticated transaction IDs                       |

Backend schema: name 1–120 characters, email up to 254 characters, optional phone 7–32 characters with permitted phone syntax, subject 1–160, message/description 1–4000; related IDs and optional branch ID are UUIDs. The service layer requires an active handling branch or derives it from the selected vehicle listing. Public submissions require a trusted origin and apply enquiry/complaint rate limits. They do not use authenticated customer CSRF. The success result must contain a valid ID, OPEN status and creation timestamp before the UI confirms receipt.

Existing review-before-submit behavior, session-change cleanup and uncertain-outcome locks remain intact. No attachment, preferred-contact, consent or arbitrary transaction field was added to unsupported public payloads. Booking/order/quotation questions can use general message text or the existing signed-in customer-care workflow.

## Interactions and states

- Hero links move focus and scroll to the enquiry introduction or direct contact section, respect reduced motion and account for sticky navigation.
- Home / Contact breadcrumb uses an ordered list, Lucide chevron, linked parent and `aria-current`.
- Phone, WhatsApp, email, Maps search and directions use the supplied business information.
- Enquiry/Complaint is a two-choice radio group. Short enquiry types retain native keyboard/touch behavior with a styled bordered trigger and chevron.
- Branch and related-record comboboxes provide current-page search, selected indicators, keyboard navigation, Escape, viewport-aware placement, internal scrolling, loading, retry and no-match/empty states.
- Compact related fields share desktop rows and stack on narrow screens. Inputs expose invalid state and linked messages; backend field errors map to safe field feedback.
- Submission review preserves values, prevents duplicate writes and exposes a stable busy state. Confirmed receipt focuses the success heading and offers WhatsApp. Unknown outcomes remain locked rather than retrying a potentially completed write.

## Maps configuration and verification

**Missing configuration: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.** The owner confirmed that a key is not yet available. The empty variable is in `frontend/.env.example`; no real key was written or logged.

The exact-address query was opened in Google Maps and visually inspected. It resolves to an Allied AutoTech listing at 133 Stadium Road. Google displays “beside Pizza Jungle”; the owner confirmed Pizza Jungle is within Kilimanjaro and that the website must retain **“beside Kilimanjaro.”** No coordinates or Place ID were guessed or adopted.

Without a key, the page shows a stable location panel with the supplied address and working external Maps/directions links. With a key, it uses place-mode Maps Embed API, an encoded address, lazy loading, a descriptive title, fullscreen permission and `strict-origin-when-cross-origin`. No Google JavaScript, Places or Geocoding API is needed.

Owner setup:

1. Create or select a Google Cloud project and configure billing as required by Maps Platform.
2. Enable the Maps Embed API only for this page.
3. Create a browser key restricted to the Maps Embed API and authorized HTTP referrers.
4. Include the actual local origin (`http://localhost:3000/*` currently) and the exact approved staging/production origins. Add `https://staging.alliedautotech.com/*`, `https://alliedautotech.com/*` and `https://www.alliedautotech.com/*` only if those environments are actually deployed. Avoid broad wildcard preview-domain access.
5. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in local frontend environment configuration, Vercel staging and Vercel production as applicable. Do not commit its value.
6. Rebuild/redeploy and verify the embed and referrer restrictions in each environment. Confirm the marker before release; correct the query with an owner-verified Place ID if needed.

Sources: [Google embedding guide](https://developers.google.com/maps/documentation/embed/embedding-map), [Google API key setup](https://developers.google.com/maps/documentation/embed/get-api-key). The real keyed iframe cannot be verified until configuration is supplied; the missing-key fallback is an explicitly supported state in the brief.

## Acceptance evidence

Verified: required 360, 390, 430, 768, 1024, 1280 and 1440 widths; keyboard/focus and reduced motion; branch/source states; exact enquiry and complaint payloads; success, backend validation, rate-limit, server and network failures; shared-component smoke checks; real API/database submission; lint, type checking, tests and build.

The initial browser run passed 13 of 16 cases. Two test locators incorrectly retained the pre-submit button name after it changed to “Submitting…”; their pending-state assertions were corrected. One test was interrupted by development hot reload during editing. Subsequent verification used the production build; final results are recorded below.

Further acceptance work: the production build and its TypeScript check passed; 38 targeted API-client, mutation-review and feedback unit tests passed with one worker. The expanded browser suite caught a 768px map overflow caused by the interaction between aspect ratio and minimum height; an explicit container width corrected it and all 18 Contact cases then passed. The first real-API attempt used a build whose rewrite still targeted port 5000, so it stopped before any submission; the connected acceptance build sets `BACKEND_ORIGIN` to the isolated API at build time as well as runtime.

Connected integration: both public submissions returned HTTP 202 through the actual frontend proxy and backend. The disposable `allied_contact_20260930_test` database contained exactly one OPEN enquiry, one OPEN complaint and two CREATE audit records for the run. The browser reported no page errors. Email/SMS delivery was disabled for this isolated environment. A real quotation-required service read also verified that the default shared enquiry form retains its native branch selector, service-bound review, cancellation and draft preservation.

The first combined Contact/support regression run passed 58 of 64 cases. Three failures were outdated selectors for the new inline error/option markup. Three exposed a pointer-focus issue: the shared support controls could scroll the branch input before pointer release, cancelling its opening click. The Contact picker now opens on focus, and a dedicated regression recreates this condition. Screenshot inspection also identified missing inner spacing in the success notice; it now uses 24px padding. A prior validation toast could outlive a successful submission; Contact now uses its inline error summary without emitting that redundant persistent toast. The subsequent combined run passed all 68 cases (22 Contact and 46 support). After the final Contact-only toast correction, the build passed again and both desktop/mobile validation-to-receipt cases passed on that exact artifact. Fresh real-backend submissions also passed, including explicit branch and matching audit-record checks.

### Final verification record

| Gate                       | Result and evidence                                                                                                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build and types | `npm run build` including TypeScript and standalone preparation passed on the final source. `npm run typecheck` also passed during the gate. Log: `C:/Users/PC/.codex/contact-build-complete.log`.                                                                                                               |
| Lint and formatting        | Targeted ESLint with zero warnings, Prettier and `git diff --check` passed for the Contact-owned files.                                                                                                                                                                                                          |
| Unit behavior              | 38 tests passed across API client, mutation review and feedback with `--maxWorkers=1`; log: `contact-unit-recheck.log`.                                                                                                                                                                                          |
| Browser suite              | 68/68 passed with `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/contact-quality.spec.ts tests/e2e/support.spec.ts --workers=1`; log: `contact-final-tests.log`.                                                                                                                       |
| Latest receipt states      | 2/2 passed after the final toast-only change, including exact payload, busy/duplicate protection, invalid-to-success transition, focus, spacing, mobile overflow and axe; log: `contact-receipt-tests.log`.                                                                                                      |
| Real integration           | Final enquiry and complaint each returned 202 and persisted once for their unique QA run identity, with the correct branch and exactly two matching audit events. No browser page errors; log: `contact-real-api-final.log`.                                                                                     |
| Shared form                | Real quotation-required service read, original branch selector, service-bound review/cancel and retained draft passed; log: `contact-service-smoke.log`. Other shared support flows are covered by the 46-case regression suite.                                                                                 |
| Page and console health    | Correct Contact URL/title, meaningful content, no framework overlay, loaded workshop image, no hydration/runtime errors. Anonymous session discovery returns the expected 401. Observed cancelled link-prefetch requests were `net::ERR_ABORTED` with `next-router-prefetch: 1`, not failed Contact submissions. |
| Keyboard and touch         | Form validation focus, selection, Escape, cursor navigation, short-viewport touch scrolling, review/cancel, success focus, reduced motion, FAQ disclosures and Visit anchor passed. Mobile Quick help resolves the approved address and restores trigger focus on Escape.                                        |
| Visual evidence            | All seven required widths captured; concepts and rendered sections inspected, including native concept dimensions, fixed tablet map and final padded desktop/mobile receipts without stale toasts.                                                                                                               |

Browser environment: local standalone production server at `http://localhost:3001`, Microsoft Edge through the existing Playwright workflow. Browser plugin not available. The local API runs at port 5012 against the disposable test database; no production records or external email/SMS messages were created. The build must receive the intended `BACKEND_ORIGIN`, because rewrites are compiled at build time.

Evidence is outside the repository: `C:/Users/PC/.codex/contact-*.log`, `contact-native-*.png`, `contact-real-*.png`; viewport/form/location and final receipt screenshots are under the Windows temporary directory as `contact-quality-*.png`. Browser tests use isolated fixtures for controlled failures; the separate real integration check uses the actual API and database. The 68-case run preceded the final removal of Contact's redundant validation toast; the two receipt reruns and real submissions verified that last change. These are scoped results, not a claim of a single final run of every repository test.

Remaining configuration and test limits: the owner has no Maps key or verified Place ID yet. The live keyed iframe must be checked after configuration; the supported fallback and external links are verified. Deployment must supply its real active handling branch and verify email/provider delivery separately. Mobile checks use browser touch/viewport emulation, including a short viewport; physical-device keyboards and other browser engines were not tested in this milestone.

### Concept comparison ledger

All three retained concepts and the rendered introduction, enquiry form, location, mobile layout and success states were inspected at native screenshot resolution with `view_image` during this acceptance pass. Additional comparison captures use the concept dimensions: 1774×887 for the introduction and 1505×1045/1046 for the enquiry/location sections. The actual Visit action was exercised before the location capture to verify heading focus and sticky-header clearance. Screenshots were also inspected across all seven required viewport widths.

| Comparison                  | Rendered result and decision                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero copy and hierarchy     | The heading, explanation and two action labels follow the introduction concept. The compact split layout exposes the next section in the desktop first viewport.                                                                               |
| Typography                  | Actual local Nippo and Quicksand replace the concept generator's approximations. Display headings stay distinct from compact interface text.                                                                                                   |
| Palette and controls        | White, ink and purposeful red follow the concept. Control borders use the stronger audited token; accessible red is used for smaller links and focus.                                                                                          |
| Imagery and shared identity | The existing workshop editorial image and shared brand/header/footer are intentional pre-implementation corrections. The generated concept's logo, identities and footer links are not business data.                                          |
| Form structure              | One restrained panel, two-choice contact reason, related desktop field pairs, full-width subject/message, character count and review action follow the form concept. Mobile puts the form before the process guidance.                         |
| Field copy and process      | Existing “Your name” and backend-compatible terminology are retained; fabricated example identities and response promises are omitted. Process guidance describes the actual review-before-send flow.                                          |
| Location and FAQ            | Exact approved address, framed fallback, working map/directions/phone paths and three disclosure questions follow the location concept. The existing Lucide outline family and compact secondary-button style remain consistent with the page. |
| Responsive repairs          | Email and address receive full-width mobile rows; the WhatsApp arrow no longer wraps to an isolated line. The tablet map overflow found by acceptance testing has a targeted width repair verified in the final connected run.                 |

The concept's extra red emphasis in the FAQ heading is omitted so the location heading and actionable links retain priority. No new above-the-fold marketing claims were added. The Contact reason legend is explicit for accessible form navigation. The map remains a location panel until the owner supplies the key; no simulated map is presented.

No password input exists on Contact, so the password-visibility requirement is not applicable to this route. It remains required in later per-route milestones.

## Files owned by this milestone

- `app/contact/page.tsx`, `contact.css`, `contact-anchor.tsx`, `contact-record-picker.tsx`
- `app/components/public-enquiry-form.tsx`, `support-create-form.tsx` (Contact-only presentation option; defaults preserved)
- `app/components/mutation-review.tsx` (busy accessibility state)
- `.env.example`
- `tests/e2e/contact-quality.spec.ts`, `tests/e2e/support.spec.ts`
- This report and its three concept images

Concurrent backend/customer-directory edits are outside this milestone and must be preserved.
