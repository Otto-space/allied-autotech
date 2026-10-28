# Revision 4 W4A: responsibility access and reviewed impact

Source: `feat/workforce-effective-access-20261026`, based on `24a386c1`.
This batch is local. The preceding W1-W3 release is documented separately in
`backend/docs/workforce-versions-production-20261026.md`. No W4 production release,
real invitation, support reply, AI request or stock publication has occurred.

## Behaviour and boundaries

The existing workforce account inspection now includes a server-derived breakdown
of active responsibility capabilities, branch, scope and grant sources. It uses
the same pinned catalogue definitions and eligibility rules as operational policy.
Inactive/unverified accounts, inactive branches, future starts, expired/revoked
assignments and unknown versions/scopes grant nothing. History is preserved.
Positions remain separate from account tier and never infer authority.

This is explicitly a **responsibility-grants-only** view. Owner/legacy account
baselines and independent grants retain their existing rules; this batch does not
claim to complete the full Revision 4 effective-policy integration. It does not
change independent approval, financial capabilities, owner promotion restrictions
or the controlled eight responsibility templates.

Within one branch, branch scope covers assigned-work scope. Grants in different
branches never combine into company access. An overlap survives revocation of one
source. For example, two active Customer Service Officer assignments at the same
branch provide four distinct capabilities; revoking one removes zero capabilities
and retains four, with the surviving source. Removing a branch-wide workshop grant
while an assigned-work grant survives removes the broad scope while retaining the
assigned subset. A new broad grant similarly adds only the broad scope.

Delegated administrators see only capabilities, branches and maximum scopes inside
their current pinned delegation policy. A hidden overlap is labelled "Another
active responsibility" without assignment ID, template, private dates or other
branch information. An assigned-only manager cannot infer a hidden branch-wide
grant from either scope or source. Account discovery and copied-target checks stay
in place, including protected-owner and no-self-management restrictions.

## Preview and concurrency contract

`POST /admin/workforce/accounts/:userId/access-preview` accepts a strict assignment
or revocation proposal with the current workforce/catalogue revision. It uses the
existing authentication, MFA, CSRF, sensitive rate limit and no-store controls. It
does not accept passwords, reasons or untrusted scope, and writes no domain record
or inspection audit. Temporary-cover reason/password are still validated by the
real mutation. The preview describes access, not proof of authority to change it.

Assignment proposals contain `operation`, `expectedVersion`,
`expectedTemplateVersion`, `template`, `branchId`, `startsAt`, and optional
`expiresAt`; revocations contain `operation`, `expectedVersion`, `assignmentId`.
Responses bind target, operation and version to `added`, `removed`, `retained`,
visibility and a canonical SHA-256 fingerprint. Future assignments are projected
at their scheduled start and explicitly described as supplying no present access.

The new UI checks the target, operation, version, branch envelope, pinned source
definitions, delegation scope and proposal before displaying the review. It clears
the password control, cancels late/unmounted previews, prevents duplicate requests
and distinguishes a failed read from an unknown save. A fresh account inspection
and second preview are required before submission. Changed impact requires a new
review. Assign/revoke requests carry `expectedAccessPreview`; the server recomputes
it inside the existing locked mutation transaction and rejects mismatches with 409.
Expiry can therefore invalidate a review even when the workforce version did not
change. Existing clients may omit this additive field and retain their existing
revision/authentication contract. The fingerprint is not a credential or bypass.

The current breakdown and review use existing typography, native disclosures,
44px summary targets and wrapping layouts. The retained section explains overlap
without making every source visible initially. The shared mutation review changes
only when the typed optional access-impact property is supplied.

## Verification

- Fresh synthetic target:
  `127.0.0.1:63888 / allied_workforce_effective_20261026_6970069e210b_ci`.
  Actual loopback port and native PostgreSQL data directory checked before writes;
  separate DML-only runtime, no database/table ownership, schema create, TRUNCATE,
  superuser or migration-ledger writes. The shared server and other databases stay
  intact. Empty replay of all 72 migrations, schema comparison and `db:check`
  passed. W4 requires no new schema or migration.
- Final seven-file isolated integration run: **56 passed**, including current
  overlap, delegated/private-source scope, foreign target/branch, protected owner,
  unassured MFA, customer/staff denial, CSRF, forged company scope, inactive and
  unknown definitions, scheduled access, same-session revocation, unchanged-version
  expiry and invalid fingerprints with no partial write.
- Focused backend units: **12 passed** (seven impact/fingerprint, three catalogue,
  two receipt cases). Backend typecheck, lint, script checks, OpenAPI export and
  366-path/426-operation route parity passed. Generated frontend types refreshed.
  The existing generic OpenAPI example generator mishandles nullable-array sample
  values, including older `branchIds`; schemas/types, not those examples, define
  the contract. No unrelated generator-wide rewrite was included.
- The existing restricted `access-review` learning article now explains the actual
  review, overlap, future-start and stale/uncertain recovery flow at version **3**.
  Its gate is unchanged. All **seven learning HTTP cases passed** on the same
  restricted synthetic CI target, including public/private denial and current
  article content. No learning feature flag was enabled or content published live.
- Full frontend suite: **1,066 passed in 163 files**. A subsequent lifecycle/ref
  lint correction passed **24 focused tests**; full final lint, types, optimized
  build and standalone asset preparation passed. Installed Next is 16.3.8 versus
  locked 16.4.3; this is not new exact-lockfile hosted CI evidence.
- Browser plugin not available; installed Playwright and Microsoft Edge are used
  against the built local preview at `http://127.0.0.1:3167`. All application API
  requests are intercepted by synthetic fixtures. The owner explicitly approved
  running the prepared PowerShell script after the historical startup rejection;
  that exact script started successfully. No alternate startup bypass was used.
- **77 distinct local fixture browser cases accepted**: workforce directory eight;
  staff account/detail, staff directory, invitations and workforce editor 69. The
  initial broader run was 68 passed / one failed because the new failure-state
  test expected the fixture's raw 503 message. The established API client correctly
  sanitizes service failures. Only the test expectation was corrected; the three
  new review/failure cases then passed, including added Axe, overflow, page-identity
  and keyboard checks. No assertion or safety behaviour was removed to pass it.
  Repeated executions are not counted as additional distinct cases.
  Responsive staff coverage spans 320-1920px; the impact review was checked at
  390px and 1440px, with native disclosure keyboard operation, scrollable retained
  grants and visible confirmation controls. Full-screen-reader and physical-device
  acceptance are not inferred from automated Axe or desktop emulation.
- Screenshot files, visually inspected: `%TEMP%/allied-workforce-effective-review-390.png`,
  `allied-workforce-effective-review-1440.png`, and matching
  `allied-workforce-effective-retained-{390,1440}.png`. The retained mobile view
  verifies internal scrolling keeps the review heading/actions available. New
  review checks recorded no framework page errors. A final two-case browser run
  additionally asserted zero application console errors at both widths and attached
  collected console diagnostics. Tooling colour warnings are separate from browser
  console errors; a full-site console audit is not claimed.
- Regenerated inventory: **106 route patterns / 338 interaction-boundary files**.
  Coverage structure passes; the completion gate deliberately fails with all 106
  routes still awaiting complete Revision 4 acceptance. Two workforce entries now
  record bounded isolated evidence while retaining explicit route-learning gaps.

An initial integration assertion had an overly strict nested branch matcher; the
new protected-owner preview also returned a revision conflict before denial. The
matcher was corrected and the actual service authorization ordering fixed; final
56-case acceptance includes the denial. Full lint caught a render-time ref write,
fixed with committed-state layout-effect synchronization and unmount abortion.
These initial failures are not counted as passes. Experimental Node WebCrypto and
Playwright colour-environment warnings are tooling diagnostics.

Verification logs and screenshots are outside source under `%TEMP%`, prefixed
`allied-workforce-effective`. No duplicate installation, worktree, Docker build,
image archive, full editor profile or speculative cache pruning was created.
Postflight C: **27.85 GiB free** (a point-in-time reading). Docker totals are
unchanged at 79 images / 13.05 GB, 13 stopped containers, 14 volumes and 9.258 GB
build cache. Current/rollback images, warm shared caches, databases and other tasks'
resources were retained; no Docker resources were created or pruned by W4.

## Required next work

Full canonical navigation/page/action predicates, baseline and independent-grant
composition, current-page redirect on loss of access, active drafts/subscriptions
and cross-tab transitions remain open. Completely unknown historical template or
scope display is still not proven. The existing rapid overlapping staff-directory
filter race remains separate. Do not count this responsibility preview as complete
workforce policy, route learning or real-role acceptance.

All 106 Revision 4 routes still require their complete content/mode/state decisions.
Real conversational AI, permission-filtered retrieval, threat/data-flow review,
reviewed persisted Customer Care handoff, separate care permissions, actual gated
live transport/staffing and at least 100 reviewed cases with a bounded configured
provider evaluation remain required. No claim of a missing provider key has been
made without inspection. Physical devices, full screen-reader operation and actual
hosted role mutations have not been verified in W4.
