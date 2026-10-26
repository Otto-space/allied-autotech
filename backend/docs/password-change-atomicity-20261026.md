# Password-change session atomicity - 26 October 2026

## Confirmed failure boundary

`IdentityService.changePassword` previously committed the new password, other-session and reset-token revocations, audit and security notification before rotating the current session in a separate write. If that rotation failed, the request returned an error after changing the credential. Two requests that had both verified the old password before either transaction committed could also overwrite one another's new credential.

## Correction

The controller now passes the session ID and middleware-validated CSRF digest as one private snapshot. The service verifies the old password before opening a transaction, then locks the active account and current session in account-to-session order. It rejects a changed credential, revoked/expired session, changed CSRF digest or missing required MFA assurance before any write. The new password, other-session and reset-token revocations, audit, in-app security notification and current-session token/CSRF rotation now commit in one transaction. A rotation failure rolls every change back. No route, response shape, password policy, schema or migration changed.

## Verification and limits

A new loopback-only `aat_password_change_20261026_test` database was created in the already isolated native PostgreSQL 18 test cluster; its host, port, database name and empty state were verified before writes. All 72 migrations replayed with no schema difference and `db:check` passed. A deterministic injected failure **after the session rotation write** rolled back the credential, both sessions, reset token, audit and notification. A gated two-request test allowed one change and rejected the stale request with 401; only one notification and audit were recorded. The full identity HTTP flow passed and verified the old cookie fails while the rotated cookie works. The adjacent MFA enrollment suite passed 20 cases, the identity unit suite passed five, and backend TypeScript, targeted lint and formatting passed. Fixtures used synthetic accounts only.

The local test does not establish production authenticated-role acceptance, physical-device browser behavior or external email delivery. The change is a backend runtime correction and requires the normal backend image/release checks before production acceptance.

The complete backend `npm run check` gate also passed on the isolated target:
secret guard, Prisma history/schema check, TypeScript, scripts, OpenAPI (365 paths),
route coverage (425 operations), lint, format, 577 unit/API tests and Prisma-config
typecheck. The default test run intentionally skipped 1,117 database-gated cases;
the focused database cases above were run separately. Windows checkout converted
the generated OpenAPI and handbook files to CRLF even though the exporter emits LF,
so `.gitattributes` now keeps those exact-match artifacts at LF on all platforms.
