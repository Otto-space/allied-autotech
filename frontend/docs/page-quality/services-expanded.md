# Services listing — expanded brief

Route: `/services`. Date: 7 October 2026. Status: complete; expanded local acceptance gate passed. This extends the [September listing assessment](services.md). Service detail, quotation, account operations and deployment retain separate gates.

## Evidence and scope

Shop passed its expanded gate before work started.

Fresh baseline screenshots at 390, 768, 1280 and 1440px used the production preview and isolated real API. All displayed 12 services without overflow or page errors. The page worked, but the white hero and catalogue had little surface contrast, sparse wrench rows omitted duration, and supporting content lacked care principles and practical booking guidance.

Reviewed the actual server page/seed, catalogue, discovery query normalizer, parser, managed service photo, backend list repository/schema, existing service detail and booking behavior, Login-derived form styling, approved business content and installed Next.js server/client and Image documentation. Existing source and working contracts remain authoritative.

`GET /public/services` supports pricing type, UUID cursor and bounded limit only. It returns active services in ID order and exposes names, descriptions, pricing, listed duration and optional managed imagery. The current UI requests 12 records; its count refers to this page, not the entire catalogue. No search, categories, featured flags, appointment availability, sort or global totals are invented. No new backend endpoint, mutation, dependency or media asset is needed. Native radio controls remain appropriate for three pricing choices.

## Design and implementation

Three readable [ImageGen references](services-oct-concepts/README.md) preceded source edits and cover the introduction/catalogue, lower editorial sections and mobile/recovery states. Their sample data and generated branding are not production content.

- Compact 250px ink introduction with the approved workshop image, actual Nippo/Quicksand and a 40px maximum desktop title. Mobile preserves copy order and a separate 128px photograph.
- Cool-grey catalogue canvas, white discovery panel and visible 44px pricing controls. The final desktop panel places heading/count beside the choices; tablet/mobile stack them. Selection, clear/reset, keyboard behavior, URL history/reload and cursor recovery are retained.
- Horizontal service rows remain distinct from Shop and Vehicles. Real images occupy a defined thumbnail area; missing media has a neutral labelled fallback. The title, short-description preference, pricing type and listed duration provide a readable service identity.
- Duration includes singular/plural handling; absent or non-positive values display “Duration not listed.” A catalogue duration is not a guaranteed collection time. Fixed prices retain exact integer-kobo formatting, including zero; quotation services show the quotation label without fabricating an amount.
- Each row links to the actual service detail. Neutral supporting copy asks visitors to review details or discuss scope. The listing does not initiate booking or expose role-specific mutations. Retry is disabled while a request is pending.
- Approved care principles accompany the existing parts editorial asset: honesty, quality before speed and authentic parts. The About link provides the fuller company story.
- The approved six-step journey now sits on a contrasting surface. Three native FAQ disclosures explain pricing, workshop review of booking requests and useful vehicle/concern information. Their content derives from current flows; no response-time guarantee or automated diagnosis is offered.
- Contact and WhatsApp retain their verified destinations. Restrained hover/arrow/disclosure motion respects reduced motion. There is no available workshop video or useful 3D task warranting a new player or heavy dependency.

Production files: [page.tsx](../../app/services/page.tsx), [services-catalogue.tsx](../../app/components/services-catalogue.tsx) and [services.css](../../app/services/services.css). Homepage service rendering, shared media components, authentication, backend code and API contracts are unchanged by this milestone. This listing has no password field.

## Fidelity review

| Baseline or concept discrepancy                                                    | Correction / accepted boundary                                                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Large title and pale hero compete with discovery                                   | Reduce the desktop heading to 40px and use the compact ink/workshop composition.                                                         |
| Flat white filter/list surface                                                     | Grey catalogue canvas, restrained panel shadow, white list with fine row dividers.                                                       |
| First revision leaves empty desktop filter-panel space                             | Place heading/count and pricing choices side by side at 1024px and above; retain stacked smaller layouts.                                |
| Basic icon rows omit useful service information                                    | Defined media/fallback area, description hierarchy, actual duration and separate pricing/action area.                                    |
| Narrow screens need readable service identity                                      | 80px thumbnail beside copy, with price and detail action across the row below; long content can wrap.                                    |
| Original lower sections lack trust and booking context                             | Approved principles with editorial parts imagery, contrasting six-step journey and native FAQ disclosures.                               |
| Concepts invent service scope, photos, slogans and guarantees                      | Use real API content and approved assets/copy; no “free inspection,” image-coming-soon promise, invented categories or new uniform/logo. |
| Generated mobile radio and large fallback geometry conflicts with working controls | Preserve native bordered radio segments and compact honest fallback; actual fonts and shell remain authoritative.                        |

## Verification

Environment: production standalone at `http://localhost:3001`, isolated API on 5012 and PostgreSQL on 55439 (`allied_vehicles_qa`). Browser plugin was absent; repository Playwright with installed Microsoft Edge was used. Browser state fixtures are separate from the read-only real API/database audit. No production writes or external messages were sent.

| Check                        | Final result                                                                                                                                                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build             | Passed compilation, TypeScript, 70 route entries and standalone packaging; `services-oct-build-final.log`.                                                                                                                                                                 |
| Code quality                 | Full frontend lint passed; targeted ESLint repeated after the test fixture refinement. Scoped Prettier and diff checks passed.                                                                                                                                             |
| Unit tests                   | Three service-discovery query tests passed.                                                                                                                                                                                                                                |
| Browser regression           | All 19 scenarios passed against the final production build; `services-oct-browser-final.log`.                                                                                                                                                                              |
| Responsive and accessibility | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px passed no-overflow, control-height and whole-page Axe checks. Open FAQ, long content and short touch viewport also passed.                                                                                       |
| Interaction                  | Pricing radios by keyboard/touch, URL Back/Forward/reload, next/previous/reset, invalid/raw-cursor recovery, loading/empty/503/429/offline/retry, failed-image fallback and native FAQ open/close passed.                                                                  |
| Real API/database            | Final read-only run passed identity, duration, active visibility, pricing filters, cursor traversal, zero price, SSR/reload deduplication and correct detail navigation; `services-oct-real-final.log`.                                                                    |
| Page health                  | Expected title `Vehicle services ? Allied AutoTech`, meaningful heading/content, correct URL, no framework overlay, no unexpected console/page errors, failed responses or broken rendered images; `services-oct-health.json`. Expected anonymous session 401 is excluded. |
| Visual comparison            | Final native 1536px introduction, desktop/tablet/mobile layouts, service row, principles, journey, FAQ and Contact inspected against the three concepts; deliberate deviations are recorded above.                                                                         |

Interaction loop: pricing choice ? matching real records ? next/previous page ? reload ? clear ? correct service detail. Separately, keyboard Enter/Space opens and closes the booking FAQ while retaining focus.

Commands: `npm run build`; `npm run lint`; `npx vitest run tests/unit/service-discovery.test.ts --maxWorkers=1`; `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/services-quality.spec.ts`; targeted `npx eslint --max-warnings=0 tests/e2e/services-quality.spec.ts`; scoped `npx prettier --check`; `git diff --check`. Real API/database and screenshot/health harnesses are local scripts outside the repository.

The real API/database harness verified 15 active services, 13 fixed-price and two quotation records; cursor traversal matched active database IDs and excluded inactive records. Filtered SSR and reload generated no duplicate initial client list read. Pricing changes, next/previous, reload, reset, zero price, service identity and duration, correct detail destination and the booking FAQ passed without page errors.

Local artifacts are under `C:/Users/PC/.codex/`: `services-oct-before-*`, `services-oct-after-*`, `services-oct-real-{principles,journey,faq,contact}.png`, build/lint/browser logs and `services-oct-real.log`. Controlled-state/native screenshots use `services-quality-*` in the operating-system temporary directory. Concepts and repeatable browser tests are repository artifacts; these local screenshots/logs are not portable attachments.

An attempted temporary style injection was blocked by the production Content Security Policy. No policy was weakened; final validation passed against the rebuilt production bundle. This tooling event is separate from the app's browser regression results.

## Verification boundaries

The isolated dataset has no attached service photography; its fallback is intentional. Successful image rendering and a real intercepted 404 are exercised with controlled browser fixtures. Staging storage, production service content, manual screen-reader testing, other browser engines and field performance remain unverified. Automated Axe checks do not prove full accessibility conformance. Existing optional service-discovery extensions remain in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md); the expanded listing introduces no mandatory backend gap.

No blocker remains for this listing's local gate. Vehicle detail `/vehicles/[listingId]` is the next expanded route; its prior report does not certify expanded acceptance automatically.


## Service discovery extension - 9 October 2026

This section supersedes the earlier pricing-only API description for the current implementation. API-03 is implemented and locally accepted. The legacy service list remains supported; the page now uses `/public/services/discovery` with bounded search, category/pricing filters, deterministic sorting, exact totals and signed cursors. Categories come from real administrator-managed records and bounded server options. The backend remains authoritative for active-service visibility. Category archival removes grouping without unpublishing services.

Admin and Super Admin now have Service categories navigation and a category assignment field on service forms. Creation, assignment, archive and subsequent edits of a service retaining an archived assignment passed against the real isolated API and database. Staff/customer denial, MFA, CSRF, optimistic conflicts, audit records and inactive assignment checks passed in backend tests.

Final local evidence:

- 50 migrations replayed into `allied_service_discovery_20261009_test`, separate from the application database. Fifteen new discovery/category database cases plus nineteen service/media/security/OpenAPI/migration regressions passed (34 total). Tests include 10,000 services, selective GIN index use and page/count consistency during concurrent unpublication.
- Backend type/lint/format/secret and Prisma validation passed. Exported OpenAPI validates with 314 operations on 265 paths; mounted-route coverage and generated frontend types agree.
- All 357 frontend unit tests passed. Targeted ESLint/Prettier, TypeScript, production build and standalone preparation passed. The feature preview used the installed dependency junction; it is not a fresh dependency-isolation or deployment acceptance claim.
- All 23 final Playwright scenarios passed on Microsoft Edge. Browser plugin not available. The flow under test was Services -> search/filter/sort/page -> matching real results and retained state after reload; administrator flow was category creation -> service assignment -> archive -> unrelated service edit.
- Controlled tests covered pricing, zero/quotation presentation, fallback images, loading, empty, offline/503/429 recovery, invalid links and signed-cursor restart. Axe checks and no-overflow checks passed at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px, plus a short touch viewport. No page errors were observed in checked flows.
- The real public flow traversed distinct twelve-record pages among 75 matches, restored page two after reload, searched and paged 25 category options, selected an option beyond the first page, and retained its label/filter after reload. Both administrator roles completed real mutations. Final desktop/mobile screenshots were inspected; control borders and spacing were corrected before final acceptance.

Local evidence artifacts: `%TEMP%/allied-service-discovery-backend-results.json` (34 passed), `%TEMP%/allied-service-discovery-final-results/.last-run.json` (final 23-test browser run), `%TEMP%/service-discovery-real-{desktop,mobile}.png`, and final `services-quality-*-filters.png` screenshots. The first browser run was interrupted by host suspension and contained test timing/selector/encoding failures; those are not counted as passing evidence. The final clean run passed all scenarios. Synthetic session fixtures were removed and isolated servers stopped after verification.

Deploy `20261009140000_service_discovery` and the backend before the frontend; the application database was not migrated by these tests. See [service discovery contract and rollout](../../../backend/docs/service-discovery.md). Real Spaces uploads, deployed networking/providers, other browser engines and manual assistive-technology acceptance remain separate.
