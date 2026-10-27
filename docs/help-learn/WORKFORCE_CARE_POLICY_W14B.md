# W14B: reviewed granular Care policy foundation

Branch `feat/workforce-care-duty-policies-20261027`, based on W14A `2ee51247`.
This batch defines and manages duties; operational Care adapters remain a separate
required dependency before these new journeys can be declared usable or released.

## Contracts established before implementation

Version 1 remains frozen with its exact original checksum, actions and scopes.
Version 2 reuses those definitions unchanged and adds four branch-scoped duties:

| Responsibility | Capability | Required operational composition |
| --- | --- | --- |
| Care viewer | CARE_CASE_VIEW | View cases in the assigned branch |
| Care responder | CARE_PUBLIC_REPLY | Also requires case-view authority on the same branch |
| Care assigner | CARE_CASE_ASSIGN | Also requires case-view authority on the same branch |
| Care live agent | CARE_LIVE_ACCEPT | Also requires current view/reply, availability and safe transport |

The new duties do not inherit bookings/orders/financial authority. They do not
change a position or account role. A reply/assignment/live grant alone must not
read a case or receive its private notification. Availability never grants access
or proves that live service is staffed. Existing version-one duties retain their
original authority through explicit compatibility handling, without gaining live
acceptance. The operational composition above is the next implementation gate.

## Management and compatibility

The owner sees version 2. A delegated Admin sees their exact reviewed envelope's
catalogue. A version-one Admin can still assign supported version-one duties; they
cannot assign a new version-two duty, including a previously unknown matching
name stored in an old envelope. Directory/detail summaries also exclude that name.
Assignments, preview fingerprints and delegation receipts retain the version
explicitly reviewed. Unsupported version/template pairs fail before mutation.
Legacy request defaults stay pinned to version 1; nothing silently upgrades them.

Business positions now have an explicit separate nine-position catalogue. Adding a
duty cannot add a job position or position filter. The existing CEO enrolment guard
is preserved; a position update alone gives no Care access. Read-only history stays
bounded and preserves unknown values. No applied migration is edited or needed:
the existing positive-version/string fields already support these compatible rows.

The management UI uses current permitted templates and fixed assignable positions.
It reviews the explicit version and effective access before a save, preserves the
password/MFA/reason/target/conflict guards, and does not send a password in previews.
Older clients that cannot parse the new duty names fail closed and must refresh;
deploy compatible backend and frontend before assigning those duties operationally.

## Local verification

- Initial native and unit failures established missing version-two contracts.
  One test incorrectly expected CEO enrolment to succeed; it was corrected to
  assert the existing denial, then a normal position update with no new authority.
- A six-suite native run passed 45 cases. Five focused policy cases passed after
  adding the old-envelope unknown-name acceptance. These receipts overlap.
- 51 backend workforce units passed, including the unchanged version-one checksum.
- Full frontend 1,134 units / 170 files and 29 final focused management cases passed.
- Source/frontend types, backend lint, changed frontend lint, OpenAPI 379 paths,
  route coverage and generated client types passed. One cached optimized build
  passed using existing Next 16.3.8; exact-lock 16.4.3 CI remains an open gate.
- Eight final responsive fixtures passed at 320/390/768/1440 for the delegated
  version-one and owner version-two workflows: choices, explicit pinned preview,
  no credentials in preview, no save, keyboard return, retained reason/selection,
  Axe and overflow. Screens inspected at 390/1440, including scrolling to the
  effective-access breakdown inside the native dialog. Browser responses are
  fixtures; actual persistence is covered separately by native HTTP/CI-DB tests.
- Browser acceptance found a real existing draft-loss defect: remounting the
  password field also cleared the reason. Only the password/show-password component
  now remounts; reason and assignment fields survive review cancellation. Password
  still clears immediately. A final 12-case component suite and the eight fixtures
  passed after this fix. One justified cached rebuild passed after the runtime edit.
- Initial browser harness errors used the owner-only staff page for a delegated
  Admin, an attribute selector instead of the native dialog, and the wrong cancel
  label. Tests were corrected to the real scoped route and controls; no access
  policy was loosened. Existing narrowly verified Next CSS preload warning remains.
- Secret guard passed for 3,249 non-ignored files. C: measured 25.20 GiB free.
  Read-only Docker review found 91 image references/200 cache records/14 volumes;
  no resource was proved redundant, so other tasks/data/rollback resources remain.

Screens: `%TEMP%/allied-care-policy-review-390.png` and `1440.png`, plus
`allied-care-policy-access-390.png` and `1440.png` for the scrolled breakdown.
Native evidence uses the existing isolated CI database and its retained
`w14-care-policy.log`, `w14-foundation-regressions.log` and `w14-policy-units.log`.

No actual provider call, customer message, publication, new worktree, dependency
install or schema change. W9's paid evaluation remains exhausted. Canonical handoff,
shared staffed transport and all 106 completed route learning decisions remain open.
