# Quotation authoring and review — 8 October 2026

Status: completed local workflow gate. This report covers the quotation section at `/admin/bookings/[bookingId]#quotations`, including creation, replacement, saved records and issue/void/expiry review. It is a separate workflow gate inside the existing booking page. The wider staff booking page and customer booking page remain separate redesign gates.

## Audit and direction

Formal quotations belong to bookings. The staff API creates drafts, replaces a draft with a new version, and issues it for customer acceptance. Quote-required public services already use the anonymous service-enquiry form; there is no separate public quotation-create endpoint to invent. The Help article now describes that distinction correctly.

The baseline one-line editor measured 1,016px tall at desktop and 1,287px at 390px. It stacked every field, used weak form borders, and repeated generic sections for saved quotations. Baselines were captured at 390, 768, 1280 and 1440px. Three fresh [ImageGen concepts](quotation-oct-concepts/README.md) were generated and inspected before implementation.

The editor now groups line items beside timing and notes, with a compact review footer. Small screens stack those groups while keeping quantity and unit price together. Saved records have clear status, version, expiry, notes, line items and server-authoritative totals. Existing shell navigation and Quicksand interface typography remain; this workflow does not introduce a marketing hero or photographic decoration.

## Contract and permissions

All API paths below omit `/api/v1`.

| Operation           | Existing contract and rule                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Read booking        | `GET /staff/bookings/{bookingId}`; Staff can read their active branch's records, Admin/Super Admin retain existing access           |
| Create draft        | `POST /staff/bookings/{bookingId}/quotes`; active booking status, authorised operator and a staff profile                           |
| Replace draft       | `PUT /staff/bookings/{bookingId}/quotes/{quoteId}`; DRAFT only, `expectedRevision`; creates a new version and voids the prior draft |
| Issue, void, expire | `POST /staff/bookings/{bookingId}/quotes/{quoteId}/{action}`; revision and transition rules remain enforced by the server           |
| Customer decision   | Existing owner-only booking quote accept/reject routes; drafts and never-issued versions stay out of the customer projection        |
| Part selection      | `GET /public/catalog/products` with bounded search/cursor queries; the server prices selected parts on save                         |

Staff mutations require assignment to the booking in the same active branch. The previous UI offered quote actions to unassigned branch staff; the new controls follow the existing backend restriction. A failed access read hides mutations. Administrators without a staff profile can perform otherwise-authorised transitions but cannot create or replace drafts. Booking refresh removes an editor if assignment access is lost. Backend authorization remains authoritative.

Part payloads contain product ID, quantity and optional description, without a client price. Labour/fee values use the existing exact NGN-to-kobo conversion. Tax is calculated by the server. Draft expiry is entered in Lagos time; issuance sets a separate seven-day acceptance deadline. The existing finance policy gate remains. No payment or deposit is introduced.

Review is required before writing. The existing mutation dialog prevents duplicate in-flight submission and blocks replay after an uncertain response. Refresh reconciles saved versions. Expiry and notes are disabled with the rest of a pending/uncertain editor. Keyboard Enter in catalogue search now searches choices instead of submitting the quotation.

## Implementation and regression scope

- `app/components/staff-quote-records.tsx`: quotation hierarchy, permission-aware controls, editor focus restoration and saved-record presentation.
- `app/components/staff-quotations.css`: scoped editor, records, totals and confirmation styles.
- `app/components/service-line-entry.tsx`: quote-only layout, focused editor heading, disabled timing/notes and review presentation.
- `app/components/service-line-fields.tsx`: add/remove icons and keyboard catalogue search; existing work-order usage retained.
- `app/components/staff-booking-detail.tsx`: quote permissions derived from validated own profile and booking assignment.
- `app/components/mutation-review.tsx`: optional quotation presentation class; shared mutation mechanics preserved.
- `lib/business.ts`: accurate quotation enquiry Help copy.
- `tests/e2e/quotation-quality.spec.ts`: responsive, access, validation, history, keyboard, focus and access-loss checks.
- `tests/e2e/staff-bookings.spec.ts`: existing mutation assertions retained; status assertions updated for readable labels.

## Verification evidence

The Browser tool is unavailable in this session. Browser verification uses the repository Playwright installation with headless Edge and the production standalone server on `http://localhost:3001`. The real API runs on port 5012 against isolated PostgreSQL `allied_vehicles_qa` on port 55439; external providers are disabled. Synthetic route fixtures support deterministic browser state coverage and are not production data.

Recorded checks:

- Production build and standalone packaging passed after the final production edits.
- Five existing backend service-operation safeguard tests passed.
- Twenty-seven existing currency, account-mutation and mutation-review unit tests passed.
- Real API/database lifecycle passed: review before write, create DRAFT, replace with a new version, void the old draft, server tax/totals, hide drafts from the customer, issue, exact seven-day deadline, owner acceptance and refreshed staff record. Additional real checks passed for draft voiding, rejection of premature expiry and successful expiry of an aged synthetic quotation.
- Negative real API checks passed: anonymous 401, customer-to-staff 403, unassigned mutation 403 with permitted branch read, missing CSRF 403, unverified MFA 403, stale revision 409 and cross-customer isolation. The unassigned staff browser showed readable records without quote controls.
- MFA state was primed in the isolated session fixture only after verifying the unverified denial. This does not claim a tested MFA enrolment or challenge ceremony.
- Expiry acceptance used only an isolated synthetic quote with creation, issue and expiry timestamps aged together by eight days, preserving database constraints. An earlier fixture attempt correctly failed the expiry-after-creation constraint. Repeated CSRF requests then reached the API limit; the harness waited for the reported retry time and completed successfully. No rate limits or database constraints were weakened.
- The first real harness retained a CSRF token across browser token refresh and hit 403 before its stale-revision assertion. Refreshing the harness token corrected that test setup; the subsequent lifecycle passed with no page errors.

Final clean browser run: all 39 scenarios passed together (30 quotation scenarios and nine existing staff-booking scenarios), using an isolated Playwright output directory. Five targeted Help article/search/topic/history/no-JavaScript regressions also passed. An earlier run passed 34 of 35 with one teardown-only failure because two runners shared an artifact folder; its isolated rerun and the complete final batch passed. Short-viewport assertions wait for native keyboard scrolling to settle before checking its position.

Short-view and landscape checks at 390 x 568 and 844 x 390 additionally verified long review content, keyboard scrolling, fully visible confirmation/back actions and preserved notes after Escape.

Ten widths were checked: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px, with no page overflow. Six widths received Axe checks of both the quotation section and open review dialog; all passed. Native concept-size captures were inspected at 1435 x 1096 (editor) and 1505 x 1045 (review), together with actual 390px editor and review captures. The final desktop editor is 690px high for the same baseline line item, down from 1,016px. Mobile remains a complete scrollable form with 44px controls.

Full lint, final scoped/test lint, separate TypeScript, production build and formatting checks passed. Temporary scripts, logs and screenshots remain outside the repository under `C:/Users/PC/.codex/quotation-oct-*`.

Key evidence logs: `quotation-oct-build-verified.log`, `quotation-oct-lint-final.log`, `quotation-oct-types-verified.log`, `quotation-oct-unit.log`, `quotation-oct-backend.log`, `quotation-oct-browser-complete.log`, `quotation-oct-help-regression.log`, `quotation-oct-visual-verified.log` and `quotation-oct-real-resumed.log`. The latter records the completed full API lifecycle after the rate-limit window.

## Fidelity ledger

| Comparison          | Concept / baseline                                 | Implementation correction or justified boundary                                                                                                                                                       |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form hierarchy      | Two-column desktop editor; stacked mobile sections | Line items and timing/notes are separated in the same order with a full-width footer                                                                                                                  |
| Control geometry    | 44px controls, visible borders, compact rows       | Scoped selectors override inherited dashboard spacing; quantity and price stay side by side                                                                                                           |
| Smallest viewport   | Mobile concept expects aligned quantity/price      | A wrapped unit-price label at 320px exposed misalignment; bottom alignment corrects the input row                                                                                                     |
| Container model     | White editor, pale timing panel, restrained shadow | Existing generic full-width fieldsets replaced by quote-scoped layout; other booking sections are not redesigned                                                                                      |
| Totals and records  | Readable status and dark total strip               | Values are drawn from saved API records; no client-estimated tax or invented last-saved metadata                                                                                                      |
| Dialog              | Compact issue review with facts and two actions    | Visual comparison caught inherited multi-column totals breaking quotation numbers and amounts; full-width fact rows fixed this. Semantic modal, focus, Escape and uncertain-result protections remain |
| Typography and copy | Quicksand interface, modest heading scale          | Real dates and NGN formatting, full pricing explanation and existing action labels retained; generated unsupported shell details omitted                                                              |
| Responsive table    | Full line-item table                               | Narrow screens scroll the labelled, keyboard-focusable table region without page overflow                                                                                                             |

Visual inspection used `view_image` on all three concepts and final browser captures. The implementation was verified against the concept direction across hierarchy, layout, typography, controls, palette, totals, dialog and responsive behavior. No clipping, page overflow or broken fact/amount wrapping remains in the checked states. Copy comparison retains required field/action labels and pricing/timing explanations. Intentional deviations are documented in the concept brief: real shell/branding and data, existing currency/date formatting, readable complete explanatory copy, open records instead of generated disclosure controls, and the same logical review/close order at every width. Secondary Add line item remains compact; the mobile footer actions span the form.

## Backend handoff and remaining goal

No new mandatory backend endpoint was identified. The assignment-visibility correction and enquiry Help copy are frontend fixes to match existing contracts. Existing finance-policy, storage and provider deployment checks remain separate release requirements in the root backend handoff.

The entire application goal remains active. Completing this authoring section does not certify full staff/customer booking detail pages, commerce, authentication or the remaining role dashboards. Inspection/enquiry workflow and checkout/auth/account/dashboard gates remain in the page-quality register.
