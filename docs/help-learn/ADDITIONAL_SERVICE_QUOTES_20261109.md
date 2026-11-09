# D03 additional-work quotation checkpoint

This is unpublished source, not activation of payments or the complete D03 journey.
It extends the accepted-work checkpoint on 729b6a48 without rewriting original
agreements, issued invoices, payments, staff permissions or customer history.

## Journey and safeguards

Authorised staff explicitly choose additional work, supply a customer-visible
reason and review only the new itemised scope. The server derives the original
invoice from the locked booking; a client cannot choose an unrelated invoice.
The current booking version is required. Draft revisions preserve the old row
and parent binding. Issuing another pending addition supersedes only pending
additions, never the accepted original or an accepted addition. The existing
seven-day issue validity and financial-policy gate remain unchanged.

Customers review the original invoice reference, quotation version, reason and
items before a separate accept/reject action. Acceptance sends those exact facts
along with the optimistic revision. Missing/mismatched acknowledgement is refused;
cached old clients cannot silently accept additional work through the old payload.
The private server-recorded acknowledgement binds the actual customer account and
is omitted from customer/staff response projections. It is immutable. Acceptance
does not change the booking's original price, source invoice, original quotation,
existing payment or work authorisation. The addition still needs a separate
reviewed supplemental charge before it can join authorised work.

Migration 101 adds nullable original-invoice/reason binding and preserves one
accepted original quotation per booking while allowing separately accepted
additions. Original invoice snapshots explicitly select the original scope.
Migration 102 adds private explicit consent and a database guard against rewriting
an invoiced original booking price. An old runtime cannot accept an addition
without the new acknowledgement, including an equal-price addition. Historical
consent is not fabricated/backfilled. Existing migrations are untouched. Neither
new migration has been applied to an application/shared/production database by
this task; compatible recovery and normal release safeguards remain mandatory.

The editor uses existing form, review, draft recovery, API and permission controls.
Its reason field receives focus/nearest scrolling only after a real selection,
not on draft restoration or refresh. Customer and staff cards explain the addition
and preserve the original invoice reference. Incomplete agreement context fails
closed. Guide service-request v32 and restricted financial-policy-work v8 preserve
existing eligibility and twelve-step public bound; no guide grants a permission.
No payment/provider, AI or learning flag is enabled.

## Actual evidence

Artifacts are under `%TEMP%/aat-d03-service-payments-20261109/`.

- `native-explicit-additional-quotes.log`: 135/135 in ten files, 77.95 seconds,
  fresh isolated tmpfs PostgreSQL 18 `_test`, 102-migration empty replay, schema
  diff and db:check, non-owner CRUD runtime with no DDL/TRUNCATE authority.
  Covers actual authenticated HTTP author/issue/read/accept/reload, CSRF refusal,
  wrong ownership, stale versions, missing/mismatched acknowledgement, immutable
  consent, original amount/invoice preservation, direct old-style writer refusal,
  legacy credit, payment stages, original-source documents and learning eligibility.
  The exact owned container was removed; all shared containers/volumes preserved.
- Earlier schema-101 run passed 134/134 after correcting the original global
  accepted-quote index to preserve the original-only invariant. The first attempt
  had five failures (three original index conflicts and two guide-version
  assertions during a changing-source run); it is not a passing gate.
- `browser-additional-quotes-explicit-results.json`: 9/9 serial local Edge cases
  at 320px/1440px. Staff selection/required reason/review Back/save/issue/reload,
  customer review Back/explicit accept/reload, incomplete-context refusal and
  four existing editor/detail viewport regressions. Zero captured page/console
  errors and no relevant Axe violations; no horizontal page overflow. Synthetic
  fixture data, booking capability enabled, payments disabled. These do not prove
  live role, provider, production build, Safari or physical-phone acceptance.
- The first browser attempt had cold compilation/missing capability fixture
  failures and was stopped. The next had ambiguous status locators, three missing
  fixture reads causing nine 404 console errors, and an invalid assumption that
  existing quotation agreements are blocked by new-booking capability flags.
  Corrected fixtures/locators preserve strict console checks and existing policy;
  no assertions/timeouts were relaxed and no live flags changed.
- Scope/guide regressions: 32/32 in four files. New frontend parsing/form units: 2/2 passed. Contract export/validation:
  452 paths and 532 mounted operations, with regenerated frontend client types.
  Source backend/frontend types, full backend lint, scoped frontend lint and the
  3,904-file secrets guard pass.
  Bare contract/Prisma commands initially refused missing DB environment before
  any connection; corrected local generation/contract-only environment was used.

## Integration and remaining work

Fresh remote inspection found master 9c219bc8 beyond the previously integrated
885010a6: workforce narrow-screen improvements, managed alternative-time query
contract repair and current browser recovery assertions. Merge e91e4a82 integrates
that source after checkpoint 5ea9b64b. Only the two evidence registers conflicted;
both complete histories were retained. All ten imported workflow/routing/UI/test
files checked against 9c219bc8 match byte for byte. Runtime configuration retains
both workforce coverage and the D03 stage/additional-quotation projects. The
owner's separate dirty Desktop home-hero.tsx is untouched (79 added lines remain).

The merged source passes frontend nonincremental/backend types and full backend
lint. `browser-additional-quotes-integrated-results.json` passes the same 9/9,
90 seconds, with unchanged assertions/timeouts. Element screenshots revealed
fixed-overlay capture artifacts; final evidence uses the actual viewport with
an explicit header offset rather than styling away the real dock/navigation.
`native-integrated-additional-quotes.log` passes 235/235 in sixteen files on
merged e91e4a82 (281.15 seconds), including the newer managed day-query HTTP
acceptance, payment capture/accounting and concurrency, booking attendance,
reschedule/concern journeys and the D03 obligations/consent. All 102 migrations
replay, schema diff/db:check and restricted-runtime checks pass. The exact owned
tmpfs target was removed. This is isolated synthetic acceptance, not a production
migration, live staff acceptance, provider acceptance or backup/restore rehearsal.
The original 100 migration files match master exactly; the two new forward
migrations are the sole migration diff.

Still required for full D03: accepted additions through separately reviewed
supplemental charges with no duplicate sale/credit, actual materials issue/use,
durable authorised cleared-balance vehicle release, full combined acceptance,
exact-master CI and all migration/backup/recovery/financial/provider gates.
Verified Tax ID/CAC and accountant tax applicability remain actual-owner inputs;
no fictitious identifier or approval is supplied. General returns/warranty policy
remains deferred. The wider D01-D17 implementation goal remains active.

## Local resource boundaries

Reused the existing worktree, dependency junction, warm Next cache and installed
Edge; no dependency/browser install, worktree, image pull or build was created.
Operation-specific preflights reserved 0.15 GiB for browser logs/screenshots,
0.25 GiB for tmpfs-test tooling/logs and 0.3-0.6 GiB for the reused preview.
The mandatory 20 GiB reserve was unchanged. Both previews and synthetic read-only
capability fixtures are stopped after verification; only Next's verified generated
heading mutation in frontend/AGENTS.md is restored. All owner instructions remain.
No source branch, shared cache, image, volume, application database, recovery
resource, secret or session/history store was deleted. All fourteen pre-existing
containers and useful current/rollback/other-task images/caches are retained.
Docker logical sizes are not Windows physical bytes reclaimed. The owner's reserve
is a preflight rule, not a machine-wide quota over other applications.

Final viewport capture run (`browser-additional-quotes-viewport-results.json`):
three cases pass; the staff 320px case completes the business assertions/reload but
times out in preview-console.ts:46 while re-fetching the preloaded same-origin
not-found stylesheet. The unchanged focused rerun
`browser-additional-quotes-mobile-rerun-results.json` passes 1/1 (55.1 seconds,
same 60-second deadline, strict console verification retained). Do not count the
failed four-case attempt as 4/4. The earlier merged nine-case run remains 9/9.
Final customer 320/1440 and staff 1440 viewport captures plus the focused staff
320 capture were inspected. All are synthetic. Fixed navigation and the help/
Whatsapp dock remain present; screenshots do not hide or restyle them. A visible
Version field is asserted in customer review. Runtime CI discovery selects the
five new agreement cases; discovery alone is not hosted browser execution.
