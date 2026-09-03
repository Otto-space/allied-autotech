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
full MFA assurance.

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

Privileged accounts are created only through single-use, HMAC-hashed invitations. Invitation email
payloads are AES-GCM encrypted in the transactional outbox, and the raw token exists only in the
frontend fragment link. Admins may invite and manage staff; only a super-admin may invite admins or
change staff/admin roles. Ordinary APIs never create super-admins.

Branches assigned to staff must be active. Active branches with active assigned staff cannot be
deactivated until those staff are reassigned or deactivated. Status, role, and branch changes use
transactional advisory locks, revoke target sessions, and append a minimal non-PII audit record.
