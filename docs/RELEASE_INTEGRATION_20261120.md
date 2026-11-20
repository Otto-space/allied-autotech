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
