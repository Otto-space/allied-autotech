# Frontend implementation ledger

## September 17 public detail account-isolation increment

Booking, cart quantity, favourites, saved vehicles, vehicle enquiries and inspection forms now discard previous-session results/drafts and abort browser requests on account invalidation. Delayed completions cannot restore old data or unlock another request. Booking consent and idempotency attempts reset; unknown-result replay retains the original key/body only within the same session. The recovery notice acknowledges possible server completion and remains available even if service refresh fails. All 106 unit tests and 19 dedicated production browser cases passed, alongside ten account/authentication regressions. Final mobile/desktop recovery-link presentation checks passed; manual review identified separate floating-support overlap at narrow scroll positions, recorded in release blockers. Anonymous contact/support draft reset, real API ownership/concurrency, performance and the remaining full-brief release requirements remain open.

## September 17 public discovery rendering increment

Services, parts, vehicles and approved reviews now receive validated first-page server data. Homepage previews query all three public sources concurrently. Metadata and page reads share request-scoped results; hydration skips immediate redundant fetches but filter/pagination/reconnect/visibility changes still revalidate. Public records are cleared and refetched after account changes, while private records retain their existing discard boundary. Failed reads hide stale rendered catalogue/review data. No-JavaScript visitors can read the first page and open detail links; filters and further paging require JavaScript. Final affected browser checks passed: 61 SEO/public cases and two review regressions; the earlier broader run also passed account/authentication and the remaining review cases. All 102 unit tests, production build, lint, TypeScript and formatting passed. Real API and production performance remain separate release checks. The public-detail mutation-result gap is addressed in the subsequent account-isolation increment.

## September 17 public SEO and indexing increment

Public pages now emit page-specific canonical and social metadata from an explicitly configured HTTPS origin. Authentication/private routes remain non-indexable; query variants use clean canonicals and noindex. Missing/invalid origin keeps the site non-indexable even if indexing is requested. Added robots and a paginated published-catalogue sitemap with temporary failure responses, factual AutoRepair structured data and strict detail identity/404 handling. Existing detail SSR was verified without JavaScript. Public first-page SSR is implemented in the following discovery increment; actual production identity and measured performance remain unfinished.

## September 17 vehicle payment-request increment

Added all four customer vehicle payment purposes with explicit review, server-calculated amounts and navigation to the existing payment-method screen. Complete account-history paging finds related requests and prevents new creation while requests/attempts remain unresolved. Fresh purchase revision/amount/deadline checks precede creation; original key/body recovery survives purchase refreshes and remains locked after rejected replay. Payment detail validates its requested ID and links to the purchase. Reservation terms acceptance remains unavailable pending approved content/version; payment requests do not accept terms or extend holds. Real provider settlement and backend concurrency/replay corrections remain outstanding.

## September 17 cart maintenance and expiry audit increment

Added reviewed cart clearing with exact quantities/subtotal, fresh-state comparison, explicit refresh, cancellation and unknown-result locks. Existing item mutations now share the uncertain-cart guard so checkout cannot proceed from an unconfirmed cart edit. Requests abort when the account view unmounts. Two manual bulk-expiry endpoints are explicitly excluded from browser execution after inspection found payment protections present only in their system counterparts; the administrator overview explains unavailability and links to order/purchase records. Real concurrency and backend policy alignment remain release work.

## September 17 customer care increment

Replaced the enquiry-only panel with separate enquiry and complaint queues and conversation routes, covering 25 public/customer/staff endpoints. Customer creation supports all six enquiry types and all four complaint source choices; public contact forms support the allowed public sources and branch selection. Paginated messages replace capped embedded histories. Customer projections reject internal notes, staff explicitly chooses message visibility, and failed reads hide prior private content. Staff assignment, lifecycle and complaint-priority changes use expectedVersion and reviewed consequences. Unknown outcomes are not replayed; account invalidation clears drafts. Shared mobile navigation and quick-help controls now use labelled navigation landmarks. Real API ownership/branch authorization, concurrent writes and notification delivery remain outstanding; these checks do not send real messages.

## September 17 review submission, moderation and public feedback increment

Replaced manual product/service identifiers with completed account-record pickers and added order/vehicle-purchase reviews, covering all five supported targets. Customer history has status filters and cursor pages; submission requires explicit rating, publication review and fresh source eligibility checks. Unknown creation outcomes remain locked. Administrator moderation uses expectedVersion, mandatory customer-visible rejection reasons and publication review; ordinary staff cannot read this queue. A public feedback page displays only the public API projection, with no fabricated reviews, author identity or aggregate rating. Five review endpoint mappings are implemented; real API ownership, moderation delivery and concurrency verification remain outstanding. Public review data currently loads in the browser; server-rendered indexable feedback remains part of the open SEO work.

## September 17 notification inbox and delivery preferences increment

Implemented the ten customer/staff notification endpoints with validated inboxes, type/category/unread filters, cursor navigation, individual read actions and reviewed all-account read changes. Both audiences can inspect and change supported operational/marketing email/SMS preferences; marketing enable requires explicit consent. Defaults follow backend delivery policy, mandatory categories stay immutable, and delivery availability is not promised. Failed reads never imply empty accounts or invented preference defaults. Unknown mutations pause affected changes, and account invalidation discards private content. Production browser checks are recorded in the validation ledger; real API ownership and delivery-provider verification remain outstanding.

## September 17 backend MFA enforcement correction

Reproduced and corrected the existing-factor enrollment bypass in the backend. Enrollment now rechecks account/session/CSRF revision and MFA eligibility under row locks; activation, recovery replacement, audit and rotation commit together. Final-factor removal and recovery replacement are also serialized. New isolated database/API regressions and the existing identity flow pass. API request/response success bodies are preserved; MFA_REQUIRED/expired-session behavior is documented and generated types updated. Real browser-to-API WebAuthn and remaining credential/session concurrency work are still outstanding.

## September 17 MFA enrollment and challenges increment

Replaced the unfinished MFA page with session-validated authenticator/recovery/security-key verification and consented TOTP/WebAuthn enrollment, covering six actual endpoints. Multiple authenticators, cancellation, single-use codes, unknown-result locks, private recovery-code display, session rotation and role-aware continuation are supported. The security pages link to enrollment. First-factor setup in a pending session requires all methods to be unavailable; server-side enforcement is now implemented in the correction above. Real isolated cryptographic verification, bootstrap authorization and browser/device compatibility remain outstanding.

## September 17 account security increment

Implemented seven account security endpoints on customer and staff security pages: password changes, active-session reads/revocation, MFA-factor reads/removal and recovery-code replacement. Credential values are excluded from review summaries and cleared after attempts; account changes discard private state. Unknown mutations are not automatically replayed. MFA enrollment/challenge UI is now implemented in the increment above; real integration validation remains outstanding. Real security API and concurrent-write verification remain outstanding.

## September 17 promotions increment

Implemented administrator promotion list/create/detail/edit and customer cart code previews using five actual endpoints. Discount settings use exact kobo and basis points, explicit Lagos windows, nullable eligibility limits and versioned edits. Customer previews are advisory and are discarded when their inputs change; checkout remains amount-authoritative. Code-less records are labelled non-redeemable, enabled is distinguished from eligibility, and usage counts are not invented. Real privileged API, usage-limit concurrency and checkout redemption verification remain outstanding.

## September 17 product compatibility and image increment

Added the six supported product compatibility/image mutations to the administrator parts editor. Compatibility supports nullable model/year boundaries and fitment notes; image records support hosted HTTPS URLs, descriptions, ordering and primary selection. Review, selected-record revalidation and uncertain-result locks precede changes. The shared branch/category/service/product editor now also guards stale edits and interrupted saves. No product upload or administrator detail endpoint was invented. Backend concurrency, actual hosted images and real privileged API journeys remain unverified.

## September 17 staff administration increment

Team & Access now includes the directory, account details, verified-customer promotion, existing-staff administrator invitations, status/revocation and authenticated fragment-token acceptance. Eleven organization endpoint mappings connect these flows and staff pickers; generic ADMIN elevation is removed. Disposable real-API tests cover MFA/CSRF/password proof, binding/eligibility, session revocation/audits and acceptance/revocation concurrency. Eighteen distinct production browser scenarios have passing results; real email delivery and final release configuration remain unverified. See dashboard-integration-handoff.md for the migration and current full-goal status.

## September 17 audit history increment

Implemented the administrator audit log with all supported filters, cursor navigation, failed-read recovery and nullable actor metadata. Before/after snapshots preserve null, false, zero, empty strings and nested JSON; partial-value and current-role labels avoid implying complete historical records. The screen cannot mutate audit events. Real administrator MFA, audit read logging and database authorization verification remain outstanding.

## September 17 operational queues increment

Added administrator processing jobs, payment exceptions and dispute records, plus links from the operations overview. Five previously unmapped endpoints now have screens with their actual filters and supported actions. Job retries and exception decisions use consequence review, revision guards and unknown-outcome recovery; disputes remain read-only because no browser decision/evidence endpoint exists. Broken backend job pagination is explicitly limited to recent records and documented for correction. Real worker execution and administrator authorization/concurrency tests remain outstanding.

## September 17 customer manual payments increment

Implemented reviewed reporting of bank transfer, POS and cash payments with optional PDF/JPEG/PNG evidence; no receiving account or payment policy is invented. Submission remains distinct from confirmed funds. Customer uploads share the tested storage transport and UI with vehicle uploads while keeping their narrower file/token contract. Input/file retention across refresh, expiry-before-submit recovery, original-key replay without evidence, unknown evidence reconciliation and corrected details after a rejected attempt are covered by the browser work. Real database/provider verification and documented backend replay/concurrency gaps remain release work.

## September 17 staff payments and refund increment

Implemented payment records with status/provider/customer filters, cursor pages, manual evidence access, administrator manual decisions, staff refund requests and an administrator refund queue. Money remains exact in integer kobo. Refund requests retain their original idempotency key/body after uncertain responses; manual and refund decisions remain locked after an unknown result. Different-operator rules and provider processing/attention/success states are explicit. Customer manual submission/upload followed in the increment above. Real staff/provider verification and documented backend concurrency/replay authorization findings remain outstanding. See the validation record for bounded browser/build evidence.

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

September 17 update: the supplied red/navy/white design is retained with Quicksand throughout. Real homepage catalogue previews replace sample product/vehicle cards, broken destinations are corrected and responsive grid styles are isolated from Tailwind utilities. Staff invoices support source-based draft creation, branch/customer/status filters, versioned issue/void and uncertain-creation recovery. Vehicle purchase progress and handovers include optional signed PDF upload and temporary private access. Vehicle stock create/edit/list/detail and listing draft/content/price/publication screens are added with version-aware draft preservation. Photo/private-document attachment, document review/access, public condition-report creation and inspection scheduling/status management are implemented. Reservation terms, report PDF retrieval and real staff API/storage verification remain unfinished, alongside the other staff domains listed in release blockers. See validation progress for bounded fixture coverage.

- Frontend lint: passed before edits.
- Frontend typecheck: passed before edits.
- Frontend tests: pre-existing failure, no test files found.
- Frontend production build: passed at baseline (18 routes); recent additions require a new build.
- Backend typecheck: passed before edits.
- Backend lint: passed before edits.
- Backend tests: 126 passed, 26 skipped; skipped database suites require explicit isolated test configuration.

## Work remaining

Implemented foundations: generated request types and 225-operation inventory; cookie/CSRF client with stale-response protection; public services/parts/vehicle discovery; booking/quotation decisions, customer vehicles, cart, orders, payments, invoices, saved items, inspections and purchase history; branch/category/service/product administration and operational queue status; contact/help/automated guide. Implemented does not mean fully verified: see [validation progress](validation-progress.md).

Remaining work includes complete staff operations, real financial/refund verification, existing auth/profile/support/security panel audit, approved vehicle reservation terms, SEO, exhaustive endpoint mapping, real isolated backend/browser verification, performance/accessibility review and final release/staging documentation. Sales aggregates are unavailable in the current API and must not be inferred from one result page.

Security/contract findings to resolve or explicitly carry into release review: customer booking serializers appear to include draft quotes (the UI hides them, which is not a data-access boundary); reservation acceptance has no published approved terms/version source; development cache headers require production verification; image hosting requires an approved allowlist. The CSP permits inline style attributes for Next/Image layout but continues to require nonces for production style elements and scripts. Invalid media hosts are discarded before entering CSP.
