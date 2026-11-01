# Allie service-group knowledge and booking retry production release

Published runtime source: c158b0d0cdfe287d2c2a7a38a95da2c3e9d82f66.
Frontend: dpl_3YbAhXphEpczp6geixA8m2jU8ooC on both alliedautotech.com and
www.alliedautotech.com. Backend: 4013c48c-7428-411f-b2e4-7a501b5a96ce, ACTIVE.

## Changes and evidence

Allie retrieves current active service groups with canonical source links and
revision invalidation. Group descriptions do not imply a price or appointment.
Booking retries now reject a changed concern instead of silently returning an older
request; existing identical retry keys remain valid after staff classification.
No schema or permission changes; production capability flags were preserved.

- Exact-master frontend 41294218384, database safety 41294218381, secrets
  41294218360: successful. Branch checks also passed before integration.
- Booking fix: three native HTTP integration tests, backend types and scoped lint
  passed. Prior Allie evidence remains in OWNER_SERVICE_STRUCTURE_20261030.md.
- Four exact-source images built and uploaded. Ten packaged checks passed in
  61.27 seconds, covering non-root entrypoints, TLS handling, runtime imports,
  media decoding, isolated migration replay, separate restore and drift rejection.
- Fresh production backup verified and restored to newly created loopback database
  allied_retry_restore_20261101_adfa473c0062_ci at 127.0.0.1:63888. All 80 applied
  migration checksums matched; no pending migration. Read-only schema check passed,
  row counts and hashes stayed unchanged. No production database write or migration.
  Managed backup freshness was checked; this is not a new managed PITR rehearsal.
- Production pre/post checks verified least privilege and all seven worker heartbeats.
  Temporary database firewall entries were removed with concurrent rules preserved.
- Two hosted fixture Allie journeys passed in 22.2 seconds (390/1440): source/action
  link -> matching service group -> enquiry context, scoped Axe, no page errors or
  horizontal overflow. No paid model call or application session was copied.
- Two hosted real-data homepage checks and four post-promotion checks across both
  domains and both widths passed: full image subjects, workshop story on Home,
  About navigation, story absent from Tyre Change, no overflow/page exceptions.
  Screenshots inspected. Section screenshots include the sticky navigation overlay;
  they do not prove every focus state, physical device or authentication journey.

## Recovery and operational notes

Docker initially failed on an inaccessible sailor-ingest.sock; owner restarted it.
Registry upload first stopped at access, then at delayed tag visibility; subsequent
read-back and upload completed with verified manifest digests. No partial manifest
was used. Old build/release receipts are preserved with e8a40784 filenames.
Automatic approval review rejected integration and submission while checks were
running. Both operations were retried successfully only after those checks passed.
The frontend candidate remained held until matching backend post-health passed.

All task-created Docker test resources were removed by their test cleanup. Existing
containers, current/rollback images, shared caches, backups and the populated restore
database remain retained. C: had 27.47 GiB free at closeout; no machine-wide guarantee.

Private receipts: backend/ops/digitalocean/.private/concern-retry-* plus build.json
and release.json. Browser evidence: TEMP/aat-concern-retry-hosted,
TEMP/aat-concern-retry-candidate and TEMP/aat-concern-retry-live.

## Still incomplete

- Owner service-group ordering/media authoring, actual approved group import and
  structured category identity through booking review, persistence and staff views.
- Remaining native browser/auth/role and operational notification acceptance;
  complete policy/capability knowledge audit and full scoped catalogue coverage.
- Paystack: server PAYSTACK_SECRET_KEY and correct PAYSTACK_MODE, merchant NGN
  checkout/account eligibility, PAYSTACK_CALLBACK_URL, dashboard webhook setup,
  test-mode callback/webhook/reconciliation acceptance and separate live approval.
  Callback: https://alliedautotech.com/payments/complete. Webhook:
  https://api.alliedautotech.com/api/v1/webhooks/paystack.
- OpenAI: server OPENAI_API_KEY and ALLIE_OPENAI_MODEL, project Responses/model
  access, billing, approved budget and a new bounded real-model evaluation allowance.
  Previous allowance is exhausted. Reviewed HELP_LEARN_AI_ENABLED activation needs
  HELP_LEARN_ENABLED and ALLIE_AI_DAILY_TOKEN_LIMIT >= 32000, consistent API/worker
  settings, frontend visibility configuration and retention/customer-notice review.
- Business review of actual branch hours, closures, durations/buffers and staff or
  equipment capacity before confirmed scheduling. Preferred requests remain pending.

See docs/ACTIVATION_READINESS_20261030.md and the feature ledgers. Source publication
is not activation or proof of real provider acceptance. Full goal remains active.
