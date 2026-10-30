# Efficient delivery production release — 30 October 2026

Published application source: e8a407844c29328d86aa9cfc3e0de3d184abfedc, integrated
into master without force-pushing. Vercel dpl_9pyC3mVfZeVLVBfJE2yQLHVc7xHA serves
both alliedautotech.com and www.alliedautotech.com. Backend deployment
c886268a-6929-4053-95b0-7930f054bdb7 is ACTIVE with all four matching source images.
Both domain identities were checked after explicit promotion.

## Verified scope

Concern booking, preferred/alternative-time handling, nullable-safe customer and
staff readers, payment observation handling, grounded public Allie retrieval, owner
service-group review/import support, customer group discovery and enquiry context
are included. Existing capability gates are unchanged: this release does not enable
live payments, model calls, live chat or otherwise expand business permissions.
No real charge, enquiry, booking or owner group import was submitted for verification.

## Evidence

- Exact-master frontend CI 41137202628, backend database-safety CI 41137202404 and
  secret CI 41137202432 passed. The earlier branch database run failed on an obsolete
  public learning article list; the one-line expectation correction passed 11 native
  HTTP cases on a fresh isolated database and the subsequent full CI.
- Local frontend: lint/types and 1,303 tests passed; 12 optional tests skipped.
  Backend: types, script types, lint, secret guard and 693 unit tests passed.
- Nine final-source image checks passed. Packaged migration replay/restore and
  pending-schema/drift rejection passed against 463df313; an exact diff verified
  that all backend runtime, migration, package and deployment files are unchanged
  in e8a40784. Only one test expectation differs. Initial local attempts with missing
  Help flags and an obsolete image tag failed; their corrected reruns passed.
- Hosted candidate: four owner-group/customer-enquiry fixtures passed at 390/1440.
  Both Allie citation/navigation journeys passed with the hosted adapter allowing
  only the exact candidate origin. Their original localhost-only network guard
  incorrectly counted same-origin hosted requests as external; those failed traces
  are retained. The adapter changes imports and that origin guard only; all behavior,
  accessibility, console, request-count and navigation assertions remain intact.
- Existing native booking, owner-import, payment and Allie evidence remains in the
  delivery/feature ledgers. Hosted browser fixtures are not real-role transactions
  or real-provider acceptance. Screenshots were inspected.

## Database and operations

Fresh production backup verified, restored into a newly created isolated local
_ci database, and both forward migrations rehearsed with original row hashes and
counts preserved. Managed backup inventory contains eight daily backups, newest
30 October; earlier managed recovery evidence is retained. This turn's populated
restore was local, not a new managed-server PITR exercise.

Protected production db:migrate and db:check passed, advancing history from 78 to
80 migrations. Runtime least privilege and backup read grants were verified without
grant changes. All seven monitored worker heartbeats were current and error-free
after rollout. Temporary database firewall entries were removed and restoration
verified after backup, migration and post-release checks. API readiness passed.

## Remaining work

The full briefs are not complete. Actual owner category import, group ordering and
imagery authoring, structured category identity across booking, Allie category
knowledge and remaining provider/role/auth acceptance remain tracked. No model
evaluation allowance was reset, no paid provider call was made, and possession of
credentials is not treated as activation acceptance. Existing Tyre pricing is preserved.

Receipts: backend/ops/digitalocean/.private/efficient-delivery-*, efficient-production-*
and efficient-release-*. Browser evidence: TEMP/aat-efficient-hosted-20261030 and
TEMP/aat-efficient-allie-hosted-fixed. Backups and populated restore proof retained;
two stopped task-only empty-test clusters were removed, logs retained. C: remained
above 22 GiB at release checks. A preflight is not a machine-wide storage guarantee.

## Post-promotion live checks

All 12 real public catalogue combinations (Parts, Services, Vehicles; 390/1440;
apex/www) passed, with no page exceptions or horizontal overflow. Tyre Change
retains the approved NGN 1,000,000 fixed price and maintained description. Live
service-group requests returned 200 and reached the expected empty-group enquiry
fallback; actual owner-group import remains pending. Screenshots inspected.
The first extra group-loading probe used an ASCII ellipsis instead of the UI
ellipsis and returned too early; the corrected settled-state assertion passed.

Removed four superseded local 463df313 preparation image references after verifying
no container consumers. Current e8a40784 and existing production rollback images,
shared caches, backups and the populated restore rehearsal remain preserved.
Host free space measured 22.93 GiB before closeout and 22.84 GiB during cleanup;
no host-space reclamation is claimed. Other processes can consume disk independently.
