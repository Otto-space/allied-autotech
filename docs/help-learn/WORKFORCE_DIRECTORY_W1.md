# Revision 4: scoped workforce directory checkpoint

Branch: `feat/workforce-allie-r4-20261026`, based on production runtime `3ccee21a`
(release evidence `9b1728fe`). This batch is local; no new production publication.

The former first step required a raw staff UUID. The workforce entry now opens a
real table separating person, account role, recorded business position, status,
currently active scoped responsibilities and an explicit View/manage action.
Name/email, position, status and owner-only role filters are applied on the server,
persist in the URL and survive directory/detail/back navigation. Stable UUID
pagination validates its cursor against the same filtered, authorised set.

Existing reviewed enrollment, position, independent assignments, delegation,
password/MFA, expected-version, unknown-outcome recovery and audit flows are reused.
The owner can follow the existing separate account role/status controls. No new
promotion authority, automatic staffing, implicit enrollment or title-derived grant.

The narrow directory projection excludes customer accounts, contact records,
credentials and operational rows. Delegated administrators see Staff accounts in
their approved branches and only responsibility summaries in both their template
and branch envelope. Assignment summaries exclude future, expired, revoked,
inactive-branch and malformed-scope grants; at most 20 per account, with an explicit
more indicator. Every request checks current authority. A copied detail URL now
requires the same management authority as discovery. A failed/revalidating/invalid
directory does not continue to render previously loaded private rows.

## Actual verification

- Fresh isolated PostgreSQL 18 target:
  `127.0.0.1:63888 / allied_workforce_r4_20261026_c505ce6431fc_ci`.
  Host, port and protected native data directory were checked before creation.
  All 71 migrations replayed into the empty target; `db:check` passed. Integration
  uses a separate restricted DML runtime without migration-ledger write privileges.
- 31 HTTP/database integration tests passed across workforce directory, workforce
  access, team access and Phase 3 flows. Six directory cases cover role/branch
  denials, cross-field matching, projection/privacy, active-grant semantics,
  cursor/filter validation, and same-session delegation removal plus direct detail.
  The rerun exposed a fixture-only duplicate-name collision with retained CI rows;
  the query now includes that run's unique synthetic email. No data was reset.
- 10 new directory DOM/component tests passed; 14 with existing workforce mutation
  receipt tests. Real component controls, URL submissions, back links, owner-only
  controls, invalid filters and clearing stale rows are exercised with mocked reads.
- Eight new Edge/Playwright fixture browser cases passed on the local Next preview
  at `http://127.0.0.1:3167`: 320/390/768/1024/1440 widths, scoped Axe, keyboard
  focus, no document overflow, filtering/pagination/clear/detail/back, error/empty
  recovery, and live removal of delegated management in the open page and deep link.
- Ten existing workforce editor browser scenarios passed (eight unchanged scenarios
  plus two updated directory entry scenarios). Initial runs found redundant hidden
  link text and overflow; explicit accessible link names, removal of the redundant
  hidden span and scoped filter sizing resolved the final tested states. The two
  old UUID-lookup tests were updated to the actual new flow, retaining assertions
  about protected actions, scoped assignment and no broad legacy API reads.
- Backend types, script types, lint, 365-path OpenAPI and 425-operation mounted-route
  checks passed. Frontend typecheck/lint passed. Generated API types were refreshed
  only after the final backend export. Optimized production build and standalone postbuild passed.
- Coverage structure check passes for 106 discovered routes. The completion gate
  intentionally fails: all 106 retain unverified Revision 4 requirements. The
  matrix overlays the maintained source inventory and checks stale/broken references;
  this is a baseline, not a claim of full dashboard guidance.

Browser plugin not available; installed Playwright/Edge used. All browser accounts,
staff and writes were intercepted fixtures. No production login, promotion,
invitation, message, upload or seed. Screenshots were inspected at desktop/mobile:
`%TEMP%/allied-workforce-r4-directory-{320,390,768,1024,1440}.png`.
The subsequent compiled-preview startup was rejected by automatic approval review
with "blocked by policy"; no alternate startup was attempted. Browser evidence above
is from the development preview, which was stopped before the optimized build.
Compiled-preview interactions remain unverified.
Native keyboard/physical devices, full screen-reader, hosted real-role and exact
lockfile CI acceptance are unverified. Installed Next is 16.3.8; lockfile 16.4.3.

## Remaining foundation and full-goal requirements

W1 is not the complete workforce foundation. Still required: versioned/reviewed
template evolution, server-derived effective-access provenance and change impact,
atomic role/delegation dependencies, canonical navigation/action predicates and
complete current-session/draft/subscription continuity. Existing owner/legacy and
independent financial-grant policies must remain intact.

The full goal also retains actual conversational AI, reviewed retrieval and output
validation, all-route learning decisions and practice, reviewed persisted Customer
Care handoff, gated human transport/readiness, and at least 100 reviewed evaluation
cases plus bounded configured-provider acceptance. Current deterministic Allie is
not completion of that requirement. See `REVISION_4_STATUS.md`.
