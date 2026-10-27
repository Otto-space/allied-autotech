# Inventory reservation replay: production release, 27 October 2026

The production backend now replays an authorised inventory reservation by its
original idempotency key after the requested expiry. A genuinely new expired or
over-seven-day request still returns 422 before stock changes; a changed request
with the old key returns 409. Replay does not extend the expiry or alter stock.

## Source and verification

- Hotfix source `3bb51d21bc723187911be88b9b1d1ba7a85df419` was based on the
  previously active production backend source `8b583921914eca40a5e07524face24f04c1a8f65`.
  It contains the five inventory source/test changes only, with no schema change.
- A fresh isolated PostgreSQL 18 `_ci` database replayed all 72 migrations from
  this exact source with no Prisma schema difference. The real Phase 4 inventory
  HTTP flow passed, including expired-key replay. Seven focused/adjacent unit
  tests, backend typecheck, scoped lint and formatting passed.
- GitHub backend safety run `40436753021` and secret guard run `40436752977`
  passed for the exact hotfix source.
- All four required backend images were built from the clean source, pushed to
  the existing registry, and checked by nine image/runtime cases and the packaged
  migration image safety test (isolated replay, drift rejection and restore).

## Production promotion

- Prior ACTIVE deployment: `50b5f5d1-50f6-4bf2-a9d0-f0c4975e02b3`.
- Current ACTIVE deployment: `71c5e9a7-bd3c-46c4-a503-cef24761837e`, completed
  at 02:29 UTC on 27 October 2026. All deployment steps report success.
- The candidate was derived from the current provider spec after confirming it
  matched the active deployment. Reverse comparison proved that only four
  immutable image digests changed. The previous and candidate specs and provider
  response are retained privately for rollback; no capacity, environment,
  provider, payment, database attachment or pre-deploy command was changed.
- Production confirms all four component digests match the release manifest.
  The pre-deploy job remains the read-only database safety check. Direct API
  liveness and readiness each returned 200. Public `/shop` resolves to the
  working `/parts` catalogue with HTTP 200.
- No production migration, inventory write, customer action or payment-provider
  call was made by these release checks. Payment providers remain disabled.

## Remaining acceptance

The production release proves deployment identity and health, while an actual
authenticated staff/customer reservation replay against a controlled production
record is still unverified. Avoid altering a real customer's stock or reservation
solely for a smoke test. Full P0 reconciliation migration/release, provider sandbox
and financial-row acceptance remain separate. The managed production backup was
restored successfully into an isolated target before this release, but its snapshot
had zero financial rows; populated financial restore behaviour remains unverified.
