# Sign-in MFA challenge atomicity - 26 October 2026

## Confirmed failure boundary

The sign-in challenge service consumed a TOTP time step or recovery code before
rotating the pending session. WebAuthn challenge consumption and counter update
committed in a separate transaction before rotation. Injecting a failure after
the real rotation write produced an error while leaving the session rotated and
the proof spent. The two TOTP/recovery regression cases reproduced this against
a newly isolated PostgreSQL database before the correction.

## Correction

The controller passes the middleware-validated session ID and CSRF digest.
Cryptographic TOTP/WebAuthn verification occurs before the database transaction;
the service then locks the active account and owned session, checks its current
status, expiry and CSRF revision, and conditionally consumes the proof. TOTP step
use, recovery-code use, or WebAuthn challenge/counter changes and authenticated
session rotation now commit in one transaction. Reused, revoked, expired or stale
proof/session revisions fail without partial writes. No schema, route, response
shape, MFA policy or frontend runtime change is required.

## Verification and limits

The new loopback-only `aat_mfa_challenge_atomicity_20261026_test` database was
confirmed empty at `127.0.0.1:55487`, then replayed all 72 migrations with no
schema difference. Three injected failures after the session rotation write now
roll back the session and TOTP/recovery/WebAuthn proof state. A fourth case sends
two simultaneous recovery-code submissions: one assures the session and one
rejected stale request. The WebAuthn rollback fixture mocks cryptographic
verification to isolate its database boundary; it does not establish genuine
browser authenticator, RP ID or origin acceptance. The full identity HTTP flow
and 20 adjacent MFA enrollment integrations passed (23 cases total in that run),
including the existing 400 response for an already-used recovery code. Backend
TypeScript and targeted lint passed. Production release, external delivery and
real authenticated-role/device acceptance remain pending.

The complete backend `npm run check` gate passed on the isolated target:
secret guard, 72-migration history/schema check, TypeScript, scripts, OpenAPI
(365 paths), route coverage (425 operations), lint, format, 577 default unit/API
tests and Prisma-config typecheck. The default run intentionally skipped 1,121
database-gated cases; the four new database cases and adjacent identity/MFA
integrations were run separately as described above.
