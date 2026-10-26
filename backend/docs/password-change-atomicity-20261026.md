# Password-change session atomicity - 26 October 2026

## Confirmed failure boundary

`IdentityService.changePassword` previously committed the new password, other-session and reset-token revocations, audit and security notification before rotating the current session in a separate write. If that rotation failed, the request returned an error after changing the credential. Two requests that had both verified the old password before either transaction committed could also overwrite one another's new credential.

## Correction

The controller now passes the session ID and middleware-validated CSRF digest as one private snapshot. The service verifies the old password before opening a transaction, then locks the active account and current session in account-to-session order. It rejects a changed credential, revoked/expired session, changed CSRF digest or missing required MFA assurance before any write. The new password, other-session and reset-token revocations, audit, in-app security notification and current-session token/CSRF rotation now commit in one transaction. A rotation failure rolls every change back. No route, response shape, password policy, schema or migration changed.

## Verification and limits

A new loopback-only `aat_password_change_20261026_test` database was created in the already isolated native PostgreSQL 18 test cluster; its host, port, database name and empty state were verified before writes. All 72 migrations replayed with no schema difference and `db:check` passed. A deterministic injected failure **after the session rotation write** rolled back the credential, both sessions, reset token, audit and notification. A gated two-request test allowed one change and rejected the stale request with 401; only one notification and audit were recorded. The full identity HTTP flow passed and verified the old cookie fails while the rotated cookie works. The adjacent MFA enrollment suite passed 20 cases, the identity unit suite passed five, and backend TypeScript, targeted lint and formatting passed. Fixtures used synthetic accounts only.

The local test does not establish production authenticated-role acceptance, physical-device browser behavior or external email delivery. The backend image and release checks are recorded below.

The complete backend `npm run check` gate also passed on the isolated target:
secret guard, Prisma history/schema check, TypeScript, scripts, OpenAPI (365 paths),
route coverage (425 operations), lint, format, 577 unit/API tests and Prisma-config
typecheck. The default test run intentionally skipped 1,117 database-gated cases;
the focused database cases above were run separately. Windows checkout converted
the generated OpenAPI and handbook files to CRLF even though the exporter emits LF,
so `.gitattributes` now keeps those exact-match artifacts at LF on all platforms.

## Production release

Runtime commit `3ec9c8223e2a2e8c74095f99cf6efcbd6b36deef` was pushed and
deployed to the existing production backend as deployment
`96ffc790-f572-49f4-9047-3ae6cb30469e` (ACTIVE). The API, identity-worker,
general-worker and migrate images were built from that clean source and passed
all nine image security/runtime checks. The packaged migration image test passed
pending/drift rejection, empty replay, schema/history verification and separate
restore using isolated `_ci`/`_test` databases. Its first invocation used the
test script's absent default image tag; rerunning it with this exact build's
migration image passed. No application database was used for those tests.

The proposed production app spec was derived from the active deployment and
independently compared: only four image digests changed. The existing-app proposal
accepted it; the new-app spec validator cannot validate an existing encrypted
secret value and was not used as release evidence. The production pre-deploy
read-only database checker and all deployment component steps succeeded. After
rollout, all four active digests matched the pushed manifest, and the remaining
app spec matched its pre-release state. Direct and custom-domain liveness and
readiness returned 200; anonymous session access returned 401; `/shop` redirected
to `/parts` and `/parts` returned 200. No schema migration, grant change,
production business write or payment action was made.

The managed database was online with eight listed backups, latest 26 October
2026 05:22:11 UTC. Existing encrypted off-device retention/PITR policy and the
separate populated 90-table restore/migration rehearsal for deployed migration
72 were reviewed; this release did not conduct a new cloud restore. Private
before/candidate/active app receipts and the prior release manifest are retained
in the ignored `.private` directory. The prior production deployment
`707a200f-17c3-4947-a0bd-21b39496cf6a` is the immediate rollback candidate,
subject to normal compatibility review. Authenticated production-role/browser
acceptance and the separate sign-in challenge rotation gap remain open.

Postflight: the isolated native test server was stopped and verified down. Its
94,288,259-byte Temp directory remains because automatic command review had
previously rejected removal of that exact task directory; no alternate deletion
was attempted. Docker has 83 images, 13 stopped pre-existing containers and all
14 pre-existing volumes. The task-created packaged-test container and internal
network were removed. Current/rollback images and warm cache were retained;
no pruning was attempted. C: had 27.76 GiB free at the final reserve check.
