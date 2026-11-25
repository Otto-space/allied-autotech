# Service catalogue experiment — 11 November 2026

Scope: extend the existing signed-out Expo application with service list, detail
and selected-service handoff. No authentication, payment, database, backend,
capability or deployment changes. Pre-existing staged changes are preserved.

## Implementation and backend contract

- `GET /api/v1/public/services`: validated public list, with UUID cursor pagination.
- `GET /api/v1/public/services/:serviceId`: current public details, matched to the
  requested UUID. The backend router, projection and OpenAPI remain unchanged.
- Explore uses the existing Screen, Card, Button, Text, feedback components and
  design tokens. Fixed integer-kobo prices use the existing money formatter;
  quote-required and missing prices/descriptions/durations remain explicit.
- Detail navigates to `/services/:serviceId/selected`. Only the ID is retained;
  no route-supplied name or price is trusted. Selection supports direct links,
  retry and return navigation. It submits nothing and states that no appointment
  has been requested or confirmed. Future booking must revalidate availability,
  server capabilities and authentication.
- List loading/empty/error/retry, pagination failure retaining earlier results,
  detail loading/error/retry and unavailable services are covered. Invalid IDs,
  mismatched identities and malformed contracts fail closed.
- No test fixture is imported by application code. Application data comes from
  the configured existing API; there is no synthetic fallback catalogue.

## Verification boundaries

Automated navigation/component tests use labelled synthetic API responses and
the actual route components through Expo Router's testing library. These are
rendered test interactions, not physical Android/iOS or real-backend acceptance.
The local API at `http://127.0.0.1:4000/api/v1` did not respond to a public-list
probe. An isolated backend URL has been requested; production was not contacted.

The first focused run passed 4 suites / 33 tests (190.936 seconds). The final
full-suite run passed 11 suites / 77 tests (47.870 seconds). Typecheck, lint,
format check and `git diff --check` passed. Android and iOS production bundle
exports both passed with offline Expo CLI, using the local API URL. Android
bundled 1,345 modules in 150.689 seconds; iOS bundled 1,351 in 170.708 seconds.
The two exports overlapped; their durations must not be added as human effort.
Initial typecheck exposed stale ignored Expo route declarations and a route-test
component signature. Expo's installed `setupTypedRoutes` regenerated declarations;
the detail route now wraps its feature component. No type assertions suppress
route checking. PowerShell blocks `npm.ps1`, so checks use `npm.cmd`.

Android ADB reported no connected devices. No iOS runtime is available on this
Windows host. Successful bundle exports are compilation evidence only. No actual
Android/iOS journey, physical accessibility, keyboard or large-text acceptance
was performed. These remain acceptance blockers alongside a reachable isolated API.
Installed Node is v26.13.0; package/CI require Node 24.x. No runtime or dependencies
were installed or changed for this experiment. Node 24 verification remains a
separate environment requirement.

## Disk and timing

Owner approved existing .NET DriveInfo checks for this session because the
documented external script is absent. Every check requires at least 25 GiB free:
20 GiB reserve plus 5 GiB growth allowance. No replacement script was created.
Initial resumed check: 27.485 GiB. Later major-stage checks: 27.469, 27.462,
27.222 and 27.209 GiB. The final cleanup checkpoint passed at 27.192 GiB. The
task-created 7,220,091-byte export directory was removed after verifying its exact
workspace path, absence of links and no running Node consumer. The ADB server
started by this task was stopped after confirming no attached devices. Warm
caches, dependencies, source and pre-existing evidence were retained. No Docker
resources were created or removed. Space measurements are checkpoints, not a
machine-wide guarantee or an attributed cleanup saving.

Resumed work began at 14:16:27 Africa/Lagos; implementation, debugging, testing
and cleanup reached the final review at approximately 14:32 (about 16 minutes).
Earlier disk-blocked waiting time is excluded. Implementation/debugging were not
separately instrumented. Measured runner/bundler durations are recorded above;
verification overlapped test authoring, debugging and documentation. This is not
a completed real-backend/device experiment and does not establish a general
AI productivity multiplier.

## Files changed

All paths below are repository-relative:

- `apps/mobile/src/api/client/index.ts`
- `apps/mobile/src/features/services/ExploreProof.tsx`
- `apps/mobile/src/features/services/contracts.ts`
- `apps/mobile/src/features/services/ServiceSummary.tsx`
- `apps/mobile/src/features/services/ServiceDetail.tsx`
- `apps/mobile/app/services/[serviceId]/index.tsx`
- `apps/mobile/app/services/[serviceId]/selected.tsx`
- `apps/mobile/tests/fixtures/services.ts`
- `apps/mobile/tests/integration/explore.test.tsx`
- `apps/mobile/tests/integration/service-journey.test.tsx`
- `apps/mobile/tests/unit/client.test.ts`
- `apps/mobile/tests/unit/services.test.ts`
- `apps/mobile/README.md`
- `apps/mobile/evidence/SERVICE_CATALOGUE_EXPERIMENT.md`
- `frontend/docs/UI_UX_QUALITY_REGISTER.md` (coverage record only)

No dependencies, authentication, payments, database schemas, AGENTS.md or
pre-existing staged changes were modified. No commit, deployment or transaction.
