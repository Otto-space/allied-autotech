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
contract repair and current browser recovery assertions. Integrate those changes
without replacing the new fixes, retaining both evidence histories and runtime
projects. Do not touch the owner's separate dirty Desktop home-hero.tsx.

Still required for full D03: accepted additions through separately reviewed
supplemental charges with no duplicate sale/credit, actual materials issue/use,
durable authorised cleared-balance vehicle release, full combined acceptance,
exact-master CI and all migration/backup/recovery/financial/provider gates.
Verified Tax ID/CAC and accountant tax applicability remain actual-owner inputs;
no fictitious identifier or approval is supplied. General returns/warranty policy
remains deferred. The wider D01-D17 implementation goal remains active.
