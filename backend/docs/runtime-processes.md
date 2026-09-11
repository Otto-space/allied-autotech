# Runtime process configuration

All release processes use the same immutable source revision but validate only the credentials and
providers they actually execute. Configuration is injected at runtime; it is never copied into an
image or committed.

| Process         | Required production configuration                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API             | Database settings, exact frontend/WebAuthn HTTPS origins, four independent cryptographic keys, Paystack, and private object-storage settings |
| Identity worker | Database settings, outbox encryption key, Resend key, and sender address                                                                     |
| General worker  | Database settings, outbox encryption key, enabled notification providers, Paystack test reconciliation settings, and bounded schedules       |
| Migration job   | Database settings only                                                                                                                       |

The API does not require Resend or Termii credentials because it only writes encrypted outbox
events. The identity worker does not require frontend, WebAuthn, Paystack, object-storage, session,
MFA, or asset-ticket secrets. The general worker does not require cookie/WebAuthn/private-storage
keys. Missing configuration fails process startup; optional channels must be explicitly disabled,
and enabled provider work is never silently discarded.

Every process also requires `DB_SSL_MODE=verify-full` and an absolute readable
`DB_SSL_CA_FILE` in staging/production. The Node runtime supplies that CA to `pg`, keeps
`rejectUnauthorized=true`, and retains hostname verification. Prisma migration URLs use
`sslmode=require`, `sslaccept=strict`, and the same CA path. Local development may explicitly use
`DB_SSL_MODE=disable` with no CA file. There is no plaintext fallback.

Use separate database users in staging and production: an application role with only runtime DML,
a worker role with the minimum outbox/cleanup permissions, and a migration role that owns schema
changes. Size each service's pool with `DB_POOL_MAX`; API and worker replica counts must fit below
the managed PostgreSQL connection limit with operational headroom.

`npm run check:db-tls` is a live infrastructure check. It succeeds only when the configured
certificate-verifying connection is active and PostgreSQL reports TLS for that backend. Passing unit
configuration tests alone is not evidence that a real certificate or hosted database was verified.
