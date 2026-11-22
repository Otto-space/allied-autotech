# Allied AutoTech integrated release candidate — 20 November 2026

This review candidate integrates draft PR #106 (booking, Home and fragment navigation), #108 (Paystack timestamped webhook verification), and #110 (People/mobile navigation), plus an initial white/red/charcoal palette pass.

## Scope and verification

- Source tree before this release note: `ff579fbde00e3d2848973b2c460640855d121ae1`, reproduced exactly from the local combined candidate.
- Local frontend: 1,613 Vitest passed (12 skipped), lint, TypeScript and Next.js production build passed; formatting passed after journal repair.
- Local backend: TypeScript and 22 focused Paystack/security cases passed with a generated Prisma client and dummy, isolated configuration.
- Exact signed-head GitHub Actions, browser matrix and role-aware acceptance still required.
- Shared color aliases are charcoal/red/white; a full audit of remaining hard-coded blue-grey CSS is pending. Do not claim all-route visual acceptance.

## Production hold points

No live booking acceptance, payment processing, provider configuration, customer messaging or schema mutation was performed by this candidate.

Before master integration or publication: check exact-head frontend, backend safety and secrets CI; verify real signed-in customer/role journeys against a connected backend; verify Paystack test-mode timestamped webhook authenticity, replay/clock bounds, idempotent reconciliation and failed/pending outcomes; confirm production migration state and host; make and verify a fresh off-device backup and rehearse a populated restore to a distinct isolated target; verify runtime image and rollback compatibility. Keep live Paystack flags off until the test-mode gates succeed.

The user authorised master integration and production publication on 20 November 2026 subject to these safety gates. Do not promote a failing or untested candidate.

## 21 November staging-only source consolidation

The isolated staging candidate merges the reviewed integration head
`4cec7907165720fea12f7c4fae38b4ac376f9d1b` with the later release-validation
head `365bf077e212a2b7a5926959a17fa25421673d7f`. This preserves the
integration's booking, Paystack-signature, People and charcoal updates while
carrying forward the independent delayed-script fragment-navigation fixes and
native-first deployment validation. The source branches and production remain
unchanged.

Three textual conflicts were reconciled: both chronological release histories
were retained in their existing journals, and Home's fallback label now uses
`--text-secondary` from the integrated charcoal palette (contrast approximately
4.87:1 against `#edf1f5`). The existing migration SQL and reviewed checksum
bytes were not changed. `npm run check:deployment` passed 54/54 native contract
cases without Docker, database access or provider writes.

This is staging preparation, not a deploy receipt. The resulting exact signed
source must still pass GitHub frontend, database-safety and secret checks, the
backend images must match that source and the already-restored 132-migration
staging database, and real signed-in booking/Paystack test-mode acceptance must
be performed before any master or production promotion. Leave live payment
flags disabled and preserve production aliases and databases.
