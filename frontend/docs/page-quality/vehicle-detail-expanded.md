# Vehicle detail — expanded brief

Route: `/vehicles/[listingId]`. Date: 7 October 2026. Status: complete; expanded local acceptance gate passed. This extends the [September assessment](vehicle-detail.md). Product detail `/parts/[productId]` is next. Customer dashboard workflows and deployment retain separate gates.

## Audit and contracts

Services listing passed its expanded gate before this reassessment. Fresh baseline screenshots at 390, 768, 1280 and 1440px used the production preview and isolated real API. The page had no horizontal overflow, but the predominantly white composition lacked depth, mobile repeated the price, and customer mutation controls appeared for anonymous and work accounts until an attempted action was rejected.

Reviewed the existing server page, public detail parser/cache, gallery, account mutation hook, form drafts, backend vehicle-sales routes, current OpenAPI contracts and installed Next.js server/client and Image guidance. Backend authorization remains authoritative.

- `GET /public/vehicles/{listingId}` supplies an available listing from an active branch. The requested identity must match the response. Missing records return 404/noindex; malformed or unavailable data cannot become a published vehicle.
- Related inventory uses the existing public make filter, excludes the current listing and displays at most two returned alternatives. Its failure does not replace the primary detail with an error.
- Optional `/auth/session` reads determine customer access. Every mutation still performs a fresh session preflight; CSRF, payload validation and server role checks remain in place.
- `PUT /customers/saved-vehicles/{listingId}` saves the listing. `POST /customers/vehicle-transactions` creates an `ENQUIRY`. `POST /customers/vehicle-inspections` creates a `REQUESTED` inspection using the preferred future instant and optional notes.
- An inspection request is not an appointment confirmation. Lagos denotes UTC+1; the workshop remains in Port Harcourt. Notes retain the 2,000-character limit. Creation responses require a valid receipt ID.
- In-flight duplicate protection, abort handling and account-change private-state clearing remain intact. The create endpoints do not offer idempotency keys; uncertain responses are not automatically replayed.

No new mandatory backend gap, endpoint, schema, dependency or production media asset was required. The account-visibility correction belongs to the frontend. Existing deployed media verification remains in [the backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).

## Design and implementation

Three readable [ImageGen concepts](vehicle-detail-oct-concepts/README.md) preceded source changes: gallery/overview, specifications/inspection, and mobile/account states. Generated inventory, altered branding, phone numbers and the incorrect Lagos workshop location were rejected in favor of actual data and approved business information.

The page now combines a cool-grey canvas, white framed gallery and specification panel, and a restrained navy request summary. A compact Nippo heading and semantic section links establish the hierarchy. Body type, trim and report publication status come directly from the listing. Publication is not a verification guarantee.

The desktop summary stays beside the gallery and specifications, with bounded scrolling when necessary. Short viewports use normal flow. Mobile retains title and price before the gallery, removes the duplicate summary price, and keeps request access before the specifications. Existing Help/WhatsApp controls remain available.

Anonymous visitors receive a sign-in path; Staff, Admin and Super Admin receive a dashboard path. Customer save, enquiry and inspection controls are hidden during checking, for work accounts and when access cannot be established. A failed account check offers retry. Contact links remain usable. Successful customer actions retain focused receipts and account destinations.

The inspection panel uses visible Login-derived borders, a red focus treatment and restrained shadow. The working gallery retains full-image containment, horizontal thumbnails, keyboard selection, touch navigation, modal focus trapping and focus restoration. Related vehicles use a compact automotive fallback when real media is absent. No fabricated inventory photograph, video or 3D dependency was introduced. This page contains no password field.

Production changes: [vehicle-actions.tsx](../../app/components/vehicle-actions.tsx), [page.tsx](../../app/vehicles/[listingId]/page.tsx) and [vehicle-detail.css](../../app/vehicles/[listingId]/vehicle-detail.css). Regression coverage: [vehicle-detail-quality.spec.ts](../../tests/e2e/vehicle-detail-quality.spec.ts).

## Fidelity review

| Baseline or concept discrepancy                                         | Correction or accepted boundary                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Predominantly white content has little visual separation                | Grey canvas, white framed content and navy summary establish distinct reading and action areas. |
| Large heading competes with the vehicle                                 | Limit the desktop heading to 36px while retaining actual Nippo and Quicksand.                   |
| Summary stops beside only the gallery                                   | Place details in the same desktop grid and bound the sticky summary to the usable viewport.     |
| Mobile repeats the price above and below the gallery                    | Keep the leading price and hide the duplicate summary price below 900px.                        |
| Customer controls appear for accounts that cannot use them              | Resolve access before showing mutations; provide sign-in, dashboard and retry states.           |
| Gallery lacks an immediate factual overview                             | Add actual body type, trim and report-publication facts below the image area.                   |
| Concept uses a vertical thumbnail rail and invented listing photos      | Preserve the working horizontal gallery and real-media/fallback behavior.                       |
| Concept places description and report in two narrow columns             | Use successive sections in the main column so long content remains readable beside the summary. |
| Concept invents a Lagos location, phone number and condition claims     | Retain Port Harcourt, approved contact details and only the published backend report.           |
| A second mobile sticky bar would compete with existing contact controls | Keep requests in document flow and retain the shared Help/WhatsApp bar.                         |

Native-size desktop and mobile captures were compared with the concepts, including the sticky specifications/report view, inspection panel, related vehicle row, settled anonymous access and tablet layout. Generated rounded lettering does not replace the supplied Nippo face.

## Verification

Environment: production standalone preview at `http://localhost:3001`, isolated API on 5012 and PostgreSQL on 55439 (`allied_vehicles_qa`). Controlled browser fixtures used a separate preview on 3002 and fixture API on 5021. Browser plugin not available; repository Playwright with installed Microsoft Edge provided browser verification. Synthetic fixture records and photos are test inputs, not production inventory.

| Check                    | Result                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build         | Compilation, TypeScript, 70 route entries and standalone packaging passed; `vehicle-detail-oct-build.log`.                                                                                                                                            |
| Code quality             | Full frontend lint passed; targeted ESLint passed again after the final navigation test. Scoped formatting and diff checks recorded with this handoff.                                                                                                |
| Unit tests               | Three vehicle-detail validation/time tests passed.                                                                                                                                                                                                    |
| Detail browser tests     | 25 scenarios passed together; the subsequently added section-navigation/sticky-summary scenario passed separately. Total: 26 distinct scenarios, with no production change between runs.                                                              |
| Account isolation        | Seven regressions passed: completed and late save/enquiry/inspection results across accounts, plus expired-session recovery.                                                                                                                          |
| Crawler behavior         | Two focused SEO tests passed: meaningful vehicle content without JavaScript and missing vehicle 404/noindex.                                                                                                                                          |
| Responsive/accessibility | All ten widths passed: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Checks cover overflow, whole-page Axe, readable breadcrumbs, controls, long content, modal and short touch viewport.                                                |
| Access and recovery      | Customer, anonymous, Staff, Admin, Super Admin, delayed account check, failed check/retry and changed-role preflight passed. Unsupported actions remain hidden and emit no mutation.                                                                  |
| Transactions             | CSRF payloads, busy/duplicate handling, future date/notes validation, focused receipts, 422/429/offline/uncertain outcomes and account changes passed.                                                                                                |
| Real API/database        | A synthetic customer completed one persisted saved vehicle, one `ENQUIRY` and one `REQUESTED` inspection. A 10:30 Lagos preference persisted as 09:30Z; refresh retained the request. No page errors.                                                 |
| Page health              | Expected title `Toyota Camry - QA 1 · Allied AutoTech`, visible heading, HTTP 200, no framework overlay, unexpected console/page errors, failed responses, horizontal overflow or broken rendered images. Expected anonymous-session 401 is excluded. |

Interaction loops: section link → matching specifications → usable sticky enquiry controls; gallery thumbnail/keyboard/swipe → selected photo → expanded modal → Escape and restored focus; customer save/enquiry/inspection → actual API receipt → persisted database row; session change → cleared private state with late responses ignored.

Key commands: `npm run build`; `npm run lint`; `npx vitest run tests/unit/vehicle-detail.test.ts --maxWorkers=1`; `npx playwright test tests/e2e/vehicle-detail-quality.spec.ts` with the isolated fixture environment; the focused navigation supplement; `public-account-actions.spec.ts` filtered to vehicle enquiry/saved vehicle/inspection; `seo.spec.ts` filtered to vehicle no-JavaScript and crawler-404 cases; targeted ESLint; scoped Prettier; `git diff --check`.

Local evidence lives outside the repository under `C:/Users/PC/.codex/`: `vehicle-detail-oct-{build,lint,browser,navigation,accounts,seo,real}.log`, `vehicle-detail-oct-health.json` and `vehicle-detail-oct-{before,after}-{390,768,1280,1440}-{viewport,full}.png`. Additional fixture captures are under the operating-system temporary directory: `vehicle-detail-quality-{width}-{viewport,full}.png`, selected details/inspection/related captures and `vehicle-detail-oct-sticky.png`. These paths identify local artifacts, not published deployment evidence.

## Boundaries and next route

All writes used isolated QA records; providers were disabled and no external messages were sent. The real listing had no attached photos or published report, so fixture cases supplied those states. Local automated Axe and keyboard checks do not constitute a manual screen-reader audit. Safari, Firefox, deployed object storage and production delivery remain unverified. No new backend implementation is required by this milestone.

Next: reassess Product detail `/parts/[productId]` under the expanded brief. This gate does not certify later customer vehicle dashboards, appointment administration, checkout or the entire application.
