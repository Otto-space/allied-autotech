# Audit log workspace contract

Implemented and locally accepted for `/admin/audit` on19 October2026, milestone92. See the [acceptance report](../../frontend/docs/page-quality/work-audit.md). Deployed and application-wide acceptance remain open.

## Current access and transaction boundary

`GET /admin/audit` retains Admin/Super Admin authorization, verified privileged sessions and private no-store responses. The service now uses the existing organization access lock to recheck the current actor/session inside the transaction that collects the safe page and appends its minimal READ event. A suspended actor or revoked session cannot use an earlier authenticated actor object to read the collection. A failed transaction cannot return a successful page without its access audit.

The repository accepts an optional transaction client for this collection. Other operational queries are unchanged. No endpoint, query parameter, response DTO, permission enum, database schema or migration was added. Existing OpenAPI and generated declarations remain applicable.

## Preserved discovery and privacy

Supported filters are action, entity type, exact user UUID, exact entity/request references and optional ISO date bounds. Both bounds must be ordered and span at most90 days; either bound alone is supported. Results sort by creation time then UUID descending. The frontend requests25 records and retains cursor history within the visit. Private filter references remain out of URLs.

Returned actor facts are the user reference and current role only. The DTO does not expose actor names/email, historical roles, IP addresses or user agents. Nullable before/after objects contain selected recorded fields, not complete resource snapshots. The UI retains escaped, lazy, keyboard-scrollable JSON and validated links to supported current records. There is no individual-event read, edit, delete or export endpoint, and the page offers none of those unsupported controls.

Each successful collection read appends `READ` with `newValues: { resource: "AUDIT_LOG", resultCount }`. Opening event details or recorded values uses the already loaded record and sends no additional request.

## Isolated verification completed

Two API scenarios passed. They cover combined filters,25+3 tied-time pages, exact safe DTO/private headers, precise READ audit counts, invalid range/enum validation, Staff denial, incomplete MFA, suspended current actors and revoked sessions. Browser development coverage has19 passing scenarios and eight focused units, including existing escaping, keyboard, session-change, filter and role regressions.

Before writes, the actual target was confirmed as `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, with `NODE_ENV=test` and a non-elevated runtime role. Only a new synthetic administrator,28 synthetic audit records and owned temporary sessions were created. The synthetic administrator was restored after its suspension assertion. Whole-row hashes preserved all original business and audit rows. Owned temporary sessions were removed and their remaining count verified as zero; synthetic fixtures are retained.

The isolated database's60-migration replay/check and runtime ownership/schema/TRUNCATE restrictions were verified at milestone89. No schema change warrants repeating that replay here. No application/shared database, existing grant, backup/restore, off-device recovery verification, external provider, push or deployment operation ran. Shared/production rollout remains subject to [database-safety.md](database-safety.md).

## Connected production verification

Production Next.js, Edge, the real Express API and isolated PostgreSQL verified all combined filters,25+3 tied-time pages, Previous, request-free event/value disclosures and mobile refresh. Five collection requests produced exactly five READ audits. The page sent zero domain mutation requests and retained no private filter references in its URL. There were no page errors or mobile overflow.

Whole-row hashes preserved58 users,7 customer profiles,52 staff profiles,38 branches,18 invitations,13 outbox events,1 capability grant,14 workforce-access rows,16 assignments and all305 original audit rows. The one owned temporary session was removed, with zero remaining verified. No retained fixture was recreated for this connected phase.

All19 production browser scenarios, eight units, production build/standalone preparation, focused static checks, final four-width native comparison and eight matching source hashes pass. Existing generated-contract and migration evidence was reused because those contracts did not change. Evidence lives under `C:/Users/PC/.codex/work-audit-{real,final,api-tests,build,source-hashes}*`.

ADM-59 records the implemented current-actor transaction boundary. There is no newly required endpoint or storage gap for this page. Broader policy, provider, recovery and deployed-environment gaps remain in the root implementation register.
