# Security model

## Identity trust boundary

Browser authentication uses a 256-bit opaque session value in an `HttpOnly`, host-only,
`SameSite=Lax` cookie. PostgreSQL stores only a purpose-separated HMAC-SHA-256 digest.
Production uses the `__Host-aat_session` name and requires HTTPS; local HTTP development uses
`aat_session`. A session has both absolute and sliding idle deadlines and is revoked when the
account is no longer active.

Every authenticated mutation requires the session-bound `X-CSRF-Token`, an exact allowlisted
`Origin`, and non-cross-site Fetch Metadata. Rotating either authentication or MFA assurance also
rotates both the opaque session value and CSRF secret.

Staff, administrators, super administrators, and customers who enabled MFA receive a ten-minute
MFA-pending session after password authentication. That session is limited to session inspection,
logout, CSRF rotation, and MFA enrollment/challenge routes. Normal authenticated routes require
full MFA assurance. Enrollment is permitted without prior MFA verification only when no active
factor and no unused recovery code exists. Otherwise every enrollment preparation and activation
requires an MFA-verified session and returns `MFA_REQUIRED` for pending sessions.

Enrollment locks the account row (`FOR NO KEY UPDATE`) and then the session row, verifies its
current ownership, active status, expiry and middleware-observed CSRF digest, and rechecks the
available factors/recovery codes. Activation repeats this check after cryptographic verification.
This prevents concurrent bootstrap requests and stale requests from inheriting a later session's
verification. Activation, code replacement, audit and session rotation commit in one transaction;
a rotation failure rolls all of them back. Crypto verification runs outside the locked transaction.

Factor removal and recovery replacement use the same account lock. Privileged final-factor counts
and removal now commit atomically; the password digest is rechecked after locking. Concurrent
recovery replacements leave one complete latest set. These operations do not change the existing
policy that factor removal preserves sessions and remaining recovery codes.

The lock choice allows foreign-key checks for child rows while serializing non-key account
changes; see [PostgreSQL locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html).
The isolated regression suite is `tests/integration/mfa-enrollment-security.test.ts`. It uses unique
fixture accounts and retains append-only audit history until the disposable database is removed.

## Credential storage

- Passwords use Argon2id with a bounded 12–128 character input.
- Sessions, CSRF values, verification/reset tokens, recovery codes, WebAuthn challenges, and
  throttle identifiers are stored only as purpose-separated HMAC digests.
- TOTP secrets and identity-email payloads use separate HKDF-derived AES-256-GCM keys and carry a
  versioned key identifier.
- WebAuthn verifies the configured RP ID, exact origin allowlist, user verification, single-use
  challenge, and authenticator signature counter.
- Recovery codes are random, single-use, returned once, and atomically consumed.

## Abuse and disclosure controls

Login uses a dummy Argon2id verification for unknown users and a generic failure response.
PostgreSQL-backed email/IP and IP-only throttle keys coordinate lockouts across API instances.
Registration, resend, and password-recovery responses do not reveal account existence.

Logs redact identity, credential, cookie, CSRF, MFA, encrypted payload, email-link, and personal
fields. API projections never include hashes, encrypted secrets, full IP addresses, unrestricted
user-agent strings, provider payloads, or object keys. Security and lifecycle decisions are written
to the append-only audit log.

## Customer and organization authorization

Customer routes derive ownership exclusively from the authenticated actor. Client-provided user or
customer identifiers are rejected by strict schemas, and cross-customer lookups fail as not-found.
Privileged responses use explicit Prisma projections and never serialize complete user records.

Administrators promote an existing active, verified customer account to branch staff using MFA,
CSRF and current-password proof. Both ADMIN and SUPER_ADMIN may then invite an existing active,
verified staff account to ADMIN. Invitations bind the recipient ID/email, inviter and fixed target
role to a single-use, expiring HMAC-hashed token. Email payloads are AES-GCM encrypted in the
transactional outbox; a queued receipt does not confirm delivery. Tokens travel in URL fragments,
are removed from browser history immediately, and never appear in API responses or audit values.

Acceptance requires the intended staff account, verified MFA, CSRF, current-password proof and
explicit confirmation. The transaction rechecks account/session state, recipient email/branch and
inviter authority, consumes the invitation once, preserves credentials and revokes existing sessions.
A shared access-change lock serializes invitation acceptance, replacement, revocation and access
changes. Account/session row locks protect against concurrent identity changes. Administrators can
list/revoke their own invitations; the owner can list/revoke all. Access changes revoke pending
invitations issued to or by the affected account. Generic role edits only allow the owner to demote
ADMIN to branch STAFF; ADMIN elevation always requires invitation acceptance. Ordinary APIs never
assign SUPER_ADMIN. The forward binding migration revokes unused legacy links without deleting history.

Branches assigned to staff must be active. Active branches with active assigned staff cannot be
deactivated until those staff are reassigned or deactivated. Status, role, and branch changes use
transactional advisory locks, revoke target sessions, and append a minimal non-PII audit record.
