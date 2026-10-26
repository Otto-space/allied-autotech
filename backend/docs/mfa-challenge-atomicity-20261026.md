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
TypeScript and targeted lint passed. Production release is recorded below;
external delivery and real authenticated-role/device acceptance remain open.

The complete backend `npm run check` gate passed on the isolated target:
secret guard, 72-migration history/schema check, TypeScript, scripts, OpenAPI
(365 paths), route coverage (425 operations), lint, format, 577 default unit/API
tests and Prisma-config typecheck. The default run intentionally skipped 1,121
database-gated cases; the four new database cases and adjacent identity/MFA
integrations were run separately as described above.

## Production release

Runtime commit `8b583921914eca40a5e07524face24f04c1a8f65` was pushed and
deployed to the existing production backend as deployment
`50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3` (ACTIVE). All four images were built
from the clean source; nine image security/runtime checks passed. The packaged
migration image passed isolated pending/drift rejection, empty replay,
history/schema checks and a separate restore. No application database was used
for those tests.

The existing-app proposal accepted the candidate. Independent comparison before
and after rollout found only four image-digest changes; the remaining app spec,
including environment and component settings, was unchanged. The production
PRE_DEPLOY read-only database checker and all 24 deployment steps succeeded.
After rollout, the four active digests matched the pushed manifest. Direct and
custom-domain liveness/readiness returned 200; anonymous session and MFA verify
requests returned 401; `/shop` redirected to `/parts` and `/parts` returned 200.
No schema migration, grant change, production business write, payment action or
frontend release occurred.

The managed database was online with eight listed backups through 26 October
2026 05:22:11 UTC. Existing encrypted off-device retention/PITR policy and the
separate populated 90-table restore/migration rehearsal for migration 72 were
reviewed; this release did not perform a new cloud restore. Private
before/candidate/active app receipts and the prior release manifest are retained
in the ignored `.private` directory. The prior production deployment
`96ffc790-f572-49f4-9047-3ae6cb30469e` is the immediate rollback candidate,
subject to normal compatibility review. Genuine browser-to-API WebAuthn,
authenticated production-role/device and external delivery acceptance remain
open.

Postflight local hygiene: C: had 27.12 GiB free against the 25 GiB preflight
threshold. Docker retained 87 images (13.13 GB), 13 stopped containers, 14
volumes and 195 warm build-cache records (9.433 GB). No broad prune or image,
container or volume deletion was performed: current/rollback releases, other
tasks' resources and reusable layers remain protected. The isolated native
test cluster was stopped; its task-owned temporary directory remains retained
after automatic command review rejected its deletion. These measurements do
not establish a machine-wide disk-space guarantee.
