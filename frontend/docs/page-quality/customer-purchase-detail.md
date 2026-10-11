# Customer vehicle purchase detail ? expanded quality gate

Status: accepted locally on 11 October 2026 ? fortieth expanded milestone. Route: `/dashboard/vehicle-transactions/[transactionId]`. Listing acceptance remains separate. Audit/baselines started 9 October; resumed 11 October after interruption. The previous turn produced four-width baseline evidence and the desktop concept; it made concrete progress rather than merely restating the plan.

## Audit and implementation

The former page stacked generic key/value text, progress and payment forms with large gaps, duplicated its navigation trail, omitted available photography/paid-hold/ready-date fields and did not label retained stale details. The existing payment-request flow already had important safeguards worth preserving.

The new page uses an entity breadcrumb, compact refresh header, public listing photograph with honest fallback, deep-blue vehicle identity and connected exact-price strip. Recorded reservation/cancellation information precedes the payment area and chronological history rail. Historical acceptance, paid holds and handover values remain distinct records. Missing values and explicit zero odometer/keys are distinguished. Handover readiness does not promise collection; no inferred balance or future stages are shown.

[Retained desktop/mobile/state concepts and specification](customer-purchase-detail-oct-concepts/README.md) preceded production edits. The existing customer shell, actual logo, shared PublicMedia, useResource and MutationReview are reused. Scoped CSS controls the new composition without restyling other routes. Nippo remains the public display font; this private page uses Quicksand.

## Contract and permission evidence

- Existing customer-only GET `/customers/vehicle-transactions/:transactionId` supplies exact integer-kobo prices, authoritative status, public listing photo projection, historical terms acceptance, paid-hold timestamps, status events and handover fields. Owner mismatch is hidden as 404; Staff/Admin/Super Admin are not customer impersonation paths.
- New local response boundary validates UUIDs, status enums, ISO dates, unique history event IDs, money strings and nonnegative handover values; it selects only used fields. Invalid route IDs are contained before the resource request. Optional image/hold additions preserve compatibility with historical fixture projections.
- Payments still traverse every page of the existing owned payment list. A valid purchase is now required before this fetch begins. No target-filter or global total is invented.
- Payment preflight, complete-history checks, version/price/deadline comparison, unresolved-attempt guard, CSRF, server amount calculation, exact original-key recovery and existing payment-detail handoff remain. Explicit disabled action markup matches the disabled fieldset, fixing a shared-style contrast conflict.
- Manual load/failure hides the record; transient background failure retains a labelled snapshot and disables mutations. Background refresh also pauses creation. Account changes discard purchase/payment data and open reviews. Unconfirmed mutation state survives ordinary purchase refreshes.
- **BG-11 remains open:** the reserve endpoint accepts/stores a caller-supplied terms version without a published approved document/version check. Approved agreement content cannot be invented. The current customer-care guidance remains. See [backend gap and implementation criteria](../../../BACKEND_IMPLEMENTATION_GAPS.md#bg-11--approved-vehicle-reservation-terms-and-acceptance-validation). Policy fixtures used for isolated payment tests are not business approval.

## Verification ledger

- Four baseline captures: 390, 768, 1280 and 1440px, inspected before implementation.
- Initial production build, full frontend lint, explicit TypeScript, 14 focused response/resource tests and 21 existing backend database/boundary/security tests passed.
- Initial combined browser run: 82/85 passed. All 26 existing vehicle-payment and 23 shared-navigation scenarios passed. Two new mobile/tablet contrast assertions exposed the inherited fieldset/button styling discrepancy; explicit disabled markup and scoped styling corrected it. The long-content assertion sampled an ongoing smooth scroll; it now waits for the same visibility requirement to settle.
- First ten-width captures: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px, no page overflow or page errors. Desktop/mobile/tablet inspection revealed legacy form margins and heading sizes overriding the concept; scoped specificity was corrected before the final build.
- The first real API attempt exposed a QA cookie reset after anonymous-denial checks; fixture restores its owned session before browser work. The next attempt was refused by the actual approved vehicle-policy gate. The helper now explicitly creates an isolated synthetic approved policy before exercising payment creation. No production approval or backend control was changed.
- Corrected production build and the complete 85-case browser run passed: 36 detail cases, 26 payment safeguards and 23 shared-navigation cases. All four accessibility widths and the short-screen focus check pass. A final 320px visual review shortened the select prompt to avoid clipping; the final build and 18 targeted layout/accessibility/payment repeats passed.
- Real browser/API/PostgreSQL assertions passed: owner and role denial, private caching, exact large prices, recorded history, zero-value handover, lost-response recovery with the original key, one persisted payment at 50000001 kobo, unchanged purchase version, payment-detail navigation and CSRF rejection. The harness initially counted the CSRF POST as a payment write; it now explicitly distinguishes them and checks that no unexpected POST endpoints are used. The closing helper explicitly returned Node exit 0, distinguishing successful assertions from PowerShell native-warning formatting.
- Final ten-width captures and six state captures have no horizontal overflow. Settled-control screenshots and final concept comparison passed. A desktop right gutter keeps floating support controls clear of recorded text. Final diff review also corrected two inadvertently re-encoded loading labels; the rebuilt source and closing 18-case run pass.

## Local evidence and commands

Evidence/helpers live outside the repository under `C:/Users/PC/.codex/purchase-detail-oct-*`. Baseline `before-W.png`; concepts in this report's adjacent folder; capture helper `after.cjs`; state helper `states.cjs`; real API/PostgreSQL helper `real.cjs`. Logs: `unit.log`, `backend.log`, `lint.log`, `types.log`, `build.log`, `browser.log`, `captures.log`; closing evidence is `build-final.log`, `lint-final.log`, `browser-final.log` (85 passed), `browser-closing.log` (18 passed), `captures-final.log`, `states.log` and `real.log` (Node exit 0). Browser plugin was unavailable; Edge through Playwright was used against the built standalone preview at localhost:3001. Synthetic fixture media tests public-image decoding, not actual vehicle identity or live inventory. No generated vehicle was added to production inventory.

```powershell
# frontend
$env:PLAYWRIGHT_BASE_URL='http://localhost:3001'
npx playwright test tests/e2e/customer-purchase-detail-quality.spec.ts tests/e2e/vehicle-payments.spec.ts tests/e2e/dashboard-navigation.spec.ts
npx vitest run tests/unit/customer-purchase-detail.test.ts tests/unit/resource-background-refresh.test.tsx
npm run lint
npm run typecheck
npm run build
# backend; RUN_DATABASE_TESTS=true and isolated allied_customer_overview_test
npx vitest run tests/integration/phase7-vehicle-sales-flow.test.ts tests/api/phase7-vehicle-boundaries.test.ts tests/unit/phase7-vehicle-security.test.ts
```

## Fidelity ledger

| Area                    | Concept / evidence                                                 | Correction or deliberate contract adaptation                                                                     | Final result                         |
| ----------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Composition             | Connected image/identity/price strip; payment and history split    | Desktop 32/68 summary, 60/40 lower columns; mobile stacks                                                        | Passed final captures                |
| Legacy form rules       | Initial payment card sits 28px below its timeline                  | Scoped selector resets margin and controls padding/radius                                                        | Passed corrected 85-case browser run |
| Typography              | Global h2 rule reduces vehicle heading, enlarges agreement heading | Scoped vehicle 22?26px and agreement 16px rules                                                                  | Passed corrected 85-case browser run |
| Disabled payment action | Axe detects white text on inherited grey background                | Explicit button disabled attribute matches fieldset; remove ancestor opacity                                     | Passed corrected 85-case browser run |
| Truthful records        | Artwork invents specifications, amount and collection action       | Only API fields; amount after response; historical terms; customer-care handoff                                  | Implemented                          |
| Mobile focus            | Initial assertion measures smooth scroll before completion         | Wait for focus target to settle above fixed support bar                                                          | Passed corrected 85-case browser run |
| Media                   | Concept car is a sample; older fixture used campaign-poster bytes  | API-approved URLs only, stable aspect ratio and fallback; updated fixture uses existing showroom editorial bytes | Passed final capture review          |

## Acceptance scope

Ten widths (320?1536px), complete normal/recovery/handover presentation and recorded payment outcomes are accepted locally. The final desktop review compared retained concepts with the latest built captures; the right gutter removes support-widget overlap at 1280px and above. Full-page screenshots show fixed support bars at the capture viewport boundary; normal scrolling, modal containment and keyboard reachability are checked separately. No deployment, live provider settlement, approved reservation terms, or completion of remaining customer/staff/admin pages is claimed. BG-11 and REL-01?REL-03 remain open. Next route: customer profile `/dashboard/profile`.

## Changed files

- [Detail component](../../app/components/vehicle-transaction-detail.tsx), [route](../../app/dashboard/vehicle-transactions/[transactionId]/page.tsx), [scoped CSS](../../app/dashboard/vehicle-transactions/[transactionId]/purchase-detail.css).
- [Payment requests](../../app/components/vehicle-payment-requests.tsx): owned-record fetch prerequisite, uncertainty reset on account change and explicit disabled action markup.
- [Dashboard shell](../../app/components/dashboard-shell.tsx): suppress only this route's duplicate generic breadcrumb.
- [Response boundary](../../lib/api/customer-purchase-detail-schema.ts), [unit tests](../../tests/unit/customer-purchase-detail.test.ts), [browser tests](../../tests/e2e/customer-purchase-detail-quality.spec.ts), [fixtures](../../tests/fixtures/customer-purchase-detail.ts).
- This report, retained concepts/specification and BG-11 documentation. No backend application code, schema, migration or package dependency changed in this page gate.
