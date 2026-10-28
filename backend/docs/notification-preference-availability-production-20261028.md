# Notification preference availability release - 28 October 2026

Runtime master: `2725efea650d1f799b589054494c5beae0b921c0`.
Vercel: `dpl_Ch3kcHTq565fAMKne6hFT8NPKw7R`, READY on both
`alliedautotech.com` and `www.alliedautotech.com` after guarded promotion.
Prior frontend `dpl_5LscxLnZGRXNBorSWq3GFgfUBcGq` is retained for recovery.

## Implemented behaviour

V48: customer and workforce notification settings separately label the account's
Default/Saved/Last known preference and the service's availability. Service enabled
does not claim a particular message was delivered. Disabled channels and marketing
remain unavailable even with an On preference. Missing availability or a stale
background read shows Availability unknown. An explicit failed refresh hides the
settings until a successful retry. Existing write locks, consent, expected versions,
session checks and uncertain-outcome recovery remain intact.

Both preference components share this contract. A keyboard-accessible disclosure
explains delivery, contact details, marketing consent and required messages without
repeating future-marketing paragraphs in each row. Existing red checked controls,
white surfaces, role boundaries and permission checks remain. No backend contract,
schema, delivery feature flag, business policy or learning target changed.

Published consolidated source `a51a58b8` was integrated before this batch; favourites,
compact current-care cards, unread notification previews, Help/Learn and Allie remain
preserved. Master was fast-forwarded twice without force. Hash receipts verified all
pre-existing source and generated-contract edits in the active master checkout were
unchanged by those operations. The four unrelated dirty files in the audit worktree
remain unstaged. Two tracker recovery stashes are retained, including both sides of
the earlier append-only coordination conflict; no existing record was discarded.

## Verification

- Fresh live 390px baseline reproduced the old SMS On/default presentation alongside
  unavailable delivery. Its expected failure and screenshot are retained.
- 41 focused unit cases passed, including 12 new availability/default/stale cases
  and adjacent recovery, preview, unread-count and notification awareness cases.
- Local TypeScript noEmit, scoped lint and formatting passed. The initial optional
  data narrowing error was fixed before final checks.
- Exact master Frontend release checks: **40768336402**, success. **1,216 tests
  passed**, 12 optional browser-component cases skipped; types, lint, format and
  locked Next 16.4.3 production build passed. Production dependency audit: zero
  vulnerabilities. The installation audit still reported three development-inclusive
  findings (two moderate, one high); dependency files were unchanged.
- Exact master Backend database safety: **40768406734**, success, including its
  newly isolated CI PostgreSQL target. Repository secret guard: **40768336321**,
  success. No local or shared database test/write ran for this presentation batch.
- Final-source hosted acceptance: **30 passed**, zero failures/flakes. Customer
  widths 360/390/768/1440, managed staff 390, Admin 1440 and Super Admin 390;
  native keyboard disclosure/switch/modal interaction, focus return, hover, 44px
  switch targets, no page overflow and sampled Axe checks. Save/reload, missing
  channel data, failed explicit/background refresh and recovery were exercised.
  Adjacent cases covered consent cancellation, malformed/unknown write results,
  account changes, session/workforce boundaries, CSRF and exact request bodies.
- The initial hosted run passed 29 cases and failed one test that expected a
  background-refresh alert after requesting an explicit refresh. The test now
  exercises both distinct paths; no runtime change was needed. The corrected
  focused case and all 30 final-source cases passed. The earlier baseline runner
  also required correcting a string grep to a RegExp before execution.
- Fourteen actual public read-only checks passed on the held candidate and fourteen
  after promotion at 390/1440: Home, Privacy, Shop, About, Help, product detail and
  Allie, including navigation, artwork decoding, price typography and overflow.
  No attempted business mutation or page exception was observed.

Account data, preferences, writes and roles in authenticated browser tests were
isolated fixtures. Unmatched API calls were denied. Existing Playwright/Edge was
reused; no local preview server, browser/dependency installation or duplicate build
was created. Source equality was checked between the first and final candidate's
application code; the last change only corrected the acceptance test.

## Backend safety and retained evidence

Backend remains `3ee6748f-ed72-4c89-b9a1-f1963e891190`, ACTIVE, source `a51a58b8`,
with no pending/in-progress deployment and readiness 200. This task made no backend
deployment, schema, grant, migration, provider-message or customer-data change.
Backend source/schema/scripts match the published source. Current and prior releases
were retained. Promotion rechecked both aliases and backend immediately before
changing the frontend aliases.

Managed backup metadata was refreshed: eight retained backups, latest
`2026-10-28T05:22:10Z`. The existing encrypted off-device/retention/PITR evidence
and separate populated logical restore-and-forward rehearsal were retained and
reviewed. The 28 October rehearsal finished `2026-10-28T11:37:56.500Z`, passed,
and preserved original row hashes. No new restore or physical PITR drill was run.
See `master-consolidation-release-20261028.md` for that backend release's full limits.

Evidence: `%TEMP%/allied-delivery-preferences-20261028/` contains the baseline,
initial/final hosted JSON reports, seven final role/viewport screenshots, CI receipts,
master file-preservation receipts, promotion preflight, independently verified domain
aliases, and candidate/production public receipts. Provider-only automation state is
ignored under `backend/ops/digitalocean/.private/`; it contains no customer session
and must not be published. Previous evidence and stashes are retained.

All disk preflights passed (0.1 GiB browser allowance, 0.3 GiB remote-upload allowance).
Docker review found 53 images, 13 stopped containers, 14 volumes and 230 build-cache
entries. This task created no Docker resource; useful/current/rollback/other-task
resources were retained, with no pruning. Host free space is recorded at postflight;
concurrent changes are not attributed to cleanup or guaranteed by the preflight.

V48 is released with sampled evidence. Real private-account acceptance, physical
mobile browsers, assistive-technology testing and actual email/SMS/OS push delivery
remain unverified. The broader V01-V55 audit remains active; typography/navigation,
remaining imagery and other open ledger items are not closed by this release.
