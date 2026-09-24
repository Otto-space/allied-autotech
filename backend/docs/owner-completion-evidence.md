# Backend completion and verification evidence

24 September 2026. This report concerns the backend working tree and private staging handoff. It does not assert a deployed service, public launch approval, live settlement or verified third-party configuration.

## Verdicts

**Code:** the implementable owner-policy and backend work is delivered, with additive migrations, explicit approval gates, existing security/architecture retained, and executable acceptance evidence below. No known unresolved acceptance failure is accepted as completion; the final results section is the verification record.

**Private staging:** code and configuration are prepared for a controlled, synthetic-data deployment. Hosted readiness is conditional on building the Docker targets and completing the external checklist. Nothing was purchased, deployed or activated. Pending owner policy does not enable the affected operation: vehicle deposits, unconfigured delivery/capacity, live finance, marketing and destructive retention remain gated.

**Public live:** not ready. Owner/accountant/legal decisions, actual staff mappings, provider verification, ingress restrictions, backup/restore and operational responsibility remain outstanding. The existing frontend still has older booking-deposit assumptions and requires a separately scoped update before exposing the revised customer flows.

## Delivered changes

- Seven additive migrations; 40 total replayed. Versioned owner policies, immutable financial provenance, narrow capabilities, refund completion/evidence controls, booking request/reminder changes, VAT snapshots, support/consent/privacy/aftercare/dispute records, shared rate counters and persisted worker health.
- Strict product expiry and single durable late-capture reversal; verified payment required before fulfilment. Refund claims commit before provider submission; unknown outcomes remain committed for reconciliation and are never blindly resubmitted. Disputes are checked again at approval/dispatch so a later chargeback cannot be ignored.
- Four distinct actors for bank refund request/approval/transfer/check, encrypted beneficiary, private verified evidence and a single ledger debit only after checking. Rejected evidence stays visible and may be rechecked after investigation without another transfer.
- Staff-confirmed, capacity-checked booking requests; free cancellation; one-hour transactional reminders and purpose-bound GET screen/POST actions. Reviewed returns/cancellation fees, exact seven-day quote issue, draft exclusive VAT and production accounting gate.
- Support business calendars, explicit acknowledgement, durable escalation; private dispute evidence/deadlines; consent withdrawal checked at dispatch; marketing and destructive deletion disabled; privacy holds. Operational alerts close when the recorded underlying condition resolves.
- Shared hosted PostgreSQL rate limits and explicit proxy trust; API binds `0.0.0.0`; safe startup errors; separate API/identity/general/migration processes; secure CA decoding; per-component deployment configuration.
- Updated OpenAPI and mounted-route verification; owner-policy matrix, examples, exact environment inventories/matrix and deployment/bootstrap/rollback runbook. [Changed-file inventory](owner-changed-files.txt) lists backend changes. Existing unrelated frontend changes were preserved.

## Verification record

| Check | Final result |
| --- | --- |
| Main unit/API/integration/migration suite | **249 passed, 3 skipped; 64 files passed, 1 skipped** in 159.39 seconds. The three intentional skips are the separate fresh-database owner suite below. Log: `.tmp/owner-verified-suite.log`. |
| Sole-owner provisioning and concurrency | **3 passed** in its own newly migrated `aat_owner_20260924_owner_final_test` database, 3.08 seconds. Log: `.tmp/owner-last-provisioning.log`. |
| Combined acceptance cases | **252 distinct tests passed**, with no remaining failed or unexecuted case across those two runs. Earlier fixture failures were corrected without disabling tests or relaxing database constraints. |
| Static/release checks | Build, application TypeScript, script TypeScript, lint, formatting, Prisma config typing, OpenAPI and route coverage, and secret guard all passed. Latest formatting log: `.tmp/owner-last-format-check.log`. Release logs: `.tmp/release-*.log`. |
| Migration replay/status | **40 migrations successfully applied** on newly created empty test databases, including the seven additions; status up to date. Latest fresh replay: `.tmp/owner-last-replay.log`. |
| Prisma model/database comparison | **Empty migration / no schema drift** after declaring all 22 added foreign-key relations in the Prisma model. No database constraint was dropped. Log: `.tmp/owner-schema-diff-final.log`. |
| API contract coverage | **265 documented operations across 221 paths** match mounted routes; four explicitly excluded infrastructure routes. All ten handoff HTTP examples match documented method/path pairs. |
| TLS and CA helper | Local TLS success/wrong-hostname/untrusted-certificate cases passed in the main suite. CA entrypoint syntax, decode/unset and four rejection scenarios passed with a disposable destination. |
| Compiled runtime smoke | API live/ready/capabilities HTTP 200; API and both workers exited zero on emitted SIGTERM; seven enabled tasks recorded successful persisted heartbeats. Provider and messaging execution were disabled. |
| Secret guard and whitespace | Secret scan passed across **896 non-ignored files**; backend `git diff --check` passed. Deleted frontend assets were tolerated without restoring or altering them. |
| Docker / actual cloud and providers | **Not executed / not certified.** The Linux Docker daemon was unavailable; no provider credentials or cloud resources were fabricated. Complete the external checks below. |

Local test databases created for this work: `aat_owner_20260924_01_test`, `aat_owner_20260924_02_test`, `aat_owner_20260924_owner_test`, and `aat_owner_20260924_owner_final_test`. Only disposable synthetic fixtures were used; the populated application database was not reset or used for tests. Applied migrations were not rewritten. Owner bootstrap tests use their separate database because owner protection must not be disabled to reset a fixture.

Representative PowerShell commands, run inside `backend`:

```powershell
$env:NODE_ENV='test'
$env:DB_NAME='aat_owner_20260924_02_test'
npm run test:db:create
$env:CONFIRM_EMPTY_MIGRATION_DATABASE='true'
npm run test:migrations
$env:RUN_DATABASE_TESTS='true'
$env:TEST_DB_NAME='aat_owner_20260924_02_test'
npx --no-install vitest run --maxWorkers=1 --testTimeout=60000 --reporter=dot
```

Migration replay intentionally refuses an already populated database; use a newly named `_test` database to reproduce that step. To reproduce the separate owner test, create/migrate its own fresh database, set `TEST_DB_NAME` to it and `RUN_OWNER_PROVISIONING_TESTS=true`, then run `vitest run tests/integration/owner-provisioning.test.ts`. No hosted process should receive these flags.

Static commands: `npm run prisma:generate`, `npm run typecheck`, `npm run check:scripts`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:prisma-config`, `npm run check:prisma`, `npm run openapi:export`, `npm run check:openapi`, `npm run check:routes`, `npm run check:secrets`; backend `git diff --check`. Prisma drift command: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` against the isolated database.

The local TLS acceptance test generates a disposable self-signed endpoint and exercises the runtime TLS configuration. It accepts the trusted hostname and rejects the wrong hostname and an untrusted certificate. Prisma URL strict-TLS parameters are tested separately; real Managed PostgreSQL/Prisma TLS verification remains external.

The CA shell helper passed syntax, successful base64 decode/secret-unset, invalid base64, conflicting source, wrong destination and invalid material cases using a temporary destination substituted into a test copy. Docker was not built because the local Linux Docker daemon was unavailable. The App Platform template passed structural checks (one API, two workers, one PRE_DEPLOY, unique scoped keys, no test flags); it has not been submitted to DigitalOcean.

Compiled Node API/identity/general entrypoints started against the disposable owner-test database with messaging/providers disabled. API live/ready/capabilities returned HTTP 200; all seven enabled worker tasks persisted successful heartbeats. Each process exited zero after an internally emitted SIGTERM event. Actual Linux container/ingress shutdown and platform restart behavior still require the hosted checks.

Provider money movement, storage and delivery tests use explicit contract mocks. They prove local state transitions, authorization, concurrency and payload handling, not provider acceptance, inbox delivery or bank settlement. Existing Node experimental WebCrypto and pg concurrent-query deprecation warnings remain dependency diagnostics; tests and checks are not silenced or disabled.

## Required external checks and material limits

1. Build all four Docker targets with the documented `backend` context; push immutable digests; validate/deploy the private App Platform copy. Demonstrate PRE_DEPLOY failure prevents rollout and test rolling compatibility. No cloud resources were provisioned here.
2. Verify runtime and migration roles against actual Managed PostgreSQL using the real CA, including wrong-CA/wrong-host failures. Check trusted sources, pool budget, least privilege, backups and restore. Local replay does not prove cloud IAM/network configuration.
3. Configure Paystack test callbacks/webhooks; verify raw signed callbacks, replay/reordering, reference/amount/currency mismatch, refund pending/processed/failed/unknown states and dashboard reconciliation. Sandbox limitations require an operator record. Keep Monnify disabled; its existing sandbox adapter is not certified for a new live launch.
4. Test private Spaces ticket completion, object metadata, expiry and cross-account isolation against the actual bucket. Verify Resend/Termii senders and controlled tester allowlists; no real messages or invitations were sent during this work.
5. Prove trusted client IP through the actual Vercel/Cloudflare/App Platform chain and default platform host. Keep hosted docs disabled, business access private and signed webhook paths reachable without interactive login. Confirm browser cookie/CSRF/WebAuthn behavior through the existing same-origin rewrite; test two API replicas with shared counters/sessions.
6. Map real verified MFA accounts to narrow duties, configure approved workshop capacity/calendars and actual escalation recipients. Resolve the [owner questions](owner-decision-checklist.md). Do not mistake a draft/test calculation for a published promise.
7. Update frontend booking wording/state handling separately; consume capabilities, VAT totals and server expiry. New backend staff workflows have no newly built UI in this task. Existing slot-window/reschedule constraints remain repository operational choices and should be reviewed with the owner before public launch.
8. Aftercare approval leaves stock adjustment and money movement as separate audited staff actions. Fee/partial/return exceptions require a reviewed basis; no automatic refund/credit amount or collection return deadline is invented. Bank due dates require the approved anchor/calendar. Dispute evidence is submitted in the provider dashboard and its receipt recorded, not automatically filed by this API. Unknown refund outcomes and disputed evidence require operational reconciliation.

[Implementation matrix](owner-implementation-matrix.md) ? [Staging runbook](owner-staging-runbook.md) ? [Exact environment matrix](runtime-environment-matrix.md) ? [Example requests](owner-api-examples.http)
