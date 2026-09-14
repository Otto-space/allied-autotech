# Release blockers and unfinished work

The application is not ready for release against the full supplied brief. This is an active work list, not a request to waive requirements.

## Backend and business decisions

| Item                                | Current evidence                                                                                                                                                                                                                                                                        | Required resolution                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer access to draft quotations | `backend/src/modules/service-operations/service-operations.service.ts` removes staff-only fields in `customerSafeBooking`, but the selected quotations are not filtered by draft status. The customer UI hides drafts; the response still needs a server-side access-boundary decision. | Coordinate and test the intended customer quotation projection. Do not rely on UI filtering.                                                                                       |
| Vehicle reservation terms           | Reservation accepts a terms version and consent, but no approved published terms/version source has been identified.                                                                                                                                                                    | Supply approved terms and an authoritative version source before enabling acceptance.                                                                                              |
| Verified production identity links  | Business address, phone, email and social handle are supplied. Exact social profile URLs, map pin and production domain remain unverified or unspecified.                                                                                                                               | Verify the exact destinations; retain text address/handle and directions fallback until then.                                                                                      |
| Figma design authority              | Connector access was available, but no authorized design URL/node was supplied or found. Public Link and Termii authentication references were inspected anonymously.                                                                                                                   | Supply an authorized design if pixel fidelity to a specific Figma file is required. Current design decisions are documented adaptations.                                           |
| Financial aggregates                | Operations status supplies queue counts; authoritative sales/revenue aggregates are not present in the inspected API.                                                                                                                                                                   | Add an agreed aggregate endpoint or an explicit business decision. Never label unpaid order value or one page's totals as revenue.                                                 |
| Deployment topology                 | Existing handover material names different hosting combinations.                                                                                                                                                                                                                        | Confirm hosting, real domain, TLS, session-cookie proxy behavior, storage origins and provider test environment before staging validation. No production deployment is authorized. |

## Frontend implementation still required

- Complete staff invoice operations, vehicle catalogue/media/documents, inspection/negotiation/handover workflows, manual payment evidence/refunds, operational exceptions/audit and staff account/invitation management. Inventory and reservation screens are implemented; real staff API verification remains required.
- Complete review, customer-care, notification and account-security/MFA workflows and audit the existing panels against runtime contracts and ownership boundaries.
- Complete customer vehicle transaction payment/reservation flows once their approved terms dependency is resolved.
- Finish page-specific SEO, canonical/Open Graph configuration, sitemap/robots behavior and factual structured data. Do not invent a production domain or business claims.
- Finish consistent notification/toast behavior, keyboard/landscape/intermediate-width checks, measured performance work and the requested cognitive-complexity gate.
- Reconcile all 225 OpenAPI operations and operational route groups in the coverage ledger. Implemented code, fixture tests and real API verification must remain distinct.

## Verification still required

- Inventory reservation recovery: request validation requires a future expiry before service idempotency replay. A lost successful response retried after that expiry can be rejected before replay. Coordinate a backend recovery contract and test it; the frontend retains the original request and requires review, and does not change expiry or create another reservation automatically. Linking an optional customer currently requires an existing customer-profile reference because the inspected API has no staff customer lookup.

- Real isolated staff sessions with MFA and branch authorization; real quote/work-order/slot/inventory workflows; complete account recovery and security journeys.
- Provider test-mode payment completion, webhook reconciliation, manual evidence, refunds and uploads. No real cards, production data or customer notifications may be used as test coverage.
- Deployment-level HTTPS cookies, CSP, private document access, redirects, storage CORS and staging isolation.
- End-to-end acceptance across every brief section, current lint/typecheck/build/test gates, responsive/accessibility checks and performance measurements after the remaining implementation.

Historical successful checks are listed in [validation progress](validation-progress.md). They are bounded evidence, not blanket approval for later edits or untested domains.
