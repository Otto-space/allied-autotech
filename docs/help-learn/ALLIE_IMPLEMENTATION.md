# Help, Learn and Allie implementation checkpoint

26 October 2026. Owner-requested refinement of Help, Help & Learn, optional guides
and safe practice. The attached brief is preserved as ALLIE_BRIEF.md (SHA256
`5b95c746f443a852a3669193fdcbdebcd6ae7a8c5e088551860bd43b72fac49e`).
Its suggested layouts/working name inform this implementation; existing repository
permissions, reviewed policies and database safeguards remain authoritative.

## Source and batches

Reused `allied-shop-vehicles-r2-20261025` on `feat/help-allie-20261026`, from
`22c8f09f` documentation / `adef02f9` deployed runtime. Live provider inspection
confirmed both domains still point to `dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD` and
backend `1dbceb73-075e-4f41-bd76-deb3daf71354` is ACTIVE. Unrelated worktrees and
the main checkout's pre-existing tracker changes are preserved.

1. Establish fixtures/reproduce; reuse shared server-filtered corpus and GET contracts.
2. Help entry, hub modes/search and article navigation.
3. Guide progression and compact controls.
4. Practice sample inputs, specific feedback and isolation.
5. Configurable Allie working name, native SVG, concise content-based assistance.
6. Compiled browser/API/unit/accessibility acceptance and evidence; close checkpoint.

No provider, credentials, paid platform, database schema or operational endpoint is
introduced. Allie is a deterministic website guide, not generative AI or live record
lookup. Revised search extends existing catalogue semantics to all eligible kinds.

## Fixture acceptance contracts

| Case                     | Required evidence                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| H01/H02 Help entry       | Branded card, navigation link vs assistance button, FAQ search/category/contact regression                                      |
| H03/H06 Hub              | Three modes at top, keyboard tabs, accurate Recommended labels, no false page-context claim                                     |
| H05/H07 Tasks            | Plain task titles, numbered steps/prerequisites/outcome, source disclosure and query/mode-preserving Back                       |
| Search                   | Articles/guides/practice, synonyms and ordinary questions; unavailable load differs from no match; retry                        |
| H04 Allie                | Compact panel, grounded short answer/source/actions, unknown/context fallback, no hub clone                                     |
| Access                   | Guest/customer/care/finance/technician/admin/owner fixtures; account/access change clears private transient state               |
| H10 Guide                | Oil-filter search after settled results, 30-second refresh, target remount, loading/missing target, pause/restart/back/exit     |
| Live control             | Guide non-modal; no injected values/submissions, dirty live draft retained                                                      |
| H08/H09 Practice         | One persistent mode marker, editable sample fields, honest choice-only hint, specific decision feedback                         |
| Isolation                | No business writes/uploads/messages/external requests; no practice text in persistent storage or live forms; reset/leave clears |
| Responsive/accessibility | 360/390/768/1024/1440 widths, keyboard/Escape/focus return, scoped Axe, reflow/reduced motion                                   |

## Reproduction before repair

Using installed Edge and the actual isolated API at localhost, `/parts#learn=parts-find`,
entering **oil filter** and submitting Search reproduced blocked Next after settled
results on a second run, with the value still present. Another run briefly remained
ready. The existing 30-second catalogue refresh left Next disabled. The implementation
reset ready on each access recheck/new definition object and bound listeners to one
DOM node without reconciling already-entered input. This is an observed timing-dependent
failure; the brief alone was not treated as proof of its cause.

Evidence: `%TEMP%/allied-allie-20261026/before-guide-refresh-blocked.png`, plus
before-guide-desktop.png, before-learn-desktop.png and before-help-desktop.png.
New task database verified as exact-loopback `help_allie_21a045ec5c_ci`, test environment,
with a newly created restricted role and replayed migrations. No application target.

## Design reference and verification boundaries

Design reference: `C:/Users/PC/.codex/generated_images/01a15335-80c3-7c91-a2cc-f2d5d33853db/exec-1f2332cd-41f3-4175-a346-c1053f689695.png`.
The board supplies the hierarchy, compact robot/panel, three modes, card anatomy and
restrained red/neutral palette. Existing truthful navigation/content/contact/brand
assets take precedence over generated example copy, fabricated popularity and the
board's erroneous country footer. No generated bitmap is shipped as UI or mascot.

Browser plugin is not available; use the repository Playwright workflow with installed
Edge. Installed Next is 16.3.8 versus locked 16.4.3; no duplicate dependency install.
Physical devices, actual production role records and full screen-reader acceptance
must remain separate from local fixtures, emulation and automated scans.

Accessibility reference checks:
[modal focus/Escape](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/),
[tabs keyboard](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/),
[reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Implemented capabilities

- A restrained robot/brand card replaces the bare Help link. FAQ search remains a
  separate prominent task. Footer navigation also exposes Help & Learn. The existing
  catalogue-only Help component shares the card; actual rendered acceptance below
  covers the current browse/enquiries release.
- The hub exposes Find an answer, Guide me and Practise near the top. Keyboard tabs,
  meaningful task icons, content kinds, conditional Clear search and query/mode-preserving
  article/written-guide/practice navigation replace the three stacked lists.
- Shared eligible content powers both hub search and Allie. Articles have numbered
  steps, prerequisites/outcome, source disclosure and Back to results. No generic
  "Relevant to this page" claim is applied on the hub. Reviewed article IDs and guide
  hashes stay valid; title changes do not create replacement routes.
- Allie is a configurable single working-name constant and repo-native SVG, lazy-loaded
  compact panel/sheet with short grounded explanations, source/version, alternate-topic
  choices and read/start-guide/practice/contact actions. It does not clone the hub.
  No model/provider/vector platform, live record lookup, DOM scrape, secret capture or
  action tool exists. Unknown and load-failure states offer an honest fallback.
- Close/Escape returns focus without scrolling the page. Session hide is reversible
  from Help navigation. Identity changes clear private questions/answers; capability
  changes re-key private mounted views on the existing revalidation boundary.
- Guide learning-interaction evidence survives current-definition refresh and target
  replacement, without storing form values. Busy read targets cannot be marked ready;
  a disabled Next explains the condition. Missing controls offer written steps. Back,
  Next and Exit are primary; pause/resume/restart/written controls are in Guide options.
  Live walkthroughs remain non-modal and never fill, click or submit for the learner.
- Practice has one sticky "Practice · Sample data" signal, editable samples, honest
  choice-only hints and specific feedback. Customer Care adds a sample conversation
  and public reply draft. Text assessment is explicitly limited to required-length/
  decision checks. No competence or verified fitment is claimed. The floating support
  toolbar is suppressed on dedicated practice routes, leaving their controls clear;
  Exit and related-help links remain available.
- Added administrator-only product-photo instructions after inspecting the actual
  gallery/reorder/main-image workflow. The existing `/admin` gateway is retained in
  the server contract for compatibility with already-open older clients; use Products
  from there. No new permission, product family or operational mutation is introduced.

## Checks and actual acceptance

Frozen runtime candidate before the final visual polish: `d0272949`; backend batch
`38e7df62`, frontend batch `d0272949`. Final bounded polish: `aa54fba8`.
Later documentation/evidence changes do not change runtime behaviour.

| Check                               | Actual result                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit/access/search suite   | 159 files, 1,039 tests passed locally and in locked CI                                                                                                                           |
| Frontend lint/types/build/postbuild | Passed locally; installed Next 16.3.8, standalone local build                                                                                                                    |
| Backend lint/types                  | Passed; repository oxlint and TypeScript                                                                                                                                         |
| Actual authenticated learning API   | 7 integration cases passed, including all workforce templates, private direct/search denial, session/assignment revocation, public-vs-private routes and all-kind/synonym search |
| Final content polish API rerun      | 7/7 passed on the same verified task-only isolated target                                                                                                                        |
| Database safety                     | 71-migration empty replay, db:check/schema comparison passed; restricted runtime owns no tables and has no elevated/schema-create/TRUNCATE rights                                |
| API contract                        | Export/type generation, 364-path OpenAPI validation and 424 mounted-operation coverage passed; no new route or write contract                                                    |
| Compiled browser baseline           | 29/29 passed against the real isolated API with learning enabled and `NEXT_PUBLIC_PUBLIC_LAUNCH_MODE=browse_enquiries`                                                           |
| Final visual polish                 | Follow-up compiled checks and refreshed practice screenshot recorded at closeout below                                                                                           |

Locked CI for `d02729493009e92a521ebf9c8e52e1c09dd39ff4`:
[frontend](https://github.com/Otto-space/allied-autotech/actions/runs/40342348973),
[backend safety](https://github.com/Otto-space/allied-autotech/actions/runs/40342348780),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40342348948)
all passed. Frontend log confirms Next 16.4.3 and 1,039 tests. Production audit
reported zero vulnerabilities; install still reported three development dependency
findings (two moderate, one high). No dependency or lockfile change was made.
The final polish has a separate CI run; do not conflate the two source hashes.

Browser coverage uses installed Edge via the existing Playwright workflow: Help,
hub and assistant at 360/390/768/1024/1440; existing practice at 320/390/768/1440;
logical reflow at 320/640 and reduced-motion emulation. These are CSS viewport
checks, not physical devices, native mobile keyboards or native browser zoom.
Actual local guest, customer, care officer, accountant, technician, administrator
and Super Admin fixtures were exercised. The API suite additionally covers effective
responsibility unions, assignment-derived eligibility and expired/revoked access.

The oil-filter regression was exercised through submit and settled results, a focus
access recheck, the real existing 30-second refresh, target-node replacement, Next,
Back and completion. Missing-target/wrong-page/written/pause/restart/exit states and
customer dirty-draft preservation passed. No modal trapped the actual guide target.
Initial development timing produced one scenario timeout; direct/API-rewrite reads
and subsequent optimized role acceptance passed. A broad test label that matched
WhatsApp instead of the message textbox was corrected to the actual textbox.

Keyboard tabs, dialog focus containment/Escape/return, clear/retry/unknown states,
source links, unavailable direct links, role-change clearing, hostile HTML as inert
text and scoped Axe (including contrast) passed in the baseline. Relevant console
exceptions/framework errors are monitored; expected denied/failed-resource responses
in fault-injection cases are distinct from unexpected application errors. Automated
scans plus these interactions do not establish full WCAG conformance.

Practice network observation found no business mutations, external HTTP, messaging,
approvals, payments or uploads. Both correct and risky choices, sample edit/replace/
cancel/reset, identity clearing and leave/reopen were exercised. Practice text did
not enter local/session persistent storage or live forms. The explicit in-memory
adapter has no operational client or live mutation callback. Test-fixture creation
and session bookkeeping occur only in the new isolated database; they are not
production/customer operations.

## Screenshots and design review

Current safe fixture captures: `%TEMP%/allied-allie-20261026/`.

| Surface                            | Evidence                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Help entry, existing FAQ layout    | `help-1440.png`, `help-390.png`; other requested widths also retained                                                         |
| Three-mode hub                     | `learn-1440.png`, `learn-390.png`; 360/768/1024 captures retained                                                             |
| Grounded assistant                 | `assistant-1440.png`, `assistant-390.png`; all five widths retained                                                           |
| Live guide after oil-filter search | `guide-after-oil-filter.png` and before-regression captures above                                                             |
| Sample reply practice              | `practice-care-desktop.png`, `practice-care-mobile.png`                                                                       |
| Fitment practice                   | `practice-320.png`, `practice-390.png`, `practice-768.png`, `practice-1440.png`; final review captures use the polished build |

Inspected both the generated concept board and actual current captures with
`view_image`. Fidelity ledger:

1. Hierarchy: compact title/search, three modes and selected-mode results match the
   reference structure. Five actual public answers replace the board's three example
   cards; no invented popularity, duration or completion numbers.
2. Palette/containers: restrained red actions, selected tinted mode, white surfaces,
   light borders, 12px cards and consistent gutters follow the reference. Existing
   brand header/footer and fonts remain authoritative instead of repainting them.
3. Robot: small white/charcoal rounded SVG with calm eyes/red antenna matches the
   intended treatment. No bitmap, animation dependency, sound or looping motion.
4. Panel: compact desktop placement and deliberate mobile sheet with reachable close
   replace the blocking full-hub clone. Fixed a native dialog max-width constraint
   during mobile review; keyboard and narrow-width checks passed.
5. Copy/actions: approved real content, actual navigation and existing Nigerian contact
   details replace reference-only example topics, false popularity and its erroneous
   country footer. Brand button casing is preserved. Above-the-fold additions are
   the truthful audience/count/search-privacy helper and required existing navigation.
6. Practice: removed duplicate banners, clarified sample/hint behaviour and retained
   one mode label. Final review removed toolbar obstruction and repetitive feedback.

The requested interaction structure and visual component families were verified
against the reference with these intentional repository/business constraints; this
is not a claim of pixel-identical replacement of the site's approved global chrome.

## Limits, cleanup and resume

No generative AI provider is configured or required. The content-based guide is the
implemented capability; live records, actions, transcripts, CMS, training management
and new business policies are outside scope. Missing approved policy is not filled
with invented answers. Physical devices, native keyboards/zoom, complete screen-reader
review and real authenticated production-role acceptance remain unverified.

No schema migration, shared/production database write, real message/upload/payment,
grant change, production publication or main-branch merge occurred in this refinement.
The feature branch was pushed for locked CI. The existing production release remains
the separately recorded `adef02f9`; any future rollout must recheck concurrent releases,
aliases, actual target and backup/restore gates. Examples/default flags stay off.

No dependency installation, browser download, new worktree, Docker build/image/pull,
profile clone or archive was created. Current local source/build/cache, small review
captures, isolated task database and protected fixture credentials are retained for
reproduction. Existing Docker resources/data and all unrelated worktrees remain intact.
Final reserve, process shutdown and final-polish receipts are recorded at closeout.

## Closeout

Runtime candidate `aa54fba8378d879e50ca99750dd7cf6e9fa2195e` is implemented,
committed and pushed on the feature branch. Final local browse/enquiries build and
postbuild passed. After the 29-case compiled baseline, **six targeted compiled
polish rechecks passed**: mobile Help/hub/Allie, unknown/error/hide/restore with an
unsent contact draft, private identity clearing plus editable care practice, the
choice-only hint, actual care-role practice, and mobile fitment validation/Axe/reset/
isolation. The new no-toolbar assertion passed; refreshed care captures explicitly
verify scroll=0, header at y=0 and no support toolbar. Additional final 320/768/1440
fitment captures show no toolbar or overflow. Screenshots are actual fixture renders,
not the generated concept or a depiction of production/customer records.

All three final-source workflows passed:
[frontend release](https://github.com/Otto-space/allied-autotech/actions/runs/40343753262),
[backend database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40343752891),
[redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40343752877).
The earlier detailed CI log excerpt above belongs to `d0272949`; final-source jobs
also passed the repository's locked install, production audit and release checks.
No production deployment was performed by this refinement.

Local proxy verification emitted the existing express-rate-limit forwarded-header
diagnostic with socket trust; no proxy trust was broadened to silence it. Existing
experimental crypto/pg and Vite configuration notices did not fail acceptance.
These local diagnostics are distinct from the monitored compiled-browser exceptions
and deliberate unavailable/unauthorised responses. Real hosted authentication,
screen-reader and physical-device review remain open as stated above.

Completion inventory: Docker unchanged at 67 images / 12.14 GB, 147 cache entries /
7.574 GB, the same 13 stopped containers and the same 14 data volumes. No image,
cache or volume was deleted. C: reserve postflight measured **28.85 GiB free**;
initial task preflight was 29.70 GiB. This is a point-in-time measurement, not an OS
quota. Owned API/frontend previews are stopped at handoff; isolated fixtures and
current evidence/build/cache are retained. Main checkout continuity is append-only.
Broader site-completion Item 6, unrelated dashboards/home work and business-policy
decisions remain outside this completed implementation batch.
