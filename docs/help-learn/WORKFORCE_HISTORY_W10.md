# W10: unsupported workforce history

Source: `feat/workforce-history-policy-20261027`, based on W9 `8b360b89`, in the
reused `allied-home-restoration-20261025` checkout. No publication or new worktree.
This closes a recorded workforce foundation dependency before Customer Care handoff;
it is not full independent-grant/account-baseline policy completion.

## Reproduction and acceptance contract

The existing service preserves assignments with an unknown template, pinned version
or scope, returns null definition metadata and excludes them from effective grants.
However, its inspection response schema and the frontend history parser required
current catalogue enums. An isolated fixture with an unsupported template/scope
made the contract reject the actual 200 response. The frontend parser also rejected
the history, and its fallback scope label incorrectly called every non-ASSIGNED
value branch scope. No production records were queried to establish prevalence.

The new native fixture contains a valid technician assignment plus unknown template,
unknown scope and historical position. It verifies all original values survive,
unknown rows have no active IDs/grants and the current projection contains only the
valid assignment. The owner's existing reviewed/password/version-bound revocation
preserves the unsupported row, identifiers, original scope/version and audit actor.
It does not reinterpret an old definition or add a permission.

Acceptance cases require:

- Inspect and retain unsupported values as bounded text, with null definition metadata.
- Keep assignment inputs and active assignment schemas on the strict catalogue.
- Reject an unsupported active history claim, including legacy responses without
  explicit definition metadata. Legacy display fallback requires matching version/scope.
- Permit the existing authorised revocation receipt to describe its old row while
  still rejecting changed immutable fields or using that receipt as an assignment.
- Label unsupported responsibility and scope accurately, retain the raw reference,
  show that it supplies no access and keep details keyboard-operable.
- Preserve normal known assignments, current grants, review, MFA, password, branch,
  delegation, protected-owner and optimistic-concurrency controls.

## Implementation

Read-only assignment history and revocation response schemas are separate from
assignment/current-access schemas. Position response metadata is bounded text;
position mutation inputs still use the approved enum. No Prisma schema, migration,
grant, role, row cleanup or historical data rewrite is required.

The frontend history view uses explicit server definitions where supplied, with
version/scope-checked legacy fallback. It displays an unrecognised responsibility,
unrecognised scope and recorded raw reference instead of inventing a current label
or branch authority. Long historical identifiers wrap in the existing component.
Revocation verifies every original immutable field against the inspected record.

OpenAPI and frontend generated declarations reflect actual bounded read values;
endpoint paths, mutation request enums and existing receipt-version compatibility
remain unchanged. The permissions engine and route guards are unchanged.

## Verification

- Before change: two new frontend assertions failed (parser and label/scope view),
  and the new native contract assertion failed against the existing 200 response.
  Receipts: `%TEMP%/allied-workforce-history-before-front.log` and
  `%TEMP%/allied-allie-state-20261027-db/workforce-history-before.log`.
- After change: **17 focused frontend cases**, then the full **1,112 tests / 167 files**
  passed. A too-exact text matcher was corrected to include the containing branch label.
- **Nine native workforce effective-access cases** passed on the verified W7 synthetic
  CI target, including actual unsupported-history inspection/current projection and
  existing reviewed revocation. No model call or real customer message occurred.
- Backend source/scripts and frontend typechecks, changed frontend lint and backend
  lint passed. OpenAPI validates **375 paths** and **439 operations plus four explicit
  infrastructure routes**; frontend types regenerated successfully.
- One reused-cache optimized frontend build passed. Four Chromium fixture cases at
  **320/390/768/1440px** passed, with unknown/known history, no document overflow,
  keyboard disclosure controls, unchanged valid grants, blank unsupported-position
  selection, and Axe WCAG 2.2 tags on the panel. There were no browser console/page
  errors, external requests or writes. Initial test assumptions about a collapsed
  position control were corrected; no product permission was relaxed.
- Inspected viewport screenshots: `%TEMP%/allied-workforce-history-390.png` and
  `%TEMP%/allied-workforce-history-1440.png`. The mobile image shows the expanded
  unsupported assignment and desktop includes its place in the existing workspace.
  Viewport capture avoids a Chromium tall-element capture artifact involving an
  off-screen fixed skip link; the skip link itself is preserved.
- Source uses installed cached Next 16.3.8; exact-lock 16.4.3 CI remains a release
  gate. No dependency install, new worktree, Docker build or additional provider call.

## Remaining foundation and release boundaries

Independent `UserCapability` grants and account baselines still require canonical
composition and verification. Inspection found that the managed boundary can block
otherwise independently guarded legacy finance routes; reproduce with the actual
approved capability/record contracts before changing authority. Preserve enrollment's
explicit restriction of broad legacy operational access and all independent approval.

Granular Customer Care view/reply/assignment/live-accept authority, all 106 routes'
exact learning/state coverage, persisted reviewed handoff and gated shared/staffed
transport remain open. Provider configuration is verified, but its current 120-call
reservation approval is exhausted; no further provider calls are part of this batch.
Hosted/real-role, physical-device and full screen-reader acceptance are not claimed.
