# Saved items and favourites

Status: local acceptance passed, 8 October 2026; twentieth expanded milestone. Route: `/dashboard/saved`, CUSTOMER only. Scope includes favourite parts, currently available saved vehicles, removal review, collection state and navigation to existing detail pages. Backend save/remove rules and financial workflows are unchanged.

## Audit and design

The old page stacked both collections. Its generic grid styles were absent on this route, so each desktop image expanded to almost the content width; five synthetic items produced a 5,515px page. Cards omitted useful part identity, stock and vehicle specifications. Removal immediately submitted a mutation without review, and its feedback was not guarded against a changed account.

Baselines at 390/768/1280/1440 were inspected before three fresh [ImageGen concepts](saved-oct-concepts/README.md): desktop parts, mobile vehicles and empty/error/removal states. The implementation retains the existing role-aware dashboard shell and breadcrumb. A short ink reservation note introduces keyboard-accessible parts/vehicle tabs. Compact cards use server-provided media, identity and prices, with working detail links and 44px removal controls. Missing images retain the existing honest fallback.

Parts show category, name, brand/SKU, current price and availability across the returned branches. Vehicles show make/model/year, current price, mileage when recorded, transmission when recorded, and branch location. No unsupported discounts, stock quantity, compatibility, reservation or purchase claims are added. Only the active collection is fetched.

The parts API uses its existing 12-item cursor pagination. Following API-05, vehicles also request twelve records per server page through `/customers/saved-vehicles/page`. Both repositories exclude unavailable/inactive catalogue records as documented. Counts explicitly describe the current page; empty states distinguish a first shortlist from an empty later page in either collection. No global saved-count claim is made. Each tab retains its own cursor history. A removed final item leaves Previous available; an invalidated cursor offers Return to first page.

## Mutation and account behavior

Removal reuses `MutationReview`: exact item/collection details, Go back, explicit Remove item, CSRF and the correct product/listing identifier. Uncertain outcomes disable resubmission until the dialog closes and the collection is read again. Rejected writes show no success. Failed refreshes retain the previously read cards and disable changes until recovery.

The page is keyed to the customer/session identity. Session-change events abort pending writes, clear prepared reviews and feedback, and invalidate the collection state. Late results cannot announce success for another account. Focus returns to the opener after cancelling, or to the collection heading after removal/refresh completes. Tabs support arrows, Home and End. Only real server-confirmed removal triggers the success notice and shared toast.

## Verification

- Final browser run: all 41 scenarios passed. Coverage includes both collections at 320/360/375/390/430/768/1024/1280/1440/1536, nine Axe scans across both tabs and the review dialog at 390/768/1440, short-screen keyboard behavior, exact large amounts, missing images, read/refresh failures, reviewed writes, uncertain outcomes, cursor/display paging, role exclusion and session cancellation. Captures at all ten widths showed no overflow or page errors; concepts and final renders were compared in the same QA pass.
- Initial browser run: 39 of 41 scenarios passed. Two failures exposed focus restoration after removal; both were corrected by waiting for the new resource revision. Visual comparison caught icon shrinkage from inherited padding; explicit 44px button/18px icon dimensions fix it. Final tests verify the icon size as well as touch-target height.
- Nineteen focused frontend unit tests passed for shared mutation review, session/resource lifecycle and background refresh. Full frontend lint, subsequent changed-file lint, separate type checking and the final production build/standalone packaging passed. Scoped formatting and document links were checked.
- Twenty-six existing backend catalogue/vehicle security and API-boundary tests passed. These are regression checks, not new backend functionality or a claim of a full security audit.
- A real isolated API/database/browser run, repeated on the final build, used synthetic customers in `allied_vehicles_qa` on port 55439. PUT save and repeat save produced one visible record for each collection; another customer's lists remained empty and their DELETE could not remove the owner's item. Anonymous reads returned 401 and missing-CSRF writes returned 403. Both reviewed browser removals persisted, leaving zero saved rows for the synthetic owner, with no browser page errors. No production records or live transactions were used.
- Browser plugin unavailable: Playwright with Edge was used. Temporary scripts, logs and captures are outside the application in `C:/Users/PC/.codex/saved-oct-*`. Browser fixtures use explicitly intercepted, existing editorial images only to test media rendering; these are not claimed as actual product/listing photographs.

## Fidelity decisions

| Comparison     | Result and correction                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout/density | Separate collections into tabs; three desktop parts columns and two vehicle columns, collapsing to two/one according to width. Bounded image areas replace the 5,515px baseline.                                                         |
| Hierarchy      | Keep breadcrumb, title, short introduction, reservation note, tabs, collection heading and controls, then cards and truthful availability notes.                                                                                         |
| Typography     | Retain Nippo/Quicksand; compact headings, exact currency formatting, readable captions and wrapped long references.                                                                                                                      |
| Palette        | Ink/white/red/cool-grey match the desktop concept. Keep the ink note on mobile for consistency instead of its generated pale variation.                                                                                                  |
| Media          | Show only server-linked approved media; unavailable images have an honest fallback. Concept sample photographs and logos are not shipped as inventory assets.                                                                            |
| Controls       | Preserve View part/View vehicle and outlined removal controls. Correct the shrunken trash icon and verify 44px touch controls. Show pagination only when useful.                                                                         |
| States         | Empty discovery links, retained cards after refresh failure, distinct error state and a reviewed removal dialog match the state concept. Shared dialog mobile stacking and Go back replace its generated extra close icon.               |
| Copy           | Preserve intended visible copy, correcting “Available catalogue items” to “Active catalogue items” because published products can be out of stock. Keep the existing global Find a page search, approved logo and Help/WhatsApp actions. |

## Remaining scope

API-05 adds server pagination with a customer-bound authenticated cursor, maximum 50 records, and an owner/keyset index. The legacy array endpoint remains available for older consumers. Saved unavailable records remain hidden by existing backend policy. Exposing or managing them would require a separately agreed contract and truthful availability state.

Deploy migration `20261008160000_saved_vehicle_pagination` and the new backend endpoint before the dependent frontend. No new storage configuration is required for paging. Deployed session/media behavior remains part of release verification. The optional cart drawer, broader toast refinements, authentication and remaining customer/staff/admin pages are separate gates. The application-wide goal remains open.

## API-05 follow-up acceptance

The original 41-scenario page acceptance above predates server pagination. Follow-up verification uses the isolated production preview at `http://localhost:3022/dashboard/saved` and real API at `127.0.0.1:5022`, backed by `allied_api05_20261008_test`. All 47 migrations replayed in that separate database. A real authenticated browser loaded 12 + 1 records, switched collections without losing the cursor, removed the final record through the existing CSRF-protected API, saw an empty second page, and returned to twelve remaining records. Direct database assertions confirmed the persisted removal. The synthetic session was revoked and its temporary credential file removed.

Desktop 1440px and mobile 390px captures were inspected; no page errors occurred. Browser plugin was unavailable, so verification used the existing Playwright/Edge setup. Screenshots are `%TEMP%/allied-api05-saved-1440.png` and `%TEMP%/allied-api05-saved-390.png`; the safe result artifact is `%TEMP%/allied-api05-live-results.json`. These synthetic vehicles intentionally have no images and exercise the existing fallback. This is local integration evidence, not deployed acceptance.

Follow-up browser coverage: 43 scenarios verified, including 320–1536px layouts, nine accessibility scans, bounded API requests, tab preservation, deleting the last page item, invalid-cursor recovery and account isolation. The main run passed 42 scenarios; its new account-switch test initially omitted the shell's existing Verify session again action. Adding that actual user step made the focused rerun pass; no application authorization was weakened. The frontend's 353 unit tests, typecheck, affected ESLint/Prettier checks and isolated production build passed. Backend acceptance and deployment order are recorded under API-05 in the root gap tracker.
