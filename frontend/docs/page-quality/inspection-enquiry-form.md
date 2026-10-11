# Vehicle inspection and enquiry requests

Date: 8 October 2026

Status: complete for this local request-creation workflow gate. All final checks below passed. The full application and deployment remain separate, open scopes.

Scope: customer request creation inside `/vehicles/[listingId]`, including the enquiry action in the price sidebar and the inspection editor at `#inspection`. This is separate from the previously accepted public vehicle-detail page and from the future customer/staff inspection and transaction dashboard gates.

## Audit and contracts

The original editor submitted immediately. It validated the API's returned UUID but discarded it. An uncertain response showed guidance but allowed another attempt. On mobile, the explanatory steps came before the form.

Read-only inspection confirmed these existing `/api/v1` contracts:

| Operation         | Contract and authority                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enquiry           | `POST /customers/vehicle-transactions` with `vehicleListingId`; the server creates an `ENQUIRY` with account contact details and the current asking-price snapshot. No free-text enquiry field is accepted by this creation contract.                                                                 |
| Inspection        | `POST /customers/vehicle-inspections` with `vehicleListingId`, future `preferredStartAt` and optional trimmed notes up to 2,000 characters. The form retains its existing single preferred-time field; the optional end time is not introduced. The result is a request, not a confirmed appointment. |
| Account follow-up | Owner-scoped inspection list and transaction list/detail reads. Enquiry receipts link to the actual returned transaction ID; inspection receipts use the supported inspection history route.                                                                                                          |
| Save              | Existing `PUT /customers/saved-vehicles/{listingId}` is preserved.                                                                                                                                                                                                                                    |
| Access            | Customer authentication and CSRF are enforced on the backend. Staff, Admin and Super Admin cannot use customer creation endpoints. Listing visibility and account ownership remain server-authoritative.                                                                                              |

Sources: [routes](../../../backend/src/modules/vehicle-sales/vehicle-sales.routes.ts), [schemas](../../../backend/src/modules/vehicle-sales/vehicle-sales.schemas.ts), [service](../../../backend/src/modules/vehicle-sales/vehicle-sales.service.ts), [existing detail report](vehicle-detail-expanded.md).

## Design and behavior

Three [fresh concepts](inspection-oct-concepts/README.md) preceded code changes. The desktop section combines a navy introduction with a white editor; mobile places the editor before the steps. Nippo/Quicksand, current listing/branch data, visible field borders and the existing approved detail-page shell are retained.

Both requests now require explicit review before sending. Inspection review shows the Lagos time and trimmed notes; editing preserves the draft. The preferred time is checked again immediately before submission. Enquiry review explains the account-contact behavior and that an enquiry does not reserve the vehicle.

Successful requests display only the validated server UUID, with the existing accessible copy control and manual-copy fallback. The inspection receipt remains visible when the enquiry workflow starts. Starting another inspection clears the successfully submitted draft, including its draft-restoration entry. Rejected requests preserve entries.

Session changes discard drafts, review state, receipts and pending-response effects. A fresh session check precedes every mutation. Unknown outcomes lock the affected action and provide account navigation; another successful action does not remove that lock. Work accounts link directly to `/admin` and never see customer mutation controls.

## Verification

Final acceptance evidence:

- Final production build and standalone packaging passed after the draft-reset correction (`inspection-oct-build-complete.log`).
- Full frontend lint passed; subsequent component/test changes passed scoped lint. A separate TypeScript check passed after the final build (`inspection-oct-types-complete.log`). Formatting and `git diff --check` passed.
- Fifteen frontend unit tests passed: seven date/account-mutation tests and eight draft-system tests.
- All 44 vehicle-detail/request browser scenarios passed in the final clean batch (`inspection-oct-browser-complete.log`), including 18 new workflow scenarios and 26 detail regressions. All seven targeted account-isolation regressions passed separately (`inspection-oct-account-regressions.log`), with independent output directories and fixture servers.
- Nineteen existing backend vehicle security and route-boundary tests passed. This is not a claim that the entire backend integration suite was run.
- The real local API/database flow passed both reviewed requests, UUID-to-database identity, one saved vehicle, UTC conversion, owner follow-up reads, a blank editor for another inspection, receipt retention and refresh. A past time returned 409, missing CSRF returned 403, anonymous access returned 401, another customer's transaction read returned 404, and their inspection list excluded the private request. No browser page errors were recorded.

The real run used isolated synthetic accounts and records in `allied_vehicles_qa` on PostgreSQL port 55439, backend 5012 and production frontend 3001. External providers were disabled. It establishes local persistence and access behavior, not notification delivery or deployment readiness.

Final controlled browser coverage passed at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. It includes reviews, receipts, copy, repeat requests, unknown outcomes, malformed receipts, account changes, invalid/past dates, expiry during review, long notes, 390×568 and 844×390 screens, keyboard focus, role controls and existing gallery/detail regressions. Full-page accessibility scans passed for the editor at all ten widths and both review/receipt states at six representative widths. Native 390px mobile, 320px narrow-mobile and 1440px desktop captures were inspected directly against all three concepts.

The initial checks exposed and corrected an enquiry contrast defect and restored drafts after confirmed inspection submission. The first structured-data regression also required the fixture preview's explicit test origin/indexing configuration; production configuration was unchanged. A long-note test originally exceeded the 2,000-character contract and was corrected to 1,950 characters. The real API harness was corrected to use the existing POST CSRF endpoint. Final evidence above supersedes those intermediate failures.

## Fidelity and corrections

| Check               | Concept/baseline evidence                                | Browser result and correction                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop composition | Navy introduction, white request editor                  | Implemented as one bordered section with compact native fields; no generated brand assets or invented phone number.                                                                                                     |
| Mobile order        | Concept places form above the numbered guidance          | Editor now begins below the short introduction, ahead of all three explanatory steps.                                                                                                                                   |
| Vehicle context     | Both review concepts identify the selected vehicle       | Actual listing title and branch render in a compact grey strip and wrap at 320px.                                                                                                                                       |
| Review hierarchy    | Preferred time, notes and a separate confirmation action | Lagos time is explicit, notes wrap, edit/send remain distinct; no request is sent by entering review.                                                                                                                   |
| Enquiry contrast    | White review inside the existing navy sidebar            | Initial inherited white text on the grey identity strip failed Axe; explicit scoped foregrounds and secondary-button colors corrected it.                                                                               |
| Reference receipt   | Selectable reference, copy action and account link       | Actual returned UUID wraps on mobile; clipboard denial selects the reference for manual copying.                                                                                                                        |
| Long/mobile content | Complete form and review with reachable actions          | Ordinary document flow supports long notes and short screens; component captures use taller viewports to show the complete section without the fixed support bar covering it. Standard viewport checks remain separate. |
| Repeat request      | A new request should begin with a fresh editor           | A regression test exposed saved-draft restoration after success; explicit form reset now clears that entry before the editor unmounts. Final ten-width rerun and real API repeat-request check passed.                  |

The generated decorative vehicle, invented logo/slogans and telephone number were excluded. Native datetime controls and the verified company copy take precedence over generated pixels. No unverified appointment availability, reservation, deposit, price guarantee or new input contract was introduced.

## Files and evidence

Implementation: [request component](../../app/components/vehicle-actions.tsx), [detail route](../../app/vehicles/[listingId]/page.tsx), [scoped styles](../../app/vehicles/[listingId]/vehicle-detail.css).

Tests: [detail and request workflows](../../tests/e2e/vehicle-detail-quality.spec.ts), [account isolation regressions](../../tests/e2e/public-account-actions.spec.ts).

Local evidence remains outside the repository under `C:/Users/PC/.codex/`:

- `inspection-oct-before-{390,768,1280,1440}.png` and `enquiry-oct-before-1440.png`.
- `inspection-oct-after-{width}-{form,review,receipt}.png` and `enquiry-oct-after-{width}-{review,receipt}.png`.
- `inspection-oct-real-final.log`, `inspection-oct-unit.log`, `inspection-oct-drafts-unit.log`, `inspection-oct-backend-tests.log`.
- `inspection-oct-build-complete.log`, `inspection-oct-browser-complete.log`, `inspection-oct-account-regressions.log`, `inspection-oct-types-complete.log`, `inspection-oct-lint.log` and `inspection-oct-reset-lint.log`.

## Boundaries and next milestone

At this page's original acceptance, the create endpoints did not provide idempotent retries. The browser lock applied to the mounted account workflow; it was not an exactly-once guarantee across reloads or devices, and customers were directed to account history after uncertain outcomes.

**Subsequent API-04 acceptance, 8 October 2026:** the backend accepts an optional actor-scoped idempotency key, and frontend recovery retains the original reviewed body/key across reloads in the same tab. The separate recovery gate passed nine PostgreSQL scenarios, 353 frontend unit tests, 48 browser scenarios, static checks and an isolated production build. An actual browser/API check dropped committed HTTP 201 responses, reloaded and recovered the original IDs; PostgreSQL confirmed one record and one audit for each action. Account changes remove private notes; expired, corrupt or redacted intents require history review. See [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md) and the [retry contract](../../../backend/docs/vehicle-creation-retries.md) for exact evidence, retention, compatibility and deployment order. This does not promise cross-device or global exactly-once creation.

No new mandatory endpoint is needed for this request-creation gate. Deployed provider/storage checks remain in the [backend handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md). Customer/staff inspection histories and transaction detail redesigns remain separate. Continue with checkout and the remaining commerce workflows; the full application goal stays active.
