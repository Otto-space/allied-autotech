# Customer garage / vehicles list

Status: **locally accepted, 9 October 2026, expanded milestone 36**. Route `/dashboard/vehicles`, customer role only. The photo detail route retains its separate page gate.

## Audit and implementation

The original route used large, sparse cards and an always-visible form below pagination. Mobile customers had to scroll past their records to add a vehicle, while mileage, colour and VIN were omitted from the list. Paging was local state; the inherited breadcrumb was not semantic. Baselines at 390, 768, 1280 and 1440px were captured and inspected before production edits.

Three [ImageGen concepts and the written specification](customer-garage-oct-concepts/README.md) preceded implementation. The [garage component](../../app/components/customer-vehicles.tsx) now presents continuous records, real vehicle metadata, an ink guidance band, compact controls and URL pagination. Manage photos preserves the existing detail route. Add/Edit use a focused modal form; Remove requires explicit confirmation. The dialogs have a scrollable body, reachable footer, focus restoration, background scroll locking and native keyboard containment. Safe form drafts retain the existing account-scoped draft key.

[Validation and query helpers](../../lib/customer-garage.ts) align trimming, capitalization, required fields, year and mileage bounds with the backend. Optional blanks become null; zero mileage remains zero. The list parser rejects invalid vehicle records or response cursors. Mutation responses are parsed, and edit responses must match the requested vehicle ID. Duplicate submissions are locked synchronously. Unconfirmed outcomes disable resubmission, preserve context and direct the customer to re-read their vehicles. Loading/manual failure hides old data; background failure labels stale rows and disables editing. Session changes clear private dialogs and late feedback.

## Authoritative backend boundary

- [Customer routes](../../../backend/src/modules/customers/customers.routes.ts) require authentication and the Customer role; POST/PATCH/DELETE also require CSRF.
- [Schemas](../../../backend/src/modules/customers/customers.schemas.ts) accept make/model up to 80 characters, integer year from 1886 through next UTC year, optional normalized registration/VIN, colour up to 50 characters and integer mileage 0 through 5,000,000. Unknown properties are rejected.
- [Repository](../../../backend/src/modules/customers/customers.repository.ts) scopes reads/mutations to the actor's customer profile. List ordering is ID ascending with UUID cursors and bounded limits; it supplies no search, global total or photo projection. Detail already supports owned media.
- [Service](../../../backend/src/modules/customers/customers.service.ts) validates cursor ownership and audits create/update/delete. Vehicle deletion queues attached media cleanup; the schema retains related bookings with a nullable vehicle relation. The UI does not promise a deleted vehicle or its gallery can be restored.

No new endpoint or migration is required for this route. No generated vehicle photography, unsupported search, maintenance status, global count or per-row media lookup was introduced. Deployed media remains under REL-01; session integration remains under REL-03 in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md).

## Completed local verification

Fourteen backend garage-media/identity tests passed against isolated local test configuration; five frontend resource-lifecycle tests passed. Full frontend lint, production build, typecheck and focused lint/format checks passed. All 34 original garage cases passed after the short-screen keyboard repair, alongside 23 shared navigation cases and two existing garage regressions. The added footer-clearance regression passed in the final 16-case layout/accessibility rerun: 60 distinct scenarios have passing evidence. That rerun covered ten widths (320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px), four accessibility checks, short-screen keyboard containment and footer clearance. Final captures at all ten widths recorded no page or dialog overflow. Production build, including TypeScript and standalone packaging, passed after the last CSS adjustments.

Real browser/Express/PostgreSQL checks passed: 12 owned vehicles traversed as 10 and 2, reload/Previous worked, creation normalized and persisted fields with one audit, edit persisted, cancellation retained the record, and confirmed removal deleted it. Scope override returned 422; foreign cursor/detail/PATCH/DELETE returned 404; privileged roles returned 403; anonymous reads returned 401. Missing CSRF returned 403 and negative mileage returned 422. Reads were private/no-store and omitted customer ownership fields. No browser page errors occurred. This used an isolated database and does not certify deployed storage.

Visual review identified wrapping in the desktop photo action and excessive spacing above the additional-field description. The action rail was widened and form spacing tightened. Native desktop inspection also prompted clearance beside the floating support control and top alignment for tablet vehicle icons; both refinements passed final rendered inspection at 1506×1045 and tablet widths. The contact link remains clear of the floating support controls. No material mismatch remains within this route's local scope.

## Concept fidelity ledger

The three retained concept images were opened alongside implementation screenshots. The desktop concept's native dimensions are 1506×1045; the corresponding viewport and mobile/form/state captures are recorded outside the repository.

| Point                   | Evidence and resolution                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy and hierarchy      | Title, subtitle, guidance and actions match the written specification. Record labels use actual API data; no unsupported totals, search, health or service status appear.                                                     |
| List density            | One white list with dividers, registration/colour/mileage/VIN, car icon and action rail replaces the sparse separate cards. The desktop photo label fits one line after widening its rail.                                    |
| Palette and identity    | Actual Allied shell/logo, ink guidance, cool canvas, white records and restrained red actions. Generated phone chrome, logo substitutions and filled car icons were excluded as specified.                                    |
| Typography and controls | Computed checks at six widths confirm Quicksand, 30/27px headings, 16px form text and 48px input height; action targets meet 44px.                                                                                            |
| Form and keyboard       | Desktop two-column fields become one column on mobile. A scrollable body retains the footer on a 390×480 viewport. Explicit Tab/Shift+Tab wrapping repairs the native-dialog focus escape; Escape and focus restoration pass. |
| Recovery                | Empty/error/loading/stale, validation, unconfirmed-save and removal states were captured and inspected. Server-safe error messages replace the artwork's generic failure sentence where available.                            |
| Responsive differences  | Mobile records stay expanded rather than adopting the artwork's invented collapsed rows. Photo actions span the narrow record width to retain usable targets. Actual text/number inputs replace invented catalogue dropdowns. |

Above-the-fold copy matches the recorded specification; documented changes are contract-driven sample values, the real shared shell and applicable error messages. No new raster imagery is rendered as application controls. Deployed storage, other browser engines, manual screen-reader use and real-device keyboard behavior remain outside this local acceptance scope.

Browser plugin not available; browser verification uses installed Microsoft Edge through Playwright. External captures, helpers and logs use `C:/Users/PC/.codex/customer-garage-oct-*`. Production preview was verified at `http://localhost:3001`; real API checks use the isolated `allied_customer_overview_test` PostgreSQL database. The complete application goal remains active.

Next route: customer vehicle photo detail `/dashboard/vehicles/[vehicleId]`. This acceptance covers the garage list and its create/edit/remove dialogs; it does not certify the separate photo-management redesign.

Evidence logs: `customer-garage-oct-browser-final.log` (34 cases), `customer-garage-oct-regression.log` (two legacy garage cases), `customer-garage-oct-browser.log` (23 passing navigation cases; earlier keyboard failure subsequently fixed), `customer-garage-oct-browser-release.log` (16 final cases), `customer-garage-oct-build-release.log`, `customer-garage-oct-resource-final.log` and `customer-garage-oct-real.log`, all beneath `C:/Users/PC/.codex/`. These are local evidence files, not deployment acceptance.
