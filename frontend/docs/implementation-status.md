# Frontend implementation ledger

## Scope and discovery — 12 September 2026

The attached 18-section brief is the acceptance contract. Work is in progress; this document is not a release approval.

The workshop increment adds staff booking list/detail, assignment, versioned status changes and business disruption reporting. Quotations support part/labour/fee line editing, tax, notes, expiry, draft replacement and issue/void/expire review. Work orders support draft creation, customer-visible diagnosis, internal notes, appended line items and versioned milestones. Appointment slots support publication, scoped list/status filtering and versioned open/close review. Inventory supports scoped filtering, server balances, movement and reservation history, stock changes, reservation release, administrator record creation and versioned reorder levels. Browser fixtures cover selected success and uncertain-response paths; remaining staff domains are still unfinished. See the endpoint inventory and validation record for the distinction between implemented code, intercepted browser tests and real API verification.

- Preserve the pre-existing frontend implementation and changes to backend identity/payment services and identity integration tests. No backend business-rule changes are authorized implicitly.
- Stack: Next.js 16.3.3 App Router, React 19.2.8, TypeScript, Tailwind 4 with existing CSS tokens; Express 5, Prisma 7, PostgreSQL and opaque cookie sessions.
- The checked-in OpenAPI artifact describes 225 operations. Its request schemas are useful for generation, but several response projections contain only optional `id`/`status` and `additionalProperties: true`. Reconcile real response shapes with backend controllers and services; do not assume generated response types are complete.
- `error.fields` is a dictionary of field paths to string arrays in backend validation. The pre-existing frontend incorrectly typed it as an array.
- No session refresh endpoint exists. Sessions are backend-managed; CSRF rotation is supported. Do not invent refresh-token storage or replay consequential mutations.
- Cookie flags depend on backend `NODE_ENV`, not `DEPLOYMENT_ENV`: production mode uses Secure, HttpOnly, SameSite=Lax, host-only `__Host-aat_session`, Path=/.
- The older public handover names Cloudflare; the newer integration handover names Vercel rewrites to DigitalOcean. Preserve same-origin `/api/v1` routing and make the deployment topology an explicit staging decision.
- Existing design documentation calls the workshop image generated. The new brief prohibits AI-generated images; remove it from rendered UI while preserving the user's original asset file.
- Figma account connection verified. No authorized project file/node URL was supplied or found in project docs. File inspection is unavailable without that reference; no claim of Figma fidelity is made.
- GitHub connector returned 404 for `Michael-Enoch/allied-autotech`; local Git remains available. No push, PR, or deployment has occurred.
- Initial reference fetches were empty, but subsequent anonymous browser inspection successfully rendered Link login and Termii sign-in. Their layout principles are recorded in the design system; no identity, imagery or metrics were copied.
- Search did not establish official social profiles or a precise Maps place identifier. Display confirmed handle/address as text, use address-based directions, and withhold an exact pin until verified.

## Baseline

## Public entry experience — 14 September 2026

The homepage now acts as the public product entry point: it has route-aware navigation,
an accessible keyboard-controlled carousel for services, parts and vehicles, API-backed
featured catalogue panels, a transparent three-step journey, contact/location actions,
trust and support guidance, and an FAQ preview. Catalogue failures and empty responses
remain explicit rather than being replaced with invented products, vehicles, prices or
reviews. Shared notice accents now use restrained top rules instead of card-like side
tabs.

- Frontend lint: passed before edits.
- Frontend typecheck: passed before edits.
- Frontend tests: pre-existing failure, no test files found.
- Frontend production build: passed at baseline (18 routes); recent additions require a new build.
- Backend typecheck: passed before edits.
- Backend lint: passed before edits.
- Backend tests: 126 passed, 26 skipped; skipped database suites require explicit isolated test configuration.

## Work remaining

Implemented foundations: generated request types and 225-operation inventory; cookie/CSRF client with stale-response protection; public services/parts/vehicle discovery; booking/quotation decisions, customer vehicles, cart, orders, payments, invoices, saved items, inspections and purchase history; branch/category/service/product administration and operational queue status; contact/help/automated guide. Implemented does not mean fully verified: see [validation progress](validation-progress.md).

Remaining work includes complete staff operations, upload/manual-payment/refund workflows, existing auth/profile/support/security panel audit, approved vehicle reservation terms, SEO, exhaustive endpoint mapping, real isolated backend/browser verification, performance/accessibility review and final release/staging documentation. Sales aggregates are unavailable in the current API and must not be inferred from one result page.

Security/contract findings to resolve or explicitly carry into release review: customer booking serializers appear to include draft quotes (the UI hides them, which is not a data-access boundary); reservation acceptance has no published approved terms/version source; development cache headers require production verification; image hosting requires an approved allowlist. The CSP permits inline style attributes for Next/Image layout but continues to require nonces for production style elements and scripts. Invalid media hosts are discarded before entering CSP.
