# Mobile scaffold evidence — 9 November 2026

Status: scaffold-only implementation concluded. The owner-approved compiler isolation now passes all requested local checks, including Expo Doctor 20/20 without suppression. External/device acceptance limits remain below. No P0-A work, publication or backend changes are authorized.

## 1. Source and reconnaissance

- Branch: `feat/mobile-scaffold`, reused as requested; no push or merge.
- Local master: `80e95a386afeba3450cc5e66ed9afab421f52e65`, identical to the
  audited reference. HEAD: `02adf99d2adef58dcd11b0640ced036d30869df7` adds the four
  mobile planning documents (1,760 lines in committed master-to-HEAD diff).
- Current remote master and PRs #20/#22/#23: **unverified**. Read-only remote
  GitHub access was denied by the sandbox; the escalation request was declined.
  No dependency on those PRs, attendance migrations or work-review behavior.
- Canonical OpenAPI last-change commit:
  `1a8522f828f6308c9d9eb431fa4cb63dc243f70f`, recorded in generated types.
  Local inspection confirms OpenAPI 3.1, relative `/api/v1` server, 446 paths,
  522 operations, 16 operations without a JSON 2xx schema.
- No production capability/deployment readback: the scaffold's explicit ban on
  production contact takes precedence over the starting prompt's request to
  confirm current production mode. Current deployed launch mode is **unknown**.
- No real backend was started or used. A loopback health attempt on local port
  5000 returned no response within three seconds. No database operation ran.

Read-first findings affecting implementation:

| Source                                                                             | Scaffold consequence                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/mobile/BLUEPRINT.md`                                                         | §16 tokens, §18 standalone native architecture, S05/S07–S10/S20/S24 placeholders, MOB story IDs; later roadmap is outside scaffold scope.                                       |
| `docs/mobile/CODEX_HANDOFF.md`                                                     | Signed-out read-only first run, capability degradation, B/C deferred, no imported web/backend source.                                                                           |
| `docs/mobile/NATIVE_AUTH_DESIGN.md`                                                | Proposed ADR only; no native transport/header approved, G06 blocks login.                                                                                                       |
| `docs/mobile/PRE_LAUNCH_CHECKLIST.md`                                              | Scaffold acceptance differs from store readiness; native app links/push and reviewer access remain later gates.                                                                 |
| `AGENTS.md`, root/backend READMEs                                                  | Disk/data preservation; independent npm packages; retain unrelated changes; no schema/database work.                                                                            |
| `docs/UI_UX_AND_CONTENT_RULES.md`, `docs/DELIVERY_AND_VERIFICATION.md`             | Shared primitives, honest copy/states, focused checks and explicit evidence limits.                                                                                             |
| `frontend/docs/Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md`, quality register | Accessibility goal and state coverage; existing web register is preserved under the no-frontend-edit rule. This report records scaffold evidence, not a competing site backlog. |
| Backend security model/API conventions, auth/CSRF/private-testing middleware       | Cookie-only trust boundary, no spoofed Origin, safe envelope normalization including perimeter 401 deviation.                                                                   |
| Frontend design-system, colour CSS, `lib/business.ts`                              | Use actual semantic brand values; no invented contacts/content, images or service data.                                                                                         |
| Routes, policy service/schema, public-launch middleware, OpenAPI                   | Two existing public GETs, runtime validation, fail-closed consistency rules, server 403 remains authoritative.                                                                  |
| Package manifests/lockfiles, lint/format configs and workflows                     | Standalone npm lock; Prettier 90 columns/double quotes; new mobile-only CI, existing workflows untouched.                                                                       |

## 2. Verified-fact differences and limits

1. Installed Node is **26.13.0**, rather than repository-required 24.x (the
   starting facts name 24.13.0). The mobile manifest and CI require 24.x; a local
   install used Node 26; direct types/lint/tests subsequently passed on temporary Node 24.13.0. npm emitted `EBADENGINE` warnings.
2. Root scripts mostly forward to frontend, but `bootstrap:super-admin` forwards
   to backend. Root package has no workspaces and was not changed.
3. Root `package-lock.json` already exists as an untracked user file. It was not
   adopted, modified, deleted or staged.
4. The private-testing middleware's direct 401 returns `success` and `error`
   without standard top-level message/meta. The client accepts the nested error
   message and falls back to `X-Request-ID`; no fabricated request ID is added.
5. `/public/services` returns `data.items` with **optional** `nextCursor`; absence
   is not malformed. The proof validates only ID/name plus optional UUID cursor,
   rather than trusting every generated property or displaying prices.
6. The capability response has **no Allie field**. `canUseAllie` is always false;
   neither launch mode nor marketing implies AI availability.
7. The backend check includes additional script/config checks beyond the starting
   summary. No backend checks were run because this task changes no backend code.
8. Remote PR/source and actual deployment claims remain unverified as above.
   No substantive disagreement found in inspected cookie, CORS, trusted Origin,
   launch enforcement, exact money, per-IP limits, browser-push or local-docs facts.
   These are source findings, not an assertion that the current runtime matches.

## 3. Versions and reasons

| Package              | Chosen version   | Reason                                                                                |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Expo                 | 58.0.23          | Current stable npm tag verified; official SDK 58 release notes dated 15 October 2026. |
| React Native / React | 0.88.1 / 19.3.0  | Current Expo blank-TypeScript template and bundled compatibility.                     |
| Expo Router          | 58.0.30          | SDK-matched module with typed routes.                                                 |
| TanStack Query       | 5.107.1          | Current stable query/cancellation/cache primitives; no persistence plugin.            |
| Zod                  | 4.6.6            | Same pinned major/minor/patch as backend contracts.                                   |
| TypeScript (app)     | 6.0.3            | Expo SDK 58 recommended compiler.                                                     |
| TypeScript (codegen) | 5.9.3            | Isolated generator compiler satisfying its supported peer range.                      |
| openapi-typescript   | 7.13.0           | Existing generator version preserved in the private tool package.                     |
| Jest Expo / RNTL     | 58.0.14 / 14.1.0 | SDK-matched Jest preset and current asynchronous native testing API.                  |

Initial Expo Doctor verification reported **19/20** because the app used the generator's TypeScript 5 compiler. The owner-approved isolated codegen package resolves that conflict: final Expo Doctor is **20/20** on Node 24. No checks were excluded, and no force or peer-bypass flags were used. See Section 13 for the current dependency split and validation.
Initial dependency installs failed on TypeScript and React DOM peer conflicts;
TypeScript 5.9 and exact React DOM/renderer 19.3.0 resolved npm installation.
Expo Font's missing peer `expo-asset` was added at the bundled SDK version.

References: [SDK 58](https://expo.dev/changelog/sdk-58),
[SDK reference](https://docs.expo.dev/versions/latest/),
[Expo Go](https://expo.dev/go),
[development build FAQ](https://docs.expo.dev/develop/development-builds/faq/).
The selected native dependencies need no custom development build for the shell;
own-app links, native sign-in redirects and later push require a development
build. Matching Expo Go availability must be checked for each physical platform.

## 4. Files and preservation

Created only `apps/mobile/**` and `.github/workflows/mobile-checks.yml`:

- Project: package/lock, Expo config, TypeScript, ESLint, Prettier, Jest, env
  example, ignore files, README, this report and local generation/preview scripts.
- Shell: root layout and five tabs with accessible signed-out placeholders.
- API: two-read fetch allowlist, generated types, runtime envelope schemas,
  errors/Retry-After, configuration guard, memory-only query providers/keys.
- Foundation: capability schema/provider/helpers, secure-storage registry,
  signed-out session provider, exact kobo display, semantic tokens and Quicksand.
- UI: Screen/Text/Button/Card/StatusBadge and loading/empty/error/offline/
  unavailable states; purpose READMEs in deferred feature/asset/telemetry folders.
- Tests: unit and mocked integration coverage, with all network calls controlled.

Task modifications under backend/frontend: **zero**. Total working-tree diff for
those directories is not empty because the owner's backend file was dirty first:

```text
git diff --stat -- backend/ frontend/
 backend/prisma.initial-recovery.config.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Frontend has no diff. That backend edit, the four dirty mobile planning documents
and untracked root lockfile are preserved. Nothing was staged. No existing
workflow, root manifest, schema, migration or authentication source changed.

## 5. Reused contracts

| Mobile proof           | Existing source                                                                                                                          | Validation/behavior                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/public/capabilities` | `backend/src/modules/policies/policies.service.ts` `safeCapabilities`, `policies.schemas.ts`, policy router and committed OpenAPI        | Full safe snapshot shape; ported `frontend/lib/public-capabilities.ts` consistency checks; 60-second freshness limit; unknown on error/expiry. |
| `/public/services`     | `backend/src/modules/service-operations/service-operations.controller.ts` `publicServices`, service router/service and committed OpenAPI | Runtime-validated ID/name list, loading/success/empty/error/retry; no client-auth assumption or monetary UI.                                   |

Transport has a timeout, external cancellation, no-store, no cookies/credentials,
no redirects, no auth/CSRF/perimeter implementation, and a runtime path allowlist.
Global query/mutation error handling displays 403 server wording and refreshes
capabilities without replaying the operation. Mutation handling is tested with
an in-memory rejected function only: the app contains no network mutation.

## 6. Token differences

Current CSS semantic tokens take precedence over older design prose and proposed
blueprint values. Mobile code imports no CSS or frontend module.

| Role             | Blueprint proposal | Used from current web CSS                             |
| ---------------- | ------------------ | ----------------------------------------------------- |
| Ink              | #111820            | #080C0F                                               |
| Action           | #C92C32            | #D71920                                               |
| Red on dark      | #FF625A            | #FF7378                                               |
| Marketplace navy | #14243A            | #091B38                                               |
| Canvas           | #F7F8FA            | #F5F6F8 (`--canvas`; actual web body itself is white) |
| Main surface     | #FFFFFF            | #FFFFFF (`--surface-raised`)                          |
| Divider          | #DEE3E9            | #D9DDE3                                               |
| Success          | #24724F            | #166534                                               |
| Caution          | #9B611B            | #854D0E                                               |
| Error            | #B32734            | #991B1B                                               |

Spacing 4/8/12/16/24/32; mobile cards 16 and controls 12 follow the explicit
scaffold requirement (web prose describes smaller 2–12 normal radii). Touch
targets are at least 44 on iOS and 48 on Android. Bottom tabs use two rows at
large font scales (1.5 and above), keeping complete words and all five controls
visible; native safe-area padding remains intact. No motion is used. Quicksand is bundled with a
system fallback; owner still must confirm store-distribution licensing.

## 7. Verification

| Check                                             | Result/evidence                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm ci` (app and codegen)                        | PASS on Node 24.13.0 / npm 11.20.0: 1,336 app packages and 33 isolated codegen packages.                             |
| `npm run lint`                                    | PASS, including direct Node 24.13.0 final verification.                                                              |
| `npm run typecheck`                               | PASS, strict mode.                                                                                                   |
| `npm test`                                        | PASS on TypeScript 6 / Node 24: 50 tests in 9 suites (5.268 s). Earlier results retained below.                      |
| `npm test -- --detectOpenHandles`                 | Earlier 47-test run PASS, clean exit after zero-time mutation garbage collection.                                    |
| `npm run format:check`                            | PASS; final report formatting rechecked at closeout.                                                                 |
| `npm run api:generate` twice / SHA-256 comparison | PASS, generated output unchanged.                                                                                    |
| `npx expo-doctor`                                 | PASS: 20/20 under Node 24; no suppressed checks.                                                                     |
| Backend/frontend tests or DB checks               | Not run; no changes or DB work in task scope.                                                                        |
| Hosted CI                                         | Not run; no push. New workflow includes install/lint/types/format/tests/generated freshness and no app API requests. |

Story mapping: MOB-008 Explore loading/success/empty/retry; MOB-018 generation,
secure-store clear and private-cache isolation groundwork; MOB-020 primitives and
mocked tab labels (not physical accessibility acceptance); MOB-022 all-action
fail-closed parsing, provider failure/expiry, 403 notice/refetch/no replay;
MOB-023 exact BigInt kobo parsing/formatting. Startup tests assert configuration
errors and zero fetches for blocked URLs, including production with opt-in flag.
Timeout/abort, error fields/request IDs, Retry-After seconds/date, success
envelope validation are covered. Other MOB journeys remain outside scaffold scope.
Earlier failed tests were corrected in implementation or test setup, never
deleted or weakened. Synthetic data exists only in labelled tests, not app copy.

## 8. Native evidence

Android Medium_Phone AVD, Android 37, 1080×2400, headless/read-only/no snapshot
saving, booted and authorized. Expo Go SDK 58 installed and the Android bundle
started successfully without importing website/backend source. All five tabs
opened and their headings were asserted through UI Automator. At 200% OS text,
all five tabs also opened; Explore displayed the fixture's `No services listed`
state and Home displayed its intentional capabilities-unavailable response.
The original font scale (1.0) was restored. Home's long notice can be reached
by scrolling rather than being covered by the tab bar.

The real local backend remains unavailable. The successful emulator API target
was **only** `http://127.0.0.1:5155/api/v1` forwarded with ADB to the loopback
fixture. Initial host-address/timeouts were retained as failed evidence, not
counted as a successful real-backend proof. No real service record was invented.

Screenshots and UI Automator captures are under `evidence/`:

- `android-{home,explore,garage,activity,you}-mocked.png`: initial normal-text tab
  captures (before the adaptive large-text navigation refinement).
- `android-navigation-200-percent.png`: inspected clean final adaptive navigation.
- `android-{home,explore,garage,activity,you}-200-percent.png`: final large-text
  tab captures/heading assertions. Some include Expo Go's transient Refreshing
  development banner during dependency verification; no store-build acceptance.
- `android-initial-*`: retained System UI ANR, initial bundling and word-wrapping
  failures. A verification harness initially expected Home's heading while its
  scroll position was retained; scrolling to the top corrected the harness and
  the five-tab large-text run passed without weakening heading assertions.

The emulator initially displayed a System UI ANR; choosing Wait recovered.
The ADB server created by this task required restart under normal permissions
to authorize the emulator. No other connected device existed. An Expo linking
scheme warning remains expected for the own-app configuration still to be
reviewed; Expo Go navigation works without an own-app scheme.

No iOS simulator or physical-device evidence. Full TalkBack/VoiceOver, external
keyboard/focus, explicit Reduce Motion setting and physical-device 200% type
acceptance remain unverified. Unit roles and emulator screenshots are not those checks.

The later clean dependency reinstall interrupted the running preview, and initial
reload requests were declined. The owner subsequently approved a corrected
plain-string launch, and **fresh post-install Android reload acceptance now passes**.
PowerShell constructed the API base from three fragments, printed exactly the
28-character local URL with no Markdown delimiters, and used development settings.
The fixture returned HTTP 200 with requestId `local-fixture`; emulator readiness
and ADB reverse for 5155 were verified before Metro started on 8085.

Session 50683 was verified as Metro through its mobile project path and the local
status response `packager-status:running`. Exactly one lowercase `r`, without
Enter, was sent. Metro reported `Reloading apps` and an Android bundle completed
in 89 ms (warm development reload, not a startup-performance measurement). After
choosing Wait on queued Pixel Launcher/System UI/process-system ANR dialogs and
dismissing Expo Go's first-run developer menu, Home rendered signed-out with the
fixture's unavailable-capabilities response. Explore rendered `No services listed`.
Clean final captures: `evidence/android-approved-reload.png` and
`evidence/android-approved-reload-explore.png`, with paired UI Automator XML.
The initial launcher ANR capture is retained separately. These are local-fixture
checks, not real-backend, physical-device or production acceptance.

Ctrl+C stopped Metro cleanly. The launcher's finally block removed only the 5155
mapping it created, and stopped only the recorded fixture/emulator identities and
the emulator's verified child. Process IDs 5592, 24808, 12772, 13716 and 5020 were
all confirmed stopped afterward; ADB listed no device. The shared ADB daemon,
existing AVD definitions, reusable caches and unrelated work were preserved.
Final free space after this follow-up: **20.82 GiB**, above the 20 GiB reserve.

## 9. Blockers and owner decisions

- Obtain remote source/PR evidence when permitted, and run
  exact-source GitHub checks after reviewing/committing this bounded change.
- Verify the two reads on a real, explicitly local or isolated staging backend.
  Do not reuse production or start migrations/database repair to make it pass.
- Owner supplies store identifiers, confirms font licensing, identifies an
  isolated staging URL and any added blocked hosts. No identifier was invented.
- Native auth protocol/header, perimeter access, app links and push require
  separate security/backend work. No X-Device-Session implementation is approved.

## 10. Safety and disk

Initial C: free **25.19 GiB**: passed the 20 GiB reserve plus 5 GiB growth
threshold before changes. Owner preflight script is absent, so .NET DriveInfo
was used; CIM was unavailable in the prior attempt. Smaller subsequent stages
used justified 3 GiB install/emulator or 1–2 GiB diagnostics/verification budgets,
never reducing the 20 GiB reserve. Final measured free space after stopping the
task emulator and servers: **22.57 GiB** at the initial scaffold closeout, and
**20.82 GiB** after the approved reload follow-up, both above the 20 GiB reserve. No Docker operation or pruning, worktree
creation, database write, migration, backup/restore or business transaction ran.
No temporary resource belonging to another task was removed. Useful npm/native
dependencies and the matching Expo Go cache are retained for reuse.

**No production contact**, including startup, tests, generation, CI or probes.
Only npm/Expo metadata/downloads and local mock/loopback verification are used.
No secrets committed; no files staged. No native login, tokens, auth middleware,
business logic, payment, booking, push or analytics implemented. X-Device-Session
remains an unapproved ADR candidate, not a runtime constant or request header.

Final receipt: system npm's Windows launcher selected Node 26 despite a temporary
Node 24 being first on PATH. Both clean installs completed; the later npm-driven
test run had 49/50 pass and one 5-second configuration-render timeout while the
emulator/Metro were active. No timeout or assertion was relaxed. Invoking the
cached **Node 24.13.0 executable directly** then passed strict TypeScript, lint
and **50/50 tests in 9 suites** (12.129 seconds). Earlier clean-exit 50-test runs
also passed on system Node 26. Expo Doctor remains 19/20, not green. The earlier Node 24 clean-install gap is now closed; final cached offline npm ci and checks passed on Node 24.13.0. Hosted CI remains unrun.

The task emulator, loopback fixture server and verified Metro processes were
stopped. Metro ignored Ctrl+C and required approved termination of only its
verified process IDs 22768/24880; no other task process was stopped. ADB's shared
daemon, existing AVD definitions, reusable npm/Expo/Node 24 caches and application
dependencies were retained. No blanket cleanup or disk-byte reclamation claim.

## 11. Next task

Local tooling compatibility checks are complete. Separately review
Package B backend native-auth design/G06 and Package C public Explore/image
strategy. Package C's later enquiries are not authorized by this scaffold.

## 12. Scaffold closeout before compiler isolation

The owner requested conclusion of the scaffold, with no Android restart, P0-A
implementation, commit or push. Those boundaries were preserved.

Final remaining check completed: the cached Node 24.13.0 executable ran npm
11.20.0 directly with an ephemeral PATH scoped to that process. `npm ci --offline
--no-audit --no-fund` passed, followed by lint, strict TypeScript, all 50 tests
in nine suites (7.891 seconds), formatting and generated-types freshness. No
application source changed after the successful Android acceptance.

The install retained transitive deprecation warnings and npm's warning that the
@parcel/watcher 2.6.0 build-from-source install script is not covered by allowScripts.
The package's native prebuilt binding loaded successfully on Node 24.13.0. No
script approval, ignore rule, force flag or policy change was introduced.

Expo Doctor was rerun on Node 24.13.0: **19/20**, exit 1. Its only failure remains
TypeScript 5.9.3 versus SDK 58's expected ~6.0.3. This was not suppressed. Resolve
compatibility with the OpenAPI generator's TypeScript 5.x peer range in a separate
reviewed tooling task; this scaffold is not described as having all checks green.

Latest Android evidence (previously passed; **not restarted at closure**): Metro
session 9370 was verified through its project path and status endpoint, with
local fixture HTTP 200 and ADB reverse validated first. Exactly lowercase `r`
without Enter triggered `Reloading apps` and an Android bundle in 342 ms. Home
rendered signed-out with the deliberate unavailable-capabilities response;
Explore rendered `No services listed`. Two emulator system ANR dialogs recovered
using Wait. Screenshots and paired XML: `android-reload-9370.*` and
`android-reload-9370-explore.*` in `evidence/`. All task preview processes/mappings
were cleaned up after that run. No physical/iOS or real-backend acceptance is implied.

Closure limitations: Expo Doctor version mismatch; real local/isolated-staging
backend acceptance; current remote master/PR verification and hosted CI; physical
Android/iOS accessibility and performance; owner store identifiers, font licensing,
and staging identity. Native authentication remains an unapproved backend design
with G06 open; no native header or login exists. No P0-A business feature was begun.

Recommended next packages, subject to separate approval: resolve tooling/CI and
verify the real isolated backend; Package C public Explore, image strategy,
Help/contact and reviewed enquiry-write contracts; Package B native-auth protocol,
perimeter/MFA/security review; then the P0-A owned Garage, account/privacy/security,
notification inbox and support continuity. Keep booking, checkout/payments,
native push and Allie behind their separately reviewed gates.

Git remains `feat/mobile-scaffold` at HEAD
`02adf99d2adef58dcd11b0640ced036d30869df7`; no staged changes, commit or push.
The task created only apps/mobile and the new mobile workflow. Pre-existing
backend recovery-config, four mobile-planning-document edits and the untracked
root lockfile remain untouched. Frontend has no diff. No production contact,
database operation, authentication change or real transaction occurred.

### Complete deliverable file inventory

Current inventory after compiler isolation; dependencies and ignored runtime caches excluded.

```text
apps/mobile/.env.example
apps/mobile/.gitignore
apps/mobile/.prettierignore
apps/mobile/.prettierrc.json
apps/mobile/app.json
apps/mobile/app/(tabs)/_layout.tsx
apps/mobile/app/(tabs)/activity.tsx
apps/mobile/app/(tabs)/explore.tsx
apps/mobile/app/(tabs)/garage.tsx
apps/mobile/app/(tabs)/index.tsx
apps/mobile/app/(tabs)/you.tsx
apps/mobile/app/_layout.tsx
apps/mobile/assets/README.md
apps/mobile/eslint.config.mjs
apps/mobile/evidence/android-activity-200-percent.png
apps/mobile/evidence/android-activity-200-percent.xml
apps/mobile/evidence/android-activity-mocked.png
apps/mobile/evidence/android-activity-mocked.xml
apps/mobile/evidence/android-approved-reload.png
apps/mobile/evidence/android-approved-reload.xml
apps/mobile/evidence/android-approved-reload-explore.png
apps/mobile/evidence/android-approved-reload-explore.xml
apps/mobile/evidence/android-approved-reload-initial-launcher-anr.png
apps/mobile/evidence/android-approved-reload-initial-launcher-anr.xml
apps/mobile/evidence/android-explore-200-percent.png
apps/mobile/evidence/android-explore-200-percent.xml
apps/mobile/evidence/android-explore-mocked.png
apps/mobile/evidence/android-explore-mocked.xml
apps/mobile/evidence/android-garage-200-percent.png
apps/mobile/evidence/android-garage-200-percent.xml
apps/mobile/evidence/android-garage-mocked.png
apps/mobile/evidence/android-garage-mocked.xml
apps/mobile/evidence/android-home-200-percent.png
apps/mobile/evidence/android-home-200-percent.xml
apps/mobile/evidence/android-home-mocked.png
apps/mobile/evidence/android-home-mocked.xml
apps/mobile/evidence/android-initial-200-percent-bundling.png
apps/mobile/evidence/android-initial-explore-200-percent-wrapped.png
apps/mobile/evidence/android-initial-home-200-percent-wrapped.png
apps/mobile/evidence/android-initial-system-anr.png
apps/mobile/evidence/android-navigation-200-percent.png
apps/mobile/evidence/android-navigation-200-percent.xml
apps/mobile/evidence/android-reload-9370.png
apps/mobile/evidence/android-reload-9370.xml
apps/mobile/evidence/android-reload-9370-explore.png
apps/mobile/evidence/android-reload-9370-explore.xml
apps/mobile/evidence/android-window.xml
apps/mobile/evidence/android-you-200-percent.png
apps/mobile/evidence/android-you-200-percent.xml
apps/mobile/evidence/android-you-mocked.png
apps/mobile/evidence/android-you-mocked.xml
apps/mobile/evidence/README.md
apps/mobile/jest.config.cjs
apps/mobile/package.json
apps/mobile/package-lock.json
apps/mobile/README.md
apps/mobile/SCAFFOLD_REPORT.md
apps/mobile/scripts/generate-api.mjs
apps/mobile/scripts/preview-api.mjs
apps/mobile/src/api/client/context.ts
apps/mobile/src/api/client/environment.ts
apps/mobile/src/api/client/index.ts
apps/mobile/src/api/contracts/envelope.ts
apps/mobile/src/api/contracts/generated.d.ts
apps/mobile/src/api/errors/index.ts
apps/mobile/src/api/queries/index.ts
apps/mobile/src/api/queries/provider.tsx
apps/mobile/src/auth/secure-storage/index.ts
apps/mobile/src/auth/session/index.tsx
apps/mobile/src/capabilities/index.tsx
apps/mobile/src/capabilities/model.ts
apps/mobile/src/components/feedback/index.tsx
apps/mobile/src/components/ui/index.tsx
apps/mobile/src/design/tokens/index.ts
apps/mobile/src/design/typography/index.tsx
apps/mobile/src/features/account/README.md
apps/mobile/src/features/activity/README.md
apps/mobile/src/features/garage/README.md
apps/mobile/src/features/home/README.md
apps/mobile/src/features/parts/README.md
apps/mobile/src/features/services/ExploreProof.tsx
apps/mobile/src/features/support/README.md
apps/mobile/src/features/vehicles/README.md
apps/mobile/src/money/index.ts
apps/mobile/src/telemetry/README.md
apps/mobile/tests/integration/capabilities.test.tsx
apps/mobile/tests/integration/configuration.test.tsx
apps/mobile/tests/integration/explore.test.tsx
apps/mobile/tests/integration/session.test.tsx
apps/mobile/tests/setup.ts
apps/mobile/tests/unit/cache.test.ts
apps/mobile/tests/unit/client.test.ts
apps/mobile/tests/unit/primitives.test.tsx
apps/mobile/tests/unit/safety.test.ts
apps/mobile/tests/unit/tabs.test.tsx
apps/mobile/tools/api-codegen/generate.mjs
apps/mobile/tools/api-codegen/package.json
apps/mobile/tools/api-codegen/package-lock.json
apps/mobile/tsconfig.json
.github/workflows/mobile-checks.yml
```

Mobile deliverable files: 99; plus the mobile-only workflow.

## 13. Approved Expo SDK 58 / TypeScript compatibility resolution

Implemented only the dependency/tooling change approved by the owner. SDK 58,
React Native, React, runtime screens and business restrictions remain unchanged.

- App: exact TypeScript 6.0.3, with openapi-typescript removed from the app package.
- Private standalone tool at tools/api-codegen: exact openapi-typescript 7.13.0
  and TypeScript 5.9.3, with its own package.json and package-lock.json.
- The app lockfile remains standalone and was updated in place. Only TypeScript
  changed version among retained app lock entries; 20 generator-only entries
  were removed. The tool lock was seeded from the existing resolved versions
  and normalized/pruned by npm to preserve generator transitive dependencies.
- The existing scripts/generate-api.mjs entry delegates to the tool's generator
  using the same Node executable. No installation occurs during generation.
- Input remains backend/docs/api/allied-autotech.openapi.json; output remains
  apps/mobile/src/api/contracts/generated.d.ts; the source-SHA header is unchanged.
- Mobile TypeScript excludes the isolated tool while preserving Expo's original
  exclusions. ESLint ignores nested node_modules but still lints the tool script.
- The mobile workflow explicitly installs both packages and caches both locks.
  No workspaces, install hooks, force flags or legacy peer resolution were added.

Validation on Node 24.13.0 / npm 11.20.0:

| Check                           | Result                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Clean tool npm ci               | PASS: 33 packages                                                                     |
| Clean app npm ci                | PASS: 1,336 packages                                                                  |
| npm ls dependency trees         | PASS: app TypeScript 6.0.3; generator 7.13.0 with TypeScript 5.9.3; no peer conflicts |
| Strict TypeScript 6 typecheck   | PASS                                                                                  |
| ESLint                          | PASS                                                                                  |
| Jest                            | PASS: 50 tests, 9 suites, 5.268 seconds                                               |
| Formatting                      | PASS                                                                                  |
| Generated-contract freshness    | PASS: byte-identical to the pre-change SHA-256                                        |
| Expo Doctor under Node 24       | PASS: 20/20, exit 0, no exclusions or suppressed checks                               |
| Native watcher prebuilt binding | PASS: no install-script approval needed                                               |

Generated file SHA-256 before and after:
FA284E3546BAEBE733C52EBCE5ECF21FA963E98566484683930B186AFDFEDB5F.
Its source file commit header remains
1a8522f828f6308c9d9eb431fa4cb63dc243f70f.

The first app lock update emitted a warning about the obsolete generator still
present in the old app node_modules; the new app lock contained no generator.
The subsequent clean installs removed that stale package and produced valid,
conflict-free dependency trees without forcing resolution. The initial offline
metadata update lacked a TypeScript cache entry; a normal registry metadata fetch
completed it. Neither event required a compatibility workaround.

Remaining warnings are existing transitive deprecations (including ESLint 9)
and npm's unapproved @parcel/watcher build-from-source install-script warning.
The prebuilt watcher binding loads correctly; npm script policy was not changed.
No compatibility issue remains in the requested local checks. Hosted CI, real
backend acceptance and physical/iOS accessibility remain separate open items.

Files changed in this compatibility batch:

- apps/mobile/package.json and package-lock.json
- apps/mobile/scripts/generate-api.mjs
- apps/mobile/tools/api-codegen/package.json, package-lock.json and generate.mjs (new)
- apps/mobile/tsconfig.json and eslint.config.mjs
- apps/mobile/README.md and SCAFFOLD_REPORT.md
- .github/workflows/mobile-checks.yml

The generated file is byte-identical and is not a changed deliverable. SHA-256
verification also confirms that the five pre-existing modified files and the
repository-root package-lock.json are unchanged. No backend or web source,
production API, database, P0-A feature, Android restart, staging, commit, push
or pull request was involved. Existing Android fixture evidence remains the
accepted runtime evidence; this batch changes only development tooling.
