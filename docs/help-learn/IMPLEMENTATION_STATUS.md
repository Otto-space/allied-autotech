# Implementation checkpoint

26 October 2026. BUILD NOW, Phases 0-3. Subsequently deployed to production under
the owner's explicit deployment instruction. Current release evidence and remaining
acceptance limits: [PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md).

Frozen deployed runtime: `adef02f9d7d0d23818b8dbfcae9e938a27a40ee4`.
The implementation evidence below records the original local milestone; statements
about no push/publication and unrun locked CI describe that earlier checkpoint.

## Original implementation checkpoint

Branch: feat/help-learn-practice-20261026; reused allied-shop-vehicles-r2-20261025.
Base: released runtime 76377d43fb6e595e40ea27d24994794ceed37706.
The separate responsive branch and other worktrees are preserved.

| Phase | Status                          | Implemented scope                                                                                |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0     | Complete                        | Authoritative repository/role/policy discovery and fixture contracts                             |
| 1     | Complete for selected milestone | 17 backend-owned articles, eligible search/direct reads, hub and existing entry integration      |
| 2     | Complete for selected milestone | Three versioned optional guides, six stable semantic targets, written fallback and safe progress |
| 3     | Complete for selected milestone | 11 local synthetic scenarios, part search/evidence, deliberate examples/review/reset             |
| 4-5   | Not selected                    | No AI, live lookup/action tools, training backend, manager reporting or CMS                      |

The original attached brief is saved byte-for-byte as IMPLEMENTATION_BRIEF.md;
SHA256 494bbd8ed9d8ceb39dd08f96a2dfe44cafb3297a6bb1adaa41464e28bb66d186.
CAPABILITY_MAP.md records actual roles/scopes; CONTENT_REGISTER.md records sources,
versions and review responsibility; OPERATIONS.md records flags, privacy and rollback.

## Evidence and actual behaviour

- Fresh isolated native PostgreSQL 127.0.0.1:63888/help_learn_cd377cef42_ci,
  environment test. All 71 migrations replayed into the newly empty target; schema
  comparison and db:check passed. No schema change or new migration was needed.
- Restricted runtime role verified: not owner, superuser, role/database creator;
  no schema CREATE or table TRUNCATE rights. No shared/application target was used.
- Backend: 77/77 tests across learning, workforce access, notification boundary and
  launch restrictions. Covers all eight workforce templates, combined/delegated
  assignments, customer/Admin/owner, CEO_MD, direct private denial, forged caller
  claims, unpublished/disabled definitions, assignment expiry and session revocation.
  A first combined run had a browser/test origin mismatch and returned 403; fixing
  the harness origin yielded 77/77 without weakening enforcement.
- Backend type/script checks, Oxlint, formatting and secret guard passed.
  OpenAPI: 363 paths; actual route coverage: 423 operations, including eight new
  GET-only learning operations. Exported handbook and frontend types updated.
- Frontend: final full suite 1,032/1,032 across 157 files; learning/access units 8/8.
  Optimized build/postbuild and TypeScript pass. Full ESLint/format passed, with
  touched-file lint/format repeated after final edits.
- Compiled Edge: final 18/18 including the fictional-search enhancement. Public/customer/care/finance/technician/Admin/owner read actual
  isolated API data. Failure/retry and hostile-body cases intentionally intercept
  responses; they are distinguished from authenticated API evidence.
- Practice: editable examples; replacement cancel preserves inputs; validation,
  wrong/correct decisions, dependent-choice clearing, fictional result search,
  reset and identity clearing. Browser instrumentation asserts zero write/external
  requests for practice. API read counts preserve booking/order/payment/enquiry/
  outbox/assignment totals. Authenticated GETs retain existing session-touch logic;
  this is not a claim that the API executes no session SQL writes.
- Guides: actual input/click completion, pause/resume, replay/restart, refresh,
  route changes, missing/obscured target and small-layout written fallback. An
  unsent Customer Care subject survives help/guide dismissal. Guide progress is
  identity/version scoped metadata only; practice values/progress are memory-only.
- Responsive/accessibility: 320/390/768/1440 CSS-pixel practice and dashboard-entry
  checks, 390/1440 hub checks, scoped Axe WCAG checks, native dialog keyboard exit
  and focus restoration. The new entry's 7px overflow at 320 was reproduced and
  corrected with a labelled 44px icon button. Final desktop/mobile screenshots were captured and visually inspected under
  %TEMP%/allied-help-learn-20261026/.
- Source/client isolation: 191 client JavaScript chunks checked against 94 private
  article/guide/scenario markers; none found. The final compiled output was checked.
- Earlier dev attempts recorded selector ambiguity and a Next diagnostic POST;
  final acceptance uses optimized output, not that development result.

## Acceptance matrix

| Criteria                 | Evidence / boundary                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| AC-01, AC-03, AC-09      | Server role fixtures, actual routes/sources, private direct/search denial; no new operational permission                   |
| AC-02, AC-05             | Optional guide state transitions, written fallback, version tests, identity clearing and actual session/assignment denial  |
| AC-04                    | No AI provider or key; all core checks run without one                                                                     |
| AC-06, AC-07, AC-08      | Persistent fiction labels, local adapter, deliberate replacement/review, foreign reset rejection, zero operational traffic |
| AC-10                    | Scoped Axe, keyboard, representative widths, units/API/build; final browser run passes                                     |
| AC-11, AC-13, AC-14      | Content register, maintenance guidance, disable/rollback and limitations below                                             |
| AC-12                    | Not applicable: generative AI was not selected                                                                             |
| Full training boundaries | Not applicable: no training credentials, subdomain, jobs, storage or backend introduced                                    |

## Limits and deferred decisions

- The local Next rewrite triggered the existing express-rate-limit forwarded-header
  diagnostic while CLIENT_IP_SOURCE=socket; authenticated reads still passed. Proxy
  trust was not broadened. Existing crypto experimental and pg future-deprecation
  notices were also observed; none was a failed acceptance assertion.

- No production deployment, push, preview publication or real operational submission.
  Feature examples/defaults remain off. Production acceptance is not implied.
- Installed verified dependencies were reused (Next 16.3.8, locked 16.4.3). No
  reinstall; locked CI, hosted behaviour and dependency audit were not rerun here.
- Browser plugin unavailable: Playwright with installed Edge was used. Physical
  phones, mobile keyboards, other browsers and full screen-reader acceptance remain
  untested. Automated scoped Axe is not a complete WCAG conformance claim.
- The private UI revalidates on visibility/focus/online and a 30-second visible-tab
  interval. Server denial applies on each request; no real-time revocation channel
  or retroactive erasure of content already delivered is promised.
- Practice is a bounded local teaching exercise, not full operational training or
  competency certification. Fictional entries are cleared on leave, identity change
  or failed access verification. There is no offline/persistent fictional draft.
- All actual roles have useful written coverage. Initial live-page guides are Parts,
  owned support and managed care queue; sensitive/simple procedures use written
  steps and decisions. The candidate backlog is not silently marked fully built.
- Paid-customer transaction practice remains deferred under browse/enquiries mode.
  Delivery/warranty/refund/escalation promises missing from approved records remain
  business decisions; no substitute policy or simulated live feature was invented.
- Docker desktop-linux daemon unavailable on read-only inventory attempt. No Docker
  resource, new worktree, dependency installation or editor-profile clone created;
  all existing images, containers, volumes, databases and caches retained.

## Original local resume checkpoint

Selected Phases 0-3 are implemented and locally verified. Task API/frontend servers
are stopped. Backend contract commit e33c9e3e and frontend implementation 6b83a4d6
are local; this documentation checkpoint is committed separately. No push/publication.
The next separately scoped action is owner review of the business copy
and locked-dependency CI/release reconciliation before any publication request.

Postflight disk reserve: 29.84 GiB free on C: at measurement, compared with
30.03 GiB at initial implementation preflight. Current dependencies/build caches,
small screenshot evidence, the task-only database/role and protected local fixture
credentials are retained for reproducibility. No database, backup, history or Docker
resource was removed. This is a measurement, not a machine-wide quota guarantee.

## Current production checkpoint

The owner subsequently authorised deployment. The exact current fitment/product-media
release `a28753ab` was merged before publication, preserving its behaviour. All three
CI workflows passed for frozen runtime `adef02f9`; locked Next 16.4.3 passed 1,036
frontend tests and the production dependency audit reported zero vulnerabilities.
The backend is ACTIVE and both custom domains resolve to the intended READY Vercel
deployment through provider management API verification. Learning, guides and local
practice are enabled; generative AI remains deferred. No schema migration was added
or applied. Public API reads passed; hosted authenticated-role, physical-device and
full screen-reader acceptance remain open. See the release record for identifiers,
backup/restore evidence, cleanup, rollback and exact verification boundaries.
