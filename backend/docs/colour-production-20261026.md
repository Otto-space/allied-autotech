# Colour and state production release — 26 October 2026

The owner explicitly authorised production deployment after the local colour
implementation. Runtime **d6d8534d857c073b37ccacbc648fdd4007668020** is deployed
from `release/colour-states-20261026` in `allied-shop-vehicles-r2-20261025`.

## Production identity and preservation

- Frontend: **dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD**, READY.
- Both `alliedautotech.com` and `www.alliedautotech.com` were independently checked
  through the management API and point to that deployment and exact source SHA.
- Backend remains **707a200f-17c3-4947-a0bd-21b39496cf6a**, ACTIVE, with no pending
  rollout. No backend redeployment, production migration, database connection,
  firewall/grant change or real business submission was made by this release.
- Rollback frontend: **dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln**, runtime `c4e0005d`.
  Keep the current backend and migration 72 when reverting the frontend.

Production had advanced from the colour branch's original base. Merge `f932cad9`
preserves the already-deployed workforce versioning and payment-source concurrency
changes. Only appended tracker records conflicted; both records were retained.
Backend runtime/schema/scripts and the newer workforce implementation were compared
against `c4e0005d`. The deploy adds the colour presentation without reverting them.
Unrelated worktrees and the Desktop checkout's existing edits remain preserved.

## Release gates

All gates passed on exact runtime `d6d8534d`:

- [Frontend release checks, 40401778237](https://github.com/Otto-space/allied-autotech/actions/runs/40401778237):
  locked Next 16.4.3 build, lint/types/format, **1,057 tests in 162 files**, and
  **zero production dependency audit vulnerabilities**.
- [Backend database safety, 40401833865](https://github.com/Otto-space/allied-autotech/actions/runs/40401833865):
  isolated 72-migration replay, `db:check`, safety and integration suites passed.
  These ran in the workflow's isolated PostgreSQL CI database, not production.
- [Secret guard, 40401778740](https://github.com/Otto-space/allied-autotech/actions/runs/40401778740): passed.

The first frontend gate correctly rejected the generated browser report's formatting.
The generator now resolves the repository Prettier configuration instead of using
default width; `9ba22d95` fixes the generator and report. No check was disabled.

The final protected hosted candidate passed **39 isolated fixture browser cases**:
colour states, Allie/practice, actual customer tables and Care controls, and workforce
enrolment/assignment/delegation/identity boundaries. Browser requests had an unmatched
API deny rule; fixture mutations did not reach application endpoints. Provider
authentication was separate from application authentication, and its temporary
browser cookie was removed after acceptance.

Hosted testing exposed a gallery-only hydration race. The gallery now renders an
intercepted same-origin test document using the real compiled CSS, retaining provider
asset access while preventing React from restoring the About tree. No public debug
route is shipped. The initial broader selection included stale legacy customer-support
tests; those interrupted results are not represented as an accepted suite. The final
39-case run uses the current `customers-care.spec.ts` contracts. The separate live
smoke helper also needed its Allie locator scoped to the floating trigger.

## Hosted and live evidence

Before promotion: 12 public checks passed on the frozen candidate at 390/1440px.
After promotion: the same 12 checks passed against the real public domain, covering
Home, About, Shop, Vehicles, Help, loaded campaign imagery, colour tokens, reflow,
Allie opening/keyboard closing, zero runtime page errors and zero mutation attempts.
An independent `www` About check and backend live/ready checks returned 200.
Both custom-domain deployment IDs were verified after promotion.

Evidence: `%TEMP%/allied-colour-20261026/`:

- `release-ci.json`, `frontend-final-ci.log`, `backend-final-ci.log`.
- `hosted-results.json`, `hosted-final.log`, `candidate-public-receipt.json`.
- `promotion-preflight.json`, `production-aliases.json`, `promotion.log`.
- `production-public-receipt.json`, `post-release-health.json`.
- `production-home-390.png`, `production-about-1440.png`,
  `production-trust-1440.png` and corresponding mobile/desktop captures.

These public reads contain no private customer records. Hosted fixture screenshots
remain synthetic. This is not authenticated production-role mutation acceptance,
physical-device, Firefox/WebKit or complete screen-reader certification. The three
optional cart-drawer cases in the original colour report remain unexecuted; the
enquiry-only launch policy and disabled transaction/provider settings remain intact.

## Recovery and local retention

Before promotion, the provider API confirmed eight current managed backups, newest
26 October 05:22:11 UTC. The retained populated restore rehearsal completed at
19:53:05 UTC with 90 restored tables, migration 71 → 72, and unchanged original row
hashes. That evidence was verified; no new restore was performed for this CSS release.
Managed daily backup/seven-day recovery and encryption were rechecked against
[DigitalOcean recovery documentation](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/)
and [managed PostgreSQL features](https://docs.digitalocean.com/products/databases/postgresql/details/features/).
This is retained logical-restore evidence, not a new physical PITR exercise.

No Docker image, database volume, source worktree, dependency installation or local
build was created for this rollout. Current/rollback and other-task resources were
retained. Final disk preflight: **27.86 GiB free** on C:, a point-in-time measurement.
The owner-authorised colour release is complete; broader Item 6, actual AI/human
handoff and the separate workforce roadmap remain their own unfinished scopes.
