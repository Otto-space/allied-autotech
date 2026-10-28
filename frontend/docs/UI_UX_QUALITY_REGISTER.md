# UI and UX quality register

## 28 October 2026: bounded public content and imagery improvement

Current cycle: owner's content brief, instruction 7. Home now has a stable offer,
three distinct tasks, sparse published services, real equipment, compact Shop and
vehicle preview, conditional real feedback and practical visit/help information.
Repeated motto/campaign/principle/process blocks are removed from Home/Services;
About retains the approved mission and all principles. Vehicles uses a separate
neutral editorial derivative and charcoal caption; originals and factual colours
are preserved. Missing product photos are excluded from Home eligibility, while
catalogue fallbacks and authoritative stock states remain. See
[copy, imagery and acceptance handoff](PUBLIC_COPY_IMAGERY_20261028.md).

Evidence: local types/lint; 23 focused state/regression cases; Home fixtures at
320/360/375/390/430/768/1024/1280/1440/1536px; synthetic empty/error/retry,
published reviews, broken/long media, doubled text, menu/keyboard, and scoped
Axe at 390/1440px. First failures included stale fixture stock/refresh assumptions,
missing fixture detail data and a mobile hero contrast regression, corrected.
Read-only public-data layout/interaction coverage passed all five pages at five
widths. Published bee7ed8f / dpl_Akw8ic1B6NQFGgL7tDDrm3pskZZ3 on both domains
with all three exact-source CI gates successful. Hosted acceptance passed 12
recorded checks at 390/1440px, including www refresh/scroll, Allie launcher/focus,
contextual vehicle enquiry and equipment anchor. Final current-tree fixture
recheck passed six responsive/state/Axe cases; counts 0/1/3 and pricing selection
also passed isolated browser fixtures. See the linked handoff for evidence/limits.
No real stock/reviews, backend, permissions or commerce/AI/chat flags changed.
Outstanding editorial copy/photo/reviewer dependencies are recorded separately;
physical devices, full screen-reader and signed-in journeys are outside this cycle.

## 28 October 2026: product detail fitment availability and retry

Route `/parts/89fd9258-c580-43e9-9040-c7e52623e82d`, anonymous at 390/1440px.
The published API returned zero vehicle makes. The live product detail still
said "Choose your vehicle to check approved fitment evidence" while its action
changed to "Browse products" because there was no vehicle to choose. That
contradiction makes the customer look for a missing control. The selected
product's enquiry link and editable contact draft were verified end to end;
no message was submitted. The 390px action was initially behind the fixed
support dock at the bottom edge of the viewport, but normal scrolling and
keyboard focus exposed it and the actual link opened the correctly focused
form. Dock placement remains a separate mobile usability review, not a
claimed blocker in this cycle.

The product fitment summary now says when vehicle choices are not available,
directs the customer to ask the team to check suitability, and distinguishes
that state from a failed lookup with a retry button. It preserves any actual
fitment decision and the existing product enquiry. The published product,
price, availability and compatibility claims were not changed.

TypeScript, scoped ESLint and Prettier passed. The updated rendered product
audit passed 2/2 cases at 390/1440px, including empty lookup, failed lookup,
retry recovery, product enquiry/collection, keyboard focus, scoped axe, no
overflow and intercepted account mutations. An initial local attempt used
the test fixture's old blanket 401 for browser catalogue reads and timed out;
the fixture now passes only public catalogue GETs to the same read-only
backend that supplies the server-rendered page. Other API writes stay
intercepted. Live before evidence: `%TEMP%/aat-live-product-detail-390.png`
and `aat-live-product-detail-1440.png`; local after evidence is in the
product-audit Playwright output. Exact-source CI, hosted post-release check,
real-customer and physical-device acceptance remain open.

## 28 October 2026: combined Allie integration regression correction

The held consolidated 8e6aab3b candidate reproduced two integration defects at
390/1440px: the newer explicit Learn page classification removed guide/practice
suggestions from Allie, and the merged loading message added about 42px during
access checks. Learn now offers only the guide/practice definitions already
present in its verified catalogue and permitted by its feature flags. Unrelated
page filtering remains in place. The existing positioned loading treatment is
retained while verified content is hidden and inert, with guarded focus recovery.
Conversation/handoff state boundaries, workforce invalidation and security-page
restrictions remain unchanged. Three new focused route/flag cases and the adjacent
access/conversation/handoff/search cases passed (41 tests in five files). The
failed hosted run is retained. Corrected hosted acceptance passed 47 cases; master
`a51a58b8` is published on both domains after all three exact-source CI checks
passed. Public apex/www acceptance passed 23 cases each. Exact release evidence
and remaining limits: `backend/docs/master-consolidation-release-20261028.md`.
Browser plugin unavailable: hosted checks use existing Playwright with Edge and
isolated API fixtures. They do not send support messages, seed inventory, upload to
real storage or call an AI provider. Physical-device and real-role limits remain.

## 28 October 2026: deployment-aware API image URLs

The integrated held candidate `4fbc9cbb` exposed a real framework/API mismatch.
The installed Next 16.4.3 adds `?dpl=...` to relative unoptimized image sources
on Vercel; the public product/vehicle and protected preview endpoints deliberately
accept no query parameters. Four controlled tests reproduced the URL change with
the real framework deployment bootstrap. `PublicMedia` now uses `overrideSrc`
only for its already-validated API image URLs. This preserves Next image geometry,
loading behaviour, fallbacks and approved-host/preview boundaries while keeping
the API URL exact. Server validation and permissions remain unchanged.

The first hosted run retained 68 passes and 13 failures as evidence. Four were
the known not-found stylesheet warning with Vercel's deployment query; six were
gallery/upload cases requiring investigation or fixture-environment correction;
three were DNS/connection failures. The upload fixture's `.test` storage host is
correctly unapproved in production and must be intercepted at a configured public
storage hostname for hosted acceptance. No real storage upload is authorised by
the test. Corrected rendered acceptance and publication remain pending.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

## 28 October 2026: Notification bell preview prioritizes unread updates

The initial live frontend `09efa694` / `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F`
showed an unread badge, but its five-row bell preview requested the newest rows
without an unread filter. A newer read item could displace an older unread item
from that preview. The shared customer and workforce bell now fetches up to five
unread rows when the opening count is positive. If another tab has already read
those rows, it fetches recent history instead of showing a misleading empty
preview. Opening the bell does not change read state; row links still route
through the currently authorized notification target.

The focused four-case jsdom suite passed. TypeScript and scoped lint passed.
Rendered Playwright/Edge fixtures passed the mixed read/unread case and all eight
customer, staff, admin and super-admin journeys at 390/1440px (9/9); the first
browser attempt used `127.0.0.1` and Next blocked its development resources,
then the same test passed on the server's `localhost` origin. Fixtures do not
prove live authenticated-role behavior. No customer record, read state, message,
backend, schema or provider was changed. Physical-device and full
screen-reader acceptance remain open. During release preparation, both domains
advanced to navbar runtime `4aafaebb` / `dpl_F5XnU2aiSxhtK78P8dnbvrffYCR5`.
Both domains then advanced to favourites runtime `ef06efb7` /
`dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv`. Both published sources are merged into
the notification branch. On that source, 36/37 integrated header and
notification browser cases passed with Help & Learn enabled. The remaining
historical-commerce case passed after setting the local launch mode to the
production `browse_enquiries` value; the default `full` fixture had exposed a
test-environment mismatch. Exact-source GitHub frontend, secret and backend
safety checks passed on `ddfab325`. Production then advanced to Learn/Allie
runtime `072e0509` / `dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz`; that source was
merged. A local full check was stopped
after the disk preflight fell below the owner's 20 GiB reserve; the shortfall
later cleared without any cleanup. The product-favourite browser fixture
requires server-side product data and cannot run on this standalone server.

Final runtime `1a33815c` passed frontend release CI `40713279695`, secret
guard `40713279399` and backend safety `40713279822`. Vercel built
`dpl_71G8rw7VmXo7WZZCDJpvTb5eCMib` from that exact SHA with production
settings; protected hosted reads of Home, Help, Learn, Parts and Notifications
returned 200. Promotion succeeded and both custom domains independently
resolved to the same READY deployment. Post-promotion Playwright passed the
mixed unread preview plus eight customer, staff, admin and super-admin
journeys at 390/1440px with synthetic API data. No production notification
was marked read and no real account write occurred. The previous
`dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz` release remains available for rollback.
Real authenticated-role, physical-device and full screen-reader acceptance
remain open. Disk reserve was rechecked after promotion and no Docker resource
or database was modified.

## 28 October 2026: Learn, Allie and walkthrough interaction audit

Owner requested exhaustive interaction of /learn, Allie and optional walkthroughs.
Finite cycle covers anonymous public journeys, synthetic delayed/error/access changes,
keyboard controls and narrow/desktop layouts. Reused the contact-validation worktree
on fix/learning-interaction-audit-20261028, initially from dfd79d91 (same runtime
as published 4aafaebb). A later favourites release ef06efb7 was observed during
verification and was merged before publication. Other dirty work is preserved.

Verified P1/P2 issues and fixes:

- Learn selected Find an answer while showing guides/practice. Explicit All help
  selection, matching panel label and keyboard Home/End/arrow handling now agree.
  Search submission reveals/focuses results; Clear search restores the input.
  Text-field blur does not interpret aria-controls as a navigation instruction.
- Allie ranked the broad homepage overview above the specific parts task. Exact
  normalized task-title matches now rank ahead without using unrestricted content.
  Repeated questions/intents reveal the answer; whitespace gets actionable feedback.
- Periodic/focus access verification collapsed Allie and dropped input focus.
  Content remains invisible, aria-hidden and inert during checks, retaining geometry.
  Focus restores after the React commit only when the access key is unchanged and
  no intervening interaction selected another destination. Denial/malformed data
  removes previous content; identity changes clear inputs/progress as before.
- Mobile Try page controls silently returned to written mode. The ineffective action
  is absent on compact screens; responsive highlights resume on expansion unless
  written mode was deliberately chosen. Missing/obscured controls offer an immediate
  written fallback. Step changes reset panel scroll, completion retains a focus
  destination, and removing/changing the same-page guide fragment closes the guide.
  Cross-page pause remains supported. A final real-content probe also found that an
  unavailable guide stayed over Learn after Available learning; that navigation now
  explicitly closes its guide, with a regression assertion. Guide exit restores an
  available same-page launcher after the floating dock becomes visible again.
- Practice search/review results are focused and revealed. Existing local-only inputs,
  explicit sample replacement, errors, choices, reset and exit boundaries remain.

No backend content definition, semantic target, business rule, permission, feature
flag, transaction or database change. Reviewed catalogue and eligibility remain
server-owned. Generative AI remains off. No actual support or account write.

Browser plugin unavailable; existing Playwright/Edge and dependencies reused.
Fifteen focused learning units pass, scoped lint and TypeScript pass. New ten-case
browser suite exercises search/empty recovery/disclosures at 320/390/768/1440px,
Allie repeated questions/alternatives/context/intents/keyboard close, delayed access
geometry/focus, denial/retry/identity changes, responsive guide pause/resume/restart/
completion/hash/error recovery, and practice errors/replacement/review/reset/return.
The first delayed-focus run exposed a React commit timing race; restoration moved
from a requestAnimationFrame into the post-commit effect and both focused cases
passed. Ten interaction cases passed locally before the last recovery-link
assertion was added; the combined local run reached 23 passes before a renewed
disk-reserve stop. Final exact-source hosted regression is recorded below.
Evidence remains in %TEMP%/aat-learning-* and the maintained e2e/unit tests.

Disk preflight initially passed at 26.74 GiB free with a 1 GiB budget. A later
measurement fell to 19.15 GiB; task-owned dev/browser/test processes were stopped.
Read-only inventory preserved all source, caches, dependencies, other tasks and
Docker/data resources. Free space subsequently returned to 25.74 GiB without any
agent deletion. A subsequent check again fell below reserve. Native npm cache
verification
reclaimed 185 unreferenced blobs (101,752,433 logical bytes). Automatic approval
review rejected the combined generated-cache/duplicate-CLI removal command with
"blocked by policy"; no alternate agent deletion was attempted. At the owner's
request, exact manual PowerShell/native npm instructions were supplied. The two
generated directories were subsequently absent and a fresh preflight passed at
20.45 GiB free before hosted testing. These are point-in-time measurements, not a
machine-wide quota guarantee.

Acceptance limits: intercepted data is synthetic, not real authenticated-role
acceptance. Physical Safari/Android phones, mobile OS keyboards, full screen-reader
acceptance and inaccessible private guides remain unverified. No claim of complete
WCAG conformance or absence of every possible site defect.

### Learning audit production release

Final runtime `072e0509683df08c8635c495a76245ea1cc60379`, Vercel
`dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz`, is READY and promoted on apex/www.
The promotion guard verified project, runtime, both previous alias ancestries and
all three green exact-source workflows. Preserved prior favourites deployment
`dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv` / `ef06efb7` for rollback. The first build
`dpl_2yoSNBWLTchrnmzy49kGXgUjKMtt` was superseded by the final recovery-link repair
before public alias promotion.

[Frontend release CI](https://github.com/Otto-space/allied-autotech/actions/runs/40710727313),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40710727576)
and [isolated database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40711362859)
passed. Frontend gates include locked dependencies, zero reported production audit
vulnerabilities, lint, types, complete units, Next 16.4.3 optimized build and format.
The last frontend-only commit did not trigger the path-filtered database workflow;
it was explicitly dispatched at the same frozen commit and passed against isolated
CI PostgreSQL. No application database test/write or backend release occurred.
Backend `8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650` remains ACTIVE without pending
release. Provider backup inventory showed eight backups, newest 2026-10-28T05:22:10Z;
existing separate restore receipt passed with equal original row hashes on
2026-10-26T19:53:05Z. No new shared restore or database safety override.

Hosted acceptance passed all 39 cases on actual deployed CSS with no asset patch:
%TEMP%/aat-learning-hosted-regression. This includes ten new interaction cases,
seven refresh/Help/authentication-focus cases, ten dock/navigation/selection cases,
five container/control-focus cases and seven navbar cases. APIs are intercepted
synthetic GET/auth fixtures; these do not count as real signed-in acceptance.

Separately, real public-content interaction passed at 390 and 1440px: all six
available articles and both disclosures, search/modes/clear/empty recovery, Allie
relevance/repeat/alternatives/context/guide/practice controls, guide entry, page
highlight, written reference, pause/resume/restart/completion/exit, same-page Allie
guide start, and the actual Corolla practice's sample fields, fictional search,
each evidence disclosure, each choice/review, reset and return. Additional real
320x568, 701x900 and 844x390 checks passed for overflow, modal fit and close access.
Scoped automated Axe scans passed for hub/Allie. There were no page exceptions or
API writes in this public audit. Receipt: %TEMP%/aat-learning-live-acceptance.json.
Screenshots aat-learning-final-hub-320.png, aat-learning-final-hub-1440.png and
aat-learning-final-allie-390.png were visually inspected; files remain in %TEMP%.

Real www-domain 390/1440 checks also passed repeated article refresh without the
dark focus border, specific Allie relevance, hide-floating-help/Help-card reopen,
keyboard focus return, retained Whatsapp access and unavailable-guide navigation
cleanup. Receipt: %TEMP%/aat-learning-www-acceptance.json. Both provider aliases
were rechecked against the same final runtime/deployment. Physical-device, real
private-account and full screen-reader acceptance remain open.

## 28 October 2026: Stable navbar through Help to Learn navigation

Reproduced the owner's exact anonymous journey on deployed source `09efa694`:
Help → Explore Help & Learn. Desktop frame samples repeatedly alternated header
height 78px/68px and scrollY 20px/10px. The brand stylesheet shortened the sticky
header when scrollY exceeded 12px; browser scroll anchoring then crossed that same
threshold in the opposite direction, creating a continuous feedback loop. Mobile
390px retained its 68px header and did not exhibit that height loop in this probe.
Before receipts: `%TEMP%/aat-navshake-before-390.json` and
`aat-navshake-before-1440.json`.

Removed the scrolled-state height override. Header geometry now remains stable at
its existing responsive height: 78px above 700px and 68px at/below 700px. Existing
scroll elevation/background treatment and navigation behavior remain. The source
change is limited to the brand stylesheet; the preceding focus, Help, customer
history and saved-item releases are preserved. No permissions, data, flags or
backend changes.

Browser plugin unavailable; reused Playwright/Edge. All seven pre-publication
regression cases passed at 390, 700, 701, 768, 1024, 1280 and 1440 pixels, using the
real optimized production stylesheet with only the offending height declaration
removed in intercepted asset responses. Checks sample header/brand geometry during
the actual link transition and loading/results states, verify settled scroll
position, visible destination breadcrumbs, scroll positions 0/10/13/20/35/200,
retained scrolled shadow, and Back/Forward navigation. APIs were intercepted
read-only synthetic responses; no real writes. Receipt:
`%TEMP%/aat-navbar-prepublication`; screenshots `aat-navbar-stable-390.png` and
`aat-navbar-stable-1440.png`. These are pre-publication probes; exact deployed-CSS
acceptance is recorded below after release. Real signed-in account changes,
physical-device browser behavior and other inaccessible states are not claimed.

### Navbar production release and hosted acceptance

Runtime `4aafaebb5ab3f42bf8fd6c99c0e4fa7bdb0df42e` was built READY and promoted
as `dpl_F5XnU2aiSxhtK78P8dnbvrffYCR5`, confirmed on apex/www after acceptance.
The guard verified project/source, green exact-source checks and inclusion of both
previous alias sources. Prior `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F` is retained for
rollback. No backend deployment or application data write was initiated by this
task. A concurrent backend release was observed ACTIVE as
`8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650`; it was preserved and the real public
journey was verified against it.

Exact-source [frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40702876484),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40702876575)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40702876589)
passed. Frontend checks include locked install/runtime audit, lint, typecheck, full
unit suite, optimized production build and formatting. The only runtime diff from
the prior release is the four-line brand stylesheet change.

All seven browser regression cases passed against actual deployed CSS with the
asset override disabled: `%TEMP%/aat-navbar-live-tests`. These use intercepted
read-only API fixtures. Separately, the exact Help → Explore Help & Learn → open
an answer journey passed against real public content at 390 and 1440px, with
Playwright's scrollbar hiding disabled. Header/brand geometry remained stable
through 183 mobile and 174 desktop frame samples; heights stayed 68px and 78px,
and settled scrollY stayed 8px and 20px. No page errors; the article focus outline
and shadow remained absent. Receipt `%TEMP%/aat-navbar-live-acceptance.json`, frame
traces `aat-navbar-after-390.json` / `aat-navbar-after-1440.json`. Screenshots
`aat-navbar-live-390.png` / `aat-navbar-live-1440.png` were inspected. The separate
pre-publication classic-scrollbar/loading probe also kept desktop header width
1425px and brand x=52.5px across the transition.

Private signed-in account-state changes and physical Safari/Android devices remain
unverified. No dependency installation, duplicate local build, new worktree or
Docker resources were required. Final disk preflight passed at 26.53 GiB free;
this is a point-in-time check. Unrelated main checkout changes were preserved.

## 28 October 2026: All automatically focused containers

The owner confirmed that the dark automatic-focus border must be removed from all
containers, including completion headings, dialogs, confirmation/status/error
panels and grouped sections. Interactive keyboard controls retain their focus
indicators. Reproduced the reported direct refresh at
`/learn?article=parts-fitment` on production source `0b5a9b76` /
`dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno`: the focused answer had a 3px dark outline
and white focus shadow despite its existing exception. The optimized stylesheet
loaded a scoped learning rule after an equal-specificity global exception. About,
workforce and payment styles also have container focus selectors.

The root policy now covers programmatically focused non-interactive negative-tabindex
containers, dialogs and static ARIA panels as well as the existing destination
marker. Its explicit specificity exceeds the scoped container rules regardless of
chunk order. Native controls, editable fields and composite widgets (including
negative-tabindex options) are excluded. Normal dialog borders, error borders,
focus ownership, announcements, scrolling, keyboard behavior and permissions are
preserved. No component rewrite, backend/schema, content definition or flag change.
The newer customer-history/saved-item release is the base and remains included.

Browser plugin unavailable; reused installed Playwright/Edge. Pre-publication
checks used the exact source policy prepended to real optimized stylesheet
responses, with CSP enabled. Five regression cases passed: direct article refresh
three times at 390/1440 pixels; Allie response focus at both widths; automatic
heading/section/panel/fieldset/status/error/dialog focus, retained error/dialog
borders and retained keyboard field/button/roving-option focus. An additional
anonymous browser audit passed 19 public routes and their rendered static focus
targets (Home, About, Contact, Help/article, Learn/article/unavailable guide,
authentication pages, Services, Shop, Vehicles, Reviews, Privacy). These are
asset-patched pre-publication checks, not yet exact deployed-source acceptance.
Receipts: `%TEMP%/aat-container-focus-patched-final`,
`aat-container-surface-patch.json`; before image `aat-reading-border-before.png`.
Protected-role completion/error states have source/policy coverage plus
representative synthetic panels; no real private records or transactions were used.
Physical Safari/Android and actual staff-account acceptance remain unverified.

### Published follow-up and actual hosted acceptance

Runtime `09efa694603ea7b1fcb3312974543a7e262cdf6d` is READY and assigned to both
apex/www as `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F`. The guarded promotion verified
exact project/source, all required CI results and that both then-current production
sources are ancestors of the candidate. Prior `dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno`
(`0b5a9b76`) remains the rollback target. Backend deployment remains unchanged.

Exact-source [frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40685951828),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40685951914)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40685952202)
passed. Frontend checks include locked install, runtime audit, lint, typecheck,
full unit suite, optimized production build and formatting. No local duplicate
build, dependency installation, worktree or Docker resources were created.

After deployment, all five regression cases passed on the real optimized CSS,
with the asset override disabled. The first run's desktop/panel cases encountered
connection resets; a sequential recheck passed all three without a code change.
Receipt directories: `%TEMP%/aat-container-focus-live` and
`aat-container-focus-live-recheck`. The complete real-content, read-only 19-route
public audit then passed without overrides or page errors:
`%TEMP%/aat-container-surface-live.json`. An earlier concurrent audit's navigation
timeout is retained as an infrastructure/connection observation, not counted as
passing acceptance. No application API writes were sent.

The owner's exact article was also refreshed repeatedly using actual public
content: its focused container has `outline-style: none` and `box-shadow: none`.
The www article passed the same check. Before and after screenshots were inspected:
`%TEMP%/aat-reading-border-before.png` and `aat-reading-border-after.png`.
Authored prerequisite/error/dialog borders remain; focus stays on the intended
destination and controls retain keyboard indicators. Real authenticated private
states and physical-device/browser acceptance remain unverified as recorded above.
Final disk preflight passed at 27 GiB free, a point-in-time check; unrelated main
checkout changes were preserved.

## 28 October 2026: Refresh scrolling, reading focus and Help & Learn

Owner-reported cross-phone homepage jumps were reproduced on production
`552ee418` / `dpl_79uCiatbRsCvM2jtPJkwsx53efpP`. Two of three immediate-scroll
refreshes returned to zero after delayed focus of `main`; the global pointer-end
and visual-viewport handlers could also re-reveal an old focused destination.
Receipt: `%TEMP%/aat-refresh-baseline.json`.

The shared coordinator now leaves initial document positioning and history
restoration to the browser, adjusts genuine route entries/fragments, cancels queued
adjustments on new touch/wheel intent and reveals controls after a tap rather than
a scrolling/cancelled touch. Address-bar resizing does not re-focus old page
content. Native navigation is immediate. Reading destinations (breadcrumbs,
answers, Help results and MFA completion) receive semantic focus without a large
outline/shadow; keyboard controls retain their visible focus styling.

Help category selections reveal their results; search and clear retain useful
focus. The learning hub has breadcrumbs, waits for an answer to load before
revealing it, and offers written-answer recovery for empty modes. Corrected visible
question-mark separators. Allie offers eligible topic shortcuts, directs focus to
answers, supports another question and useful unmatched-search recovery, avoids
empty guide/practice actions and queues the first launcher click across hydration.
Navigation out of Allie no longer restores focus onto its old launcher. Modal
content remains internally scrollable without a visible scrollbar, with a fixed
close header. Guides add progress, retry, a deliberate show-control action and
compact mobile written steps with an expandable full reference.

Scope: existing public Help, Learn, Allie, optional guides and shared viewport
behavior, plus mocked login/MFA completion. Backend definitions, semantic targets,
permissions, feature flags and business policy are unchanged. Restricted learning
continues to be served and revalidated by the backend. Practice remains local.
This is a presentation/interaction cycle, not completion of the separate Revision 4
AI/workforce brief.

Verification: Browser plugin unavailable; reused Playwright and installed Edge.
Local evidence distinguishes browser-driven touch gestures, intercepted API
fixtures, automated axe checks and hosted anonymous acceptance. Focused browser
coverage includes refresh/immediate scroll and real CDP touch dispatch at 390/1440,
login redirect/MFA completion using synthetic responses, guide pause/resume/restart/
completion, Help category/search/clear/history, route breadcrumbs/repeated anchors,
linked form selections and fixed support/modal behavior from 320x568 to 1440x900.
Screenshots: `%TEMP%/aat-help-after-390.png`, `aat-help-after-1440.png` and
`allied-allie-viewport-390.png`. Local results: 20 distinct browser cases passed across the final focused runs,
including six dock/modal viewport cases, four navigation/selection cases, seven
refresh/learning/auth cases and three Help search/history cases. Four focused unit
files passed (14 tests); lint, typecheck, formatting and diff checks passed. The
old Help tests' two payment-label expectations were aligned with the tested launch
mode. A cold development auth navigation exceeded 15 seconds once; its focused
recheck passed, and the route wait allows development compilation. Production
checks and hosted receipts are appended below when complete. Physical iPhone/Safari/Android and real authenticated roles
remain untested; browser emulation is not their acceptance.

### Production acceptance

Runtime `0d4dd9921d28c7b9c87020c5c045496874473de2` is deployed as
`dpl_DAgy9emEabtd3H58kWjoBw35EUUc` to both alliedautotech.com and
www.alliedautotech.com. The guarded promotion re-read both previous aliases and
verified their source was included. Rollback is the preserved preceding deployment
`dpl_79uCiatbRsCvM2jtPJkwsx53efpP` (`552ee418`). No backend was redeployed.

Exact-source checks passed:
[frontend production checks](https://github.com/Otto-space/allied-autotech/actions/runs/40678376969)
(locked install, runtime audit, lint, typecheck, full unit suite, production build,
formatting), [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40678377082)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40678376941).
The Vercel production build is READY. No application database writes or migrations
were made. Read-only operational preflight found eight managed backup entries,
latest 28 October 05:22:10 UTC, and the existing successful separate restore receipt
from 26 October; this task did not perform a new restore rehearsal.

Live Edge acceptance passed at 390 and 1440 pixels: three actual reload/immediate
trusted touch gestures per viewport, Help search/result focus, full hub navigation,
public guide written-mode completion/exit, Allie unmatched-search/topic recovery,
another-question focus and Escape return. The six settled positions remained below
the preceding position rather than returning to the top. No page errors or real API
writes were observed. Receipt: `%TEMP%/aat-live-acceptance.json`. This touch check
replaces an unsuitable programmatic-scroll probe: native reload restoration may
replace a script-issued scroll, so that probe is not counted as user touch evidence.
The hosted login/MFA focus checks also passed (two intercepted synthetic cases,
`%TEMP%/aat-live-auth-focus`). The www learning page returned 200 with its new
breadcrumb and no horizontal overflow. Screenshots inspected:
`%TEMP%/aat-live-allie-390.png`, `aat-live-guide-390.png`, `aat-live-allie-1440.png`.

No Docker resources, dependencies or duplicate worktrees were created. Existing
suitable dependencies/worktree were reused. Final disk reserve preflight passed at
21.74 GiB free; this is a point-in-time check. Next acceptance priority is physical
mobile browser/keyboard behavior and genuine permitted/denied account journeys;
these are not certified by the synthetic authentication or Edge emulation checks.

## 27 October 2026: Workshop address and Whatsapp labels

Updated the public address to "133 Stadium Road, beside Kilimanjaro Pizza Jungle
Restaurant, Port Harcourt, Rivers State, Nigeria" in the shared business details,
Contact visit card, map destinations, Help guidance and search metadata. Public
contact surfaces no longer render phone digits; the footer, About and Privacy
offer a Whatsapp link. Existing call actions use descriptive labels. Messaging
links retain HTTPS and explicit opener/referrer protections. Search structured
data no longer publishes a telephone field. Link destinations necessarily retain
the number; this is not number secrecy or a claim about the business's WhatsApp
account encryption configuration.

Browser plugin not available; reused Playwright/Edge. Local anonymous checks at
390 and 1440 CSS pixels passed Contact, About, Help, Privacy and the workshop
guide: correct page title, meaningful main content, full address, no visible phone
digits, no horizontal overflow, no framework overlay or page errors. Map queries
contain the full address. Keyboard activation of the footer Whatsapp link opened
the expected HTTPS host with null opener and empty referrer (destination
intercepted; no message sent). Screenshots: `%TEMP%/allied-location-390.png` and
`allied-location-1440.png`; receipt: `allied-location-browser.json`. These are
local, mocked API checks, not real-device or authenticated acceptance.

Updated 27 October 2026. This is the ongoing quality register, not an assertion
that every route or state has passed review. Work proceeds in finite batches.

## Standing responsibility and source

Current bounded implementation: reviewed Customer Care handoff W15; see the final checkpoint and docs/help-learn/REVIEWED_HANDOFF_W15.md. Complete Revision 4 remains active.

Prior W14B checkpoint: W14B reviewed Care policy foundation. Immutable v1
is preserved; v2 adds separate view/reply/assign/live duties. Job positions remain
fixed, existing delegated v1 management stays usable and unknown old names do not
become authority. 45 native regression/final5 focused cases,51 backend units,
full1134 frontend plus29 focused/final12 component,8 final responsive fixtures,
types/contracts/lint/secret guard and final cached build passed. Fixed real review
reason loss while retaining immediate password clearing. Operational Care adapters,
handoff and staffed transport remain required; these duties are not declared usable
or deployed. See `docs/help-learn/WORKFORCE_CARE_POLICY_W14B.md`.

W14A prerequisite: branch-specific Care contact boundary. Mixed-branch
Staff/Admin and natural-expiry lock-wait defects were reproduced and corrected.
Six native cases,13 parser units and8 responsive fixtures at390/1440 passed;
foreign contact responses fail closed, legitimate Sales reply access remains.
See `docs/help-learn/WORKFORCE_CARE_CONTACT_W14A.md`. No publication/schema/provider
call; granular Care duties, reviewed handoff and staffed shared transport remain open.

Previous bounded implementation: Revision4 W13 scoped financial aftercare, branch
`feat/workforce-scoped-aftercare-20261027`, based on W12 `e31af199` in the reused
`allied-home-restoration-20261025` worktree. Finance branch scope and the separate
financial approval duty both govern the queue/detail/decision. Customer-visible notes,
internal evidence, current-review HMAC and uncertain outcome recovery are explicit.
Final62 native,60 backend units, full1130 frontend/final67 focused,21 responsive
fixtures and1 actual native-browser case passed, with types/contracts/lint/build.
No new schema, provider call, external customer message or publication. AI defaults
stay off and W9 allowance remains exhausted. Granular Care authority, canonical
reviewed handoff, gated shared staffed transport and all106 route learning acceptance
remain open. Evidence: `docs/help-learn/WORKFORCE_AFTERCARE_W13.md` and retained W12
booking/W11 independent-grant/W10 history/W9 evaluation checkpoints. Customer-table/
sidebar responsiveness remains Cycle13; unrelated newer release work is preserved.

Deployed colour/state baseline: the owner's complete colour/state brief, branch
`feat/colour-states-20261026` in the reused `allied-shop-vehicles-r2-20261025`
worktree, based on `3cea520f` / released runtime `8c11c3a0`. Shared black/red/white
tokens and contextual states are deployed as runtime `d6d8534d`, preserving the
newer workforce release. See [production evidence](../../backend/docs/colour-production-20261026.md).
See [colour/state report](COLOUR_AND_STATE_REPORT.md) for the exact evidence and
remaining native/platform and three cart-drawer verification gaps. The prior
customer-table cycle is retained below. Separate workforce work, permissions,
data and unrelated worktree edits are preserved.

Notification Cycle 8 was deployed on 25 October 2026 from runtime source `345847d5` after locked
Next 16.4.3 CI and optimized hosted acceptance. Genuine native delivery/click
acceptance remains open.
See Cycle 8 and [notification contracts/evidence](../../backend/docs/notifications-experience-20261025.md).
Real authenticated production-role acceptance and genuine native background-push
transport/click acceptance are not claimed. Cycle 8 retains the released Cycle 7
catalogue/enquiry behaviour and preferred Home.

Read the complete [29-section directive](Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md)
and root `AGENTS.md` before relevant work. The original supplied file is preserved
byte-for-byte, SHA-256 `3dd72b1af1f2c3e36162db1ddf089fb7fbad9fc39b1244c3e9902663202831d9`.
Future frontend contributors own interaction, accessibility, content, layout,
responsive behaviour, performance and recovery quality as part of their task.
Update this register when evidence or scope changes; regenerate the inventory
when routes or interaction surfaces change. Do not open a new audit document for
every small change or redesign an already effective interface without evidence.

The authoritative release source was `af9d8b94`, worktree
`allied-discovery-fitment-20261023`. The first cycle uses branch
`feat/continuous-ui-quality-20261024` in `allied-ui-quality-20261024`, based on
that exact source. The older main checkout and independent audit/copy edits
were preserved. Live baseline was Vercel `dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr`;
recheck both custom-domain deployment IDs before publication. Existing
site-completion decisions remain in `backend/docs/site-completion-tracker.md`.
The already authorized deployment does not enable payments or other real
operational actions. Current launch mode is `browse_enquiries`, workshop
collection only; no fabricated stock, fitment evidence, products or vehicles.

## Route, role and state inventory

[Machine-readable source inventory](ui-quality-inventory.json) lists all 106
`app/**/page.tsx` route patterns, dynamic segments, role families and 338 source
files with form, table, disclosure, select, file input, dialog, feedback or
boundary signals. Regenerate with `node scripts/ui-quality-inventory.mjs` from
`frontend`. These are source signals, not proofs that a route exposes a control,
has a specific permission or handles a state. Imported components and runtime
configuration must be followed during each focused review. Legacy
`redesign-route-audit.md` and `docs/page-quality/` retain historical context;
they do not substitute for current rendered evidence.

| Route family                                     | Required role/context                                            | State checklist for each relevant journey                                                                                                                                                                              | Current rendered coverage                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Public home, about, contact, reviews, privacy    | Anonymous, then signed-in navigation                             | Initial, meaningful content, empty/missing content, contact form validation/pending/success/error, navigation and enquiry recovery                                                                                     | Hosted initial home/about/contact sampled; reviews/privacy/form submission not reviewed this cycle             |
| Services, parts, vehicles and dynamic details    | Anonymous, customer/work browsing; current launch mode           | Loading, populated, empty catalogue, filtered no match, partial data, filter reset/URL/back navigation, unknown/unverified/incompatible/verified fitment, unavailable detail, enquiry validation/pending/error/success | Hosted list initial state sampled; actual result correctness and detail/state coverage not reviewed this cycle |
| Help index and `/help/[slug]`                    | Anonymous, customer, staff, admin, super admin                   | Search/no match/topic/reset, article/unknown slug, native disclosure, role-aware actions, pending identity, expired/failed/malformed identity, retry and stale session                                                 | Focus of cycle 1; exact test evidence below                                                                    |
| Authentication and invitation routes             | Anonymous; valid/invalid/expired token; MFA pending/verified     | Validation, pending, duplicate/expired submission, server/offline error, success, session expiry, safe redirect and recovery                                                                                           | Hosted login initial state only; no real sign-in or invitation accepted                                        |
| `/dashboard/**` customer workspace               | Synthetic customer first; actual customer acceptance separately  | Loading, populated/empty/partial, sorting/filtering/pagination, validation, pending/success/error, stale data, denied/expired session, upload recovery, keyboard dialogs                                               | Route source inventoried; no private dashboard data accessed in this cycle                                     |
| `/admin/**`, workforce and nested work details   | Each permitted capability, staff/admin/super admin, denied roles | Dense tables, column priorities, filters, drawers/dialogs, destructive confirmation, pending/success/error, conflicts/stale updates, denied/expired session, audit evidence                                            | Route source inventoried; real capability acceptance and operational actions not performed                     |
| `/payments/complete` and legacy financial routes | Existing transaction context only, providers disabled            | Unknown/cancelled/pending/failed/completed status, refresh/retry/idempotency, safe recovery, never imply successful settlement from browser return                                                                     | Source inventoried; no financial transaction or payment enabled                                                |

For each selected route test the relevant states above at narrow phone (320 and
390), tablet (768), compact desktop (1024), wide desktop (1440), short viewport,
keyboard, reduced motion and text enlargement. A non-applicable state needs a
reason; an inaccessible state stays untested rather than being counted as passed.
Permissions are server-enforced; a mocked role-aware link does not certify an
operational capability or backend authorization.

Shared surface inventory: SiteHeader desktop/mobile menu and account navigation;
SupportWidget Quick Help modal and persistent mobile support controls; HelpCentre
search, topics, disclosures and no-match recovery; HelpAccountAction identity
loading/error/retry; catalogue filters and fitment selection; saved-item toggles;
DashboardShell navigation; operational forms, tables, uploads, dialogs and feedback.
Their source locations are searchable in the inventory. Only the explicitly
recorded surfaces below were interacted with in this cycle.

## Cycle 1: Help guidance and account recovery

Priority is user harm and journey obstruction, then frequency and reuse.

| ID     | Priority and verified problem                                                                               | Before evidence                                                                                                      | Implemented acceptance condition                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-001 | P1: Parts Help told enquiry-only customers to review fulfilment and pay at checkout; Quick Help repeated it | Hosted `/help/shop-and-collection` and Quick Help at 390px, `help-before.json` and before screenshots                | Shared FAQ explains verified versus unknown fitment, enquiry, workshop collection, no online checkout and no stock reservation; payment/booking preparation and Help intro respect launch mode                                           |
| UI-002 | P2: Quick Help emitted raw customer dashboard links even anonymously or in a work session                   | Anonymous hosted MFA answer returned `/dashboard/security`; unconditional source bypassed the work-role resolver too | Use the existing role-aware action component: anonymous sign-in continuation, customer destination, work security destination or customer-only explanation; pending identity exposes no stale shortcut; failed/malformed check has retry |
| UI-003 | P2: Modal answer could remain after closing, even though identity may change before reuse                   | Source-confirmed persistent answer state; no claim of a reproduced security exposure                                 | Clear answer on close, preserve typed question, restore trigger focus; session-change event discards sensitive drafts/answer as before; external fallback states new-tab behaviour                                                       |

The first browser pass additionally reproduced a 4.37:1 answer-link contrast
failure against the notice background (UI-004, P2) and focus leaving the modal
at a keyboard boundary (UI-005, P2). The existing darker brand-red token restores
contrast; scoped answer actions retain 44px targets. Explicit forward/reverse Tab
wrapping complements native modal behaviour. These are measured fixes within the
Help journey, not a site-wide accessibility claim.

Reused the existing FAQ source, role resolver, dialog, Link/button styles and
article action logic. Article imports retain a compatibility export of the shared
component. No new dependency, typography, token, layout system, permission,
backend route, database schema, catalogue record or operational policy was added.
The approved Quicksand/Nippo typography, red/navy/white palette and logo remain.

### Evidence and verification

Browser plugin not available in this session; existing Playwright with installed
Microsoft Edge is the fallback. No browser or dependency download was required.
Hosted baseline: 8 anonymous routes (`/`, `/services`, `/parts`, `/vehicles`,
`/about`, `/contact`, `/help`, `/login`) at 1440 and 320, 16/16 HTTP 200 with
meaningful H1, no horizontal overflow, no unnamed visible fields or `href="#"`.
This is initial-state sampling, not full journey/accessibility acceptance.
Anonymous session requests generated expected 401 console entries on some
routes; these are not silently described as a clean console. No page exceptions
were collected. No customer records, real message or form submission was used.

Local verification status is recorded after the finite batch below. Browser
identities are synthetic intercepts of `GET /api/v1/auth/session`; they do not
connect tests to an application database. The local preview has no backend origin.
Evidence receipts and before/after images are outside the repository in
`%TEMP%/allied-ui-cycle-20261024`; browser output uses the repository Playwright
temporary output directory. Screenshot names from the focused suite start
`%TEMP%/help-launch-article-` and `help-launch-quick-`.

Completed cycle verification: full frontend lint, TypeScript and formatting passed;
147 unit files / **988 tests passed**. All 59 existing Help/article regression
scenarios passed across the initial run and explicit rechecks, plus the adjacent
anonymous-session draft-preservation scenario. The first full-mode run had 57
passes and two failures: one development chunk-load failure disappeared on a
fresh-server recheck; one outdated no-JavaScript search assertion expected only
one MFA article despite the published recovery article. The test now verifies
both named articles and the no-JavaScript journey passes. Recheck: 3/3 passed.
The initial enquiry suite passed 14/14. The final expanded enquiry suite passed
**15/15 against the optimized production build**, including reverse Tab,
unobscured focus and actual anonymous sign-in-link navigation. The build and
postbuild passed. Across the completed runs, 75 distinct browser scenarios passed
(59 Help/article + one adjacent header draft + 15 current-launch scenarios).
Five current-launch viewport cases had zero axe violations in the checked tags,
no page exceptions or unexpected console errors, meaningful page title/H1, no
framework error overlay and no horizontal overflow. Expected anonymous session
401 responses were explicitly allowed. Mobile/desktop production-build
screenshots were visually inspected, including the keyboard-focused answer link.
These local role/session responses are fixtures; publication identity follows below.

Production preflight: provider inspection at 19:53 UTC confirmed the unchanged
ACTIVE backend deployment `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`, no pending
backend deployment, database online and eight managed backups, latest
`2026-10-24T05:22:10Z`. The release review's same-day encrypted managed backup,
seven-day retention/PITR evidence and actual separate 86-table archive restore
rehearsal were reviewed. This frontend-only cycle ran **no database commands,
writes, migrations, new backup or restore rehearsal**. No Docker image, container
or volume was created or removed. Completion review retained the 13 existing
containers and all volumes, 10.3GB images and 4.398GB reusable build cache.
Dependencies were reused through a worktree junction, with no npm installation.
No space-recovery claim is made for this UI cycle.

### Published release and handoff

Implementation commit **`bd0ac141af2700429cb78ef1c109bbcde61b1465`** is pushed
on `feat/continuous-ui-quality-20261024`. GitHub's
[frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40127992888),
[database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40127992877)
and [redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40127992866)
all passed for that implementation. The CI production dependency audit step
also passed; dependencies were unchanged in this batch.

Vercel production **`dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved through
provider inspection to that exact deployment at **20:08:48 UTC, 24 October 2026**.
The candidate was built without domain assignment, then promoted only after the
release checks passed and both aliases were confirmed still on the expected old
release. Backend deployment remains `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`.
Frontend rollback is `dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr`; no backend rollback
or schema change is part of this frontend release.

Current frontend release worktree is
`C:/Users/PC/.codex/worktrees/allied-ui-quality-20261024`. The original directive,
register, source inventory/generator, byte-preservation attributes and concise
AGENTS guidance were also handed off to the main project folder without replacing
its independent edits. Only the new handoff was appended to the site tracker.
Post-publication acceptance here is provider READY/domain identity; rendered QA
was against the local optimized production build. No new authenticated live
customer/staff acceptance or live transaction is claimed. This finite cycle is
complete; the prioritized next-cycle list below remains explicitly open.

Accessibility target is WCAG 2.2 AA. Relevant checks include
[status announcements](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
and [modal keyboard/focus behaviour](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Automated axe checks and keyboard sampling do not prove full conformance.
Screen-reader speech, real mobile keyboards, hardware assistive technology,
every translated/long-data condition and every authenticated route remain untested.

## Prioritized next cycles and completion boundaries

| Order                   | Next bounded review                                                                                                        | Status / required evidence                                                                                                                                                                                  | Owner / stop condition                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1                       | Public fitment/search/detail to enquiry, including truthful unavailable/unknown states                                     | Source inventory exists; prior release fixtures are historical, not a current live full-path audit. Use approved isolated fixtures, not fake public stock. Preserve the independent pending Parts copy work | Next relevant frontend contributor; reproduce and repair one coherent verified journey, test narrow/wide/state recovery, update register |
| 2                       | Customer workspace navigation, saved garage/photos and support across expired/failed sessions                              | No private data accessed this cycle. Existing owner-confirmed gallery acceptance stays settled; do not reopen it without regression evidence                                                                | Next customer-workspace task; synthetic states then authorized real acceptance only where needed                                         |
| 3                       | Staff capability navigation and dense data: permitted/denied, empty, partial, filter, stale conflict, retry                | Inventory only. The Help work-role link resolver is reused, not certification of every staff support capability                                                                                             | Next workforce task; representative capabilities and keyboard/table review, no real operational changes for QA                           |
| 4                       | Wider marketing forms, screen reader/text enlargement, real mobile keyboard and performance measurements                   | Initial snapshots are insufficient for form submission, complete WCAG or Core Web Vitals claims. Measure before changing layout or bundles                                                                  | Next relevant frontend task; one demonstrated issue at a time, preserve visual hierarchy and business truth                              |
| Separate existing queue | Staff media and approved real catalogue publication, payment-provider/financial acceptance and operational owner decisions | Remain in site-completion tracker; not reopened or relabelled launch blockers by this directive                                                                                                             | Existing recorded owners and approvals                                                                                                   |

Each future cycle: confirm current live source and independent edits; inspect the
real journey and component dependencies; select verified high-impact failures;
define acceptance states; implement with existing conventions; check keyboard,
responsive layout, content and recovery; run proportionate regressions; record
evidence and remaining gaps; publish only under existing authorization. End the
cycle when the selected acceptance criteria and handoff are complete. Unreviewed
routes stay visible in the inventory instead of extending work indefinitely.

## Dashboard and managed workforce cycle - 24 October 2026

The owner explicitly moved the next review to **all dashboards and managed
workforce, page by page**. This supersedes the earlier next-cycle ordering for
this task. Source starts from released `00a53eb2`, Vercel
`dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`, verified READY before branching. Worktree:
`C:/Users/PC/.codex/worktrees/allied-dashboard-quality-20261024`, branch
`feat/dashboard-workforce-quality-20261024`. Existing main-checkout and other
worktree edits were preserved. No backend, database, role or launch-policy change
is part of this cycle.

All 83 customer/work route entries were inspected individually, following their
component imports. The table is a per-page evidence index, not an exhaustive
role/state cross-product or authenticated production acceptance. Existing
page-specific fixture suites were reused; effective layouts were retained rather
than repainted. The catch-all expands into the separate managed journeys below.
The source inventory and state checklist above continue to apply.

### Verified changes

- **DASH-001 / P1:** Failed background workforce-access checks retained prior
  work navigation/content. Reproduced for managed STAFF and ADMIN. Unverified
  access now withdraws work content/links, gives an explicit unavailable state
  and retries safely. Legacy staff capability links also withdraw when their
  permission refresh fails, with a visible retry. Server authorization is
  unchanged; this is fail-closed UI, not a claim of a server data exposure.
- **DASH-002 / P2:** Dashboard drawers let Tab leave the modal boundary.
  Reproduced on the released customer shell. Customer/admin/managed drawers now
  share the already tested Help focus-containment helper, preserve Escape and
  restore the opener. Initial session verification now has a named page and
  announced pending state; unavailable session checks have a clear heading.
- **DASH-003 / P2:** Multiple inspection cards emitted indistinguishable
  `Inspection progress` landmarks (axe `landmark-unique`). Compact workflow
  progress is now an accessible group within its record, preserving stage text
  and visual design. Representative shared consumers are included in the pass.
- **DASH-004 / P2:** Owner responsibility management depended on knowing a raw
  staff reference. The existing staff-directory route is now offered prominently;
  reference lookup remains available. Unauthorized entry has a named explanation
  and a return path. No user enrollment, assignment or permission is changed.
- **DASH-005 / P2:** Customer review detail hid its content on a background read
  failure but had no Retry button. Browser reproduction confirmed the missing
  recovery. Retry now handles both foreground and background failures. Standalone review titles now start at h2, with moderation at h3, while list cards retain their h3/h4 hierarchy and visual styles. A direct
  detail/state test verifies recovery without submitting feedback.

### Per-page review index

`R` means a passed rendered fixture sample from the completed run/rechecks, **not every
possible state**. `L` means the intentionally restricted launch boundary is
checked using HTTP redirects, plus the rendered enquiry destination; the hidden
financial page is not accepted or enabled. `F` is the non-indexed missing-page fallback (Next.js may return 200 once streaming has begun). Each test
basename below is under `frontend/tests/e2e/` with `.spec.ts`. Final outcome and
selected cases are recorded below after verification.

| Route                                             | Evidence suite                   | Review scope                                                      |
| ------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `/admin/[resource]`                               | `dashboard-page-recovery`        | F: Non-indexed missing page; named resources have dedicated pages |
| `/admin/audit`                                    | `work-audit`                     | R: Rendered fixture sample                                        |
| `/admin/booking-capacity`                         | `booking-capacity`               | R: Rendered fixture sample                                        |
| `/admin/booking-slots`                            | `work-slots`                     | R: Rendered fixture sample                                        |
| `/admin/bookings/[bookingId]`                     | `work-booking-detail-quality`    | R: Rendered fixture sample                                        |
| `/admin/bookings`                                 | `work-bookings-quality`          | R: Rendered fixture sample                                        |
| `/admin/branches`                                 | `work-branches`                  | R: Rendered fixture sample                                        |
| `/admin/categories/[categoryId]`                  | `work-product-category-detail`   | R: Rendered fixture sample                                        |
| `/admin/categories`                               | `work-product-categories`        | R: Rendered fixture sample                                        |
| `/admin/complaint-policy`                         | `work-complaint-policy`          | R: Rendered fixture sample                                        |
| `/admin/customers/[customerId]`                   | `work-customer-detail`           | R: Rendered fixture sample                                        |
| `/admin/customers`                                | `work-customers`                 | R: Rendered fixture sample                                        |
| `/admin/delivery-policy`                          | `delivery-policy`                | R: Rendered fixture sample                                        |
| `/admin/dispute-policy`                           | `work-dispute-policy`            | R: Rendered fixture sample                                        |
| `/admin/finance-policy`                           | `work-finance-policy`            | R: Rendered fixture sample                                        |
| `/admin/fitment`                                  | `parts-fitment-workspace`        | R: Rendered fixture sample                                        |
| `/admin/inspections`                              | `work-inspections`               | R: Rendered fixture sample                                        |
| `/admin/inventory/[inventoryId]`                  | `work-inventory-detail`          | R: Rendered fixture sample                                        |
| `/admin/inventory`                                | `work-inventory`                 | R: Rendered fixture sample                                        |
| `/admin/invoices/[invoiceId]`                     | `work-invoice-detail`            | R: Rendered fixture sample                                        |
| `/admin/invoices`                                 | `work-invoices`                  | R: Rendered fixture sample                                        |
| `/admin/notifications`                            | `work-notifications`             | R: Rendered fixture sample                                        |
| `/admin/orders/[orderId]/aftercare`               | `work-aftercare`                 | R: Rendered fixture sample                                        |
| `/admin/orders/[orderId]`                         | `work-order-detail`              | R: Rendered fixture sample                                        |
| `/admin/orders`                                   | `work-orders`                    | R: Rendered fixture sample                                        |
| `/admin`                                          | `work-overview-quality`          | R: Rendered fixture sample                                        |
| `/admin/payment-disputes`                         | `work-payment-disputes`          | R: Rendered fixture sample                                        |
| `/admin/payment-disputes/work`                    | `work-dispute-handling`          | R: Rendered fixture sample                                        |
| `/admin/payment-exceptions`                       | `work-payment-exceptions`        | R: Rendered fixture sample                                        |
| `/admin/payments`                                 | `work-payments`                  | R: Rendered fixture sample                                        |
| `/admin/privacy`                                  | `work-privacy`                   | R: Rendered fixture sample                                        |
| `/admin/processing-jobs`                          | `work-processing-jobs`           | R: Rendered fixture sample                                        |
| `/admin/products/[productId]`                     | `work-product-detail`            | R: Rendered fixture sample                                        |
| `/admin/products`                                 | `work-products`                  | R: Rendered fixture sample                                        |
| `/admin/promotions/[promotionId]`                 | `promotion-detail`               | R: Rendered fixture sample                                        |
| `/admin/promotions/new`                           | `promotion-create`               | R: Rendered fixture sample                                        |
| `/admin/promotions`                               | `work-promotions`                | R: Rendered fixture sample                                        |
| `/admin/refund-timing`                            | `refund-timing`                  | R: Rendered fixture sample                                        |
| `/admin/refunds`                                  | `work-refunds`                   | R: Rendered fixture sample                                        |
| `/admin/reservation-terms`                        | `work-reservation-policy`        | R: Rendered fixture sample                                        |
| `/admin/retention-policy`                         | `work-retention-policy`          | R: Rendered fixture sample                                        |
| `/admin/reviews`                                  | `work-review-moderation`         | R: Rendered fixture sample                                        |
| `/admin/security`                                 | `admin-security-quality`         | R: Rendered fixture sample                                        |
| `/admin/service-categories/[categoryId]`          | `work-category-detail`           | R: Rendered fixture sample                                        |
| `/admin/service-categories`                       | `work-categories`                | R: Rendered fixture sample                                        |
| `/admin/services/[serviceId]`                     | `work-service-detail`            | R: Rendered fixture sample                                        |
| `/admin/services`                                 | `work-services`                  | R: Rendered fixture sample                                        |
| `/admin/staff/[staffUserId]`                      | `work-staff-detail`              | R: Rendered fixture sample                                        |
| `/admin/staff/invite`                             | `work-staff-invitations`         | R: Rendered fixture sample                                        |
| `/admin/staff`                                    | `work-staff-directory`           | R: Rendered fixture sample                                        |
| `/admin/support/[kind]/[supportId]`               | `work-support-detail`            | R: Rendered fixture sample                                        |
| `/admin/support`                                  | `work-support`                   | R: Rendered fixture sample                                        |
| `/admin/vehicle-sales/[transactionId]`            | `work-vehicle-sale-detail`       | R: Rendered fixture sample                                        |
| `/admin/vehicle-sales`                            | `work-vehicle-sales`             | R: Rendered fixture sample                                        |
| `/admin/vehicles/[vehicleId]`                     | `work-vehicle-detail`            | R: Rendered fixture sample                                        |
| `/admin/vehicles/new`                             | `work-vehicle-create`            | R: Rendered fixture sample                                        |
| `/admin/vehicles`                                 | `work-vehicle-stock`             | R: Rendered fixture sample                                        |
| `/admin/workforce/[[...section]]`                 | `dashboard-access-quality`       | R: Owner entry and denied state; managed subpages below           |
| `/dashboard/bookings/[bookingId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/bookings`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/cart`                                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/inspections`                          | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/invoices/[invoiceId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/invoices`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/notifications`                        | `customer-notifications-quality` | R: Rendered fixture sample                                        |
| `/dashboard/orders/[orderId]/aftercare`           | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/orders/[orderId]`                     | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/orders`                               | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard`                                      | `customer-overview-quality`      | R: Rendered fixture sample                                        |
| `/dashboard/payments/[paymentId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/payments`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/privacy`                              | `customer-privacy-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/profile`                              | `customer-profile-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/reviews/[reviewId]`                   | `dashboard-page-recovery`        | R: Rendered fixture sample                                        |
| `/dashboard/reviews`                              | `customer-reviews-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/saved`                                | `saved-items-quality`            | R: Rendered fixture sample                                        |
| `/dashboard/security`                             | `customer-security-quality`      | R: Rendered fixture sample                                        |
| `/dashboard/support/[kind]/[supportId]`           | `customer-care-detail-quality`   | R: Rendered fixture sample                                        |
| `/dashboard/support`                              | `customer-care-quality`          | R: Rendered fixture sample                                        |
| `/dashboard/vehicle-transactions/[transactionId]` | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/vehicle-transactions`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/vehicles/[vehicleId]`                 | `garage-photos-quality`          | R: Rendered fixture sample                                        |
| `/dashboard/vehicles`                             | `customer-garage-quality`        | R: Rendered fixture sample                                        |

### Managed workforce journeys within the catch-all

| Journey                                                     | Evidence suite                                      | Review scope                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/admin` and `/admin/workforce`                             | `workforce-overview`                                | All eight responsibility templates, counters, no grants, expiry, revoked/error access and alias |
| `/admin/workforce/jobs`                                     | `workforce-jobs`, `workforce-access`                | Queue, narrow/wide layout, permitted destinations                                               |
| `/admin/workforce/jobs/[id]`                                | `workforce-job-detail`                              | Assigned job detail and technical-update controls in fixtures                                   |
| `/admin/workforce/bookings`                                 | `workforce-bookings`                                | Readable scoped records and real detail destinations                                            |
| `/admin/workforce/bookings/[id]`                            | `dashboard-page-recovery`                           | Direct scoped detail, refresh failure and retry; no legacy booking fetch                        |
| `/admin/workforce/enquiries`                                | `workforce-enquiries`                               | Scoped queue, layout and accessibility samples                                                  |
| `/admin/workforce/complaints`                               | `workforce-complaints`                              | Scoped queue, layout and accessibility samples                                                  |
| `/admin/workforce/orders`                                   | `workforce-orders`                                  | Order-progress workspace samples; no real fulfillment commitment                                |
| `/admin/workforce/finance`                                  | `workforce-finance`                                 | Payment-record reading samples; no live financial action                                        |
| `/admin/workforce/access`, staff responsibility forms       | `dashboard-access-quality`, `work-staff-workforce`  | Owner/denied entry and existing enrollment/assignment review fixtures                           |
| `/admin/security`, `/admin/notifications` for managed staff | `admin-security-quality`, `workforce-notifications` | Personal tools and responsibility-aware notification samples                                    |

### Verification record and continuation

Final page-pass command from `frontend`:
`npx --no-install playwright test --test-list tests/quality/dashboard-pages.txt --workers=2`.
The committed selection is reproducible; it includes direct recovery cases and
Help regressions for the shared dialog helper. Test records are synthetic browser
intercepts against localhost, with no configured backend origin. Live customer
records, staff accounts, assignments and financial/operational actions were not
used. Browser plugin not available; installed Edge/Playwright was reused.

Baseline overviews: 75/75 passed before changes. The broad initial sample had
100 passes, one isolated-real-API test skipped and five failures: two test trace
folder collisions (QA runners accidentally shared an output folder), the actual
inspection landmark defect, and two outdated assertions expecting zero managed
booking links. Runner output folders were separated; assertions now verify the
25 permitted detail URLs instead of treating the shipped feature as a defect.
The separately attempted customer financial cases correctly redirected under the
limited launch; that attempt was stopped and replaced with explicit launch-boundary
checks. A slow repeated full Contact navigation test was replaced by per-route
HTTP checks plus one rendered destination. No launch restriction was removed.
The isolated real-directory integration test remains unrun; the browser customer
directory fixture suite supplies the page sample, not real API acceptance.

Completed verification: full frontend lint and the affected-file lint recheck,
production build/TypeScript, formatting and **988 unit tests in 147 files** passed.
The committed page matrix exercised **167 distinct scenarios across 82 suites**.
The first production-build matrix returned 164 passes and three failures: the
standalone review's heading-order defect, an assertion assuming every Next.js
not-found response must be HTTP 404, and a test parsing a relative Location header
without a base URL. The heading hierarchy was fixed; the two tests now verify the
actual documented framework/redirect contracts. A fresh final build and targeted
**6/6 rechecks passed**, including list/detail review accessibility, background
recovery, scoped booking detail, every restricted customer path and the
non-indexed missing page. All 167 selected scenarios are covered by the completed
run and rechecks; this is not described as one clean uninterrupted run. No skips
or flaky retries occurred in that selected matrix. The earlier isolated real-API
skip remains explicitly outside this acceptance.

The new responsibility entry was checked at 320/390/768/1024/1440; 390 and 1440
screenshots and axe checks passed. Managed-access error/retry was rendered at
390/1440, and customer/admin/managed drawer focus containment and Escape were
verified. The shared Help helper's 15 production-build scenarios passed. The
existing page suites provide further responsive, disclosure, table, form review
and state checks; exact selected titles are in the committed test list. A final focused console probe at 390/1440 verified the responsibility page URL,
Administration title, meaningful H1, directory action and mobile Escape: no page
exceptions or unexpected console errors; one deliberately unavailable optional
notification fixture (503) per viewport was explained. These are synthetic local
browser checks, not real staff capability certification or full WCAG conformance. Artifacts: `%TEMP%/allied-dashboard-quality-20261024`;
images `%TEMP%/workforce-entry-390.png`, `workforce-entry-1440.png`,
`dashboard-access-STAFF-error.png` and `dashboard-access-ADMIN-error.png` were
visually inspected. Existing layouts/brand, field values and policy were retained.

Implementation **`7e522931f53f271ce8a47b6e925f41c5cad48747`** is pushed.
[Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40131516363),
[database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40131516437)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40131516367)
all passed for that implementation, including the CI production dependency audit.
Follow-up test-receipt clarifications do not change deployed runtime code.

Vercel **`dpl_42w1rg4PojUn7a81eD4KrrRVnaW2`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved to that
exact deployment at **20:57:29 UTC (21:57:29 Lagos), 24 October 2026**. The
candidate was built without domain assignment, then promoted after final checks;
both domains were first verified still on the expected preceding release.
Rollback frontend: `dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`. Backend remains ACTIVE
`5c1ea9a7-6211-46d2-995f-c45e504bf9e9`. Current release source/worktree is
`allied-dashboard-quality-20261024`, not the older main checkout. Post-publication
verification here is provider READY and alias identity; rendered acceptance used
the local optimized build. No real authenticated live customer/staff acceptance
or operational/financial action was performed.

Provider preflight at 20:52 UTC confirmed the backend ACTIVE with no pending
release, database online and eight managed backups, latest 24 October 05:22:10
UTC. Same-day managed encryption/retention/PITR and the prior separate 86-table
restore receipt were reviewed. No local or production database command, schema
change, migration, new backup or restore was run in this frontend cycle. GitHub's
database-safety job uses its isolated CI environment. No Docker image, container,
volume or builder was created/removed; completion inspection retained the 13
existing containers, all 14 volumes, 10.3GB images and 4.398GB reusable builder
cache. Frontend dependencies were reused through a junction; no new installation.
No disk-recovery claim is made. Task-owned preview servers were stopped afterward.

Continue future cycles from this page index: revisit concrete failures first,
then expand state/role coverage on the next relevant page. Real screen-reader,
real-device keyboard and real authenticated operational acceptance remain open.
Unexercised combinations are not counted as complete. The deferred transaction
pages retain their launch gates. Preserve the separately settled Item 6 queue.

## Cycle 3: Shop, Vehicles, My Vehicles and Customer Care

Completed batch: runtime implementation `1aacb6af5ffbe72c23e1f0f7d35b78fadf5f4447`,
branch/worktree `feat/catalogue-care-ux-20261024` /
`C:/Users/PC/.codex/worktrees/allied-catalogue-care-ux-20261024`.
The starting live dashboard release was checked through both provider aliases.
The separately published `5e7deb6a` copy clarification and its deployment receipt
were preserved before preparing this batch. Production advanced to
`dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` during development; this batch includes
that runtime source. Main-checkout application code and unrelated worktrees
were not edited. The original directive is unchanged.

The flow under review is catalogue search and filtering -> selected item or
vehicle context -> saved vehicle / care request -> permitted customer or staff
conversation and recovery. Browser plugin not available: existing Playwright
and installed Edge are used, with synthetic accounts and intercepted API calls.
No live customer records, messages, financial actions or database writes are
needed for this frontend review.

| Surface and role                                                        | Observed issue and implementation                                                                                                                                                                                                    | Acceptance for this batch                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/parts`, public/customer browsing                                      | Phone search followed a large vehicle form. Put search, category and sort first; retain the visible fitment workflow and unknown-compatibility truth. Add currency guidance and reuse visible-control modal focus handling.          | Search, category hierarchy, individual resets, fitment, price validation, history and phone/desktop drawers remain usable.                                           |
| `/vehicles`, public/customer browsing                                   | Search and advanced Apply behaviour needed clearer explanation; price inputs needed guidance. Reuse modal keyboard containment.                                                                                                      | Search/sort/body shortcuts, condition/origin/powertrain/range filters, error recovery and URL history retain their contracts.                                        |
| `/dashboard/vehicles`, customer                                         | Optional preferences preceded required identity; generic actions and removal looked alike. Put required make/model/year first, associate field guidance, distinguish navigation/removal, shorten guidance and stretch phone actions. | Add/edit/cancel/remove, focus return, duplicate/unknown outcome guards, pagination and saved fitment are preserved.                                                  |
| `/dashboard/vehicles/[vehicleId]`, customer                             | Adjacent gallery and saved-vehicle path must retain working behaviour.                                                                                                                                                               | Fixture gallery/upload/recovery, ownership and narrow layout checks; real storage acceptance is separate.                                                            |
| `/dashboard/support`, customer                                          | Existing records competed with a long form; privacy guidance occupied half the form grid. Add task anchors, category-specific explanations, associated subject/message help, blue navigation and a full-width privacy note.          | Task jumps retain a draft; review/send/cancel and uncertain-outcome recovery remain authoritative.                                                                   |
| `/dashboard/support/[kind]/[supportId]`, customer                       | Preserve conversation continuity and reply safeguards.                                                                                                                                                                               | Empty/loading/error/stale/closed, exact reply, draft/recovery, keyboard confirmation and responsive checks.                                                          |
| `/admin/customers`, admin/super admin                                   | Phone filters consumed a screen; full reference IDs distracted from identity. Improve responsive filter rows, prefix instructions/input modes, removable applied constraints and expandable references.                              | Remove one constraint without losing others; search applies explicitly; reference disclosure works by keyboard; staff remain denied.                                 |
| `/admin/customers/[customerId]`, admin/super admin                      | Adjacent activity and link styles must remain coherent.                                                                                                                                                                              | Role gate, activity collections, paging/history, errors and responsive records retain their behaviour.                                                               |
| `/admin/support` and nested details, staff/admin/super admin            | Dense reference metadata competed with contact/message details. Move reference facts into a native disclosure, strengthen navigation affordances and add removable applied filters.                                                  | Staff branch scope remains enforced; removing branch also clears dependent assignee; records, review/reply and recovery remain functional.                           |
| `/admin/workforce/enquiries` and `/complaints`, permitted managed roles | Selected conversation and navigation needed stronger, consistent affordances.                                                                                                                                                        | Selected buttons have text/pressed state plus visible colour/border treatment; scoped search, queue/detail, assignment/reply and conflict handling remain unchanged. |

Priority P1: the expanded managed-care run exposed a shared access-refresh
regression. A manual refresh marks the access resource loading; the previous
render branch unmounted the workspace and discarded drafts and success feedback.
Keep the same workspace mounted, hidden and inert while verification is pending.
Successful verification preserves the draft; failed verification still removes
work content, and a different actor/access version/assignment key discards it.
A held-response regression verifies all three states without issuing writes.
Priority P2: the catalogue, guidance, field ordering, link/action affordances,
record density and responsive filter improvements in the table above.

Reproducible selected matrix: `tests/quality/catalogue-care-pages.txt`, **385
distinct scenarios across 22 suites**, including adjacent managed overview,
bookings, jobs/detail, orders and finance samples after the shared-shell fix.
The initial optimized-build run was **349 passed / 10 failed** across 359 cases:
five managed-refresh failures shared the lifecycle defect above; four upload
cases used a test storage host excluded by the local preview allowlist; one
Shop assertion expected cart wording superseded by the preserved enquiry-mode
copy release. No storage or authorization guard was weakened. The local-only
preview was configured for the intercepted `media.example.test` host, and the
Shop assertion now checks the stock-reservation warning common to both modes.

All **11 critical rechecks passed**. A fresh optimized browse-enquiries build then
passed **179/179 final browser checks**, with zero skips/flaky cases, including
all ten originally failed cases, all 13 new interaction checks, role/access
recovery, real launch redirects, gallery uploads/retry/cancel, scope changes,
managed assignment/replies and adjacent pages. The stored coverage receipt
compares the actual passed-case union against the 385-case matrix: **385 covered,
zero missing**. This is combined evidence from the initial run and final
rechecks, not a claim of one clean 385-test invocation.

Page identity, meaningful content, no framework overlay, page-error checks,
screenshots, responsive/reflow, keyboard interactions and automated axe checks
passed in the selected fixtures. Representative widths were 320, 360, 375, 390,
430, 768, 1024, 1280, 1440 and 1536; work-record tests also sampled 1920.
Short viewports and reduced-motion states were exercised by the existing suites.
Before/after screenshots were viewed for hierarchy, control layout, guidance,
action colours and reference disclosure. Final phone actions use the full row;
wide customer filters share one row; required vehicle identity precedes optional
preferences; privacy guidance spans the care form. Approved assets, brand fonts,
pricing, compatibility truth, permissions and collection-only launch policy remain.

Local full lint/types, **147 files / 988 unit tests**, optimized browse-mode build
and whole-frontend formatting passed. Final changed-source lint and the final
optimized build/type compilation passed after the shared-shell fix. The initial
combined check was stopped after passing the launch-specific build mode into
multi-mode configuration unit tests; standard unit environment and browse-mode
build environment were separated, with no guard change. Vite's existing
config-loader warning remains informational.

Runtime implementation is pushed. [Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40137427563)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40137427542)
passed for `1aacb6af`, including the CI production dependency audit. The unchanged
backend passed [isolated database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40136214469)
at preceding UI commit `c3f4076f`; the frontend-only follow-up did not trigger a new
backend job. No local/shared/production database checks or writes were run.

Vercel **`dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved to that
exact deployment at **22:17:35 UTC (23:17:35 Lagos), 24 October 2026**. Each was
freshly checked on the expected copy release before promotion. The earlier
`c3f4076f` candidate was never promoted; the final candidate includes the refresh
fix. Immediate frontend rollback is `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ`;
preceding dashboard release `dpl_42w1rg4PojUn7a81eD4KrrRVnaW2` remains available.
Backend stays ACTIVE `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`, no pending release.
Published acceptance here is provider READY/alias identity. Rendered acceptance
used the local optimized build, not real authenticated production operations.

Immediately before promotion, read-only provider preflight confirmed the database
online, eight managed backups and latest `2026-10-24T05:22:10Z`. Existing managed
encryption/seven-day retention/PITR and the same-day separate 86-table logical
restore receipt were reviewed. No new dump, restore, migration or DB command was
run in this UI cycle. Payments remain disabled. Dependencies were reused through
a junction; no package installation or Docker build/removal was needed. Existing
32 images (10.3GB), 13 stopped containers, 14 volumes and 4.398GB warm cache were
retained. Docker reclamation by this cycle was 0 bytes; host C: free space was
13,973,557,248 bytes at 22:21:15 UTC. No disk-recovery claim is made.
Task-owned preview port 3155 was verified closed.

Artifacts remain outside source: `%TEMP%/allied-catalogue-care-*.log/json`,
`scope-before-*`, `scope-review-*`, `scope-final-*`, public catalogue captures,
and `scope-final-vehicle-form-390.png`. Coverage is fixture-based; no full WCAG
certification, real screen-reader/mobile-keyboard certification, real object
storage acceptance or real authenticated production transaction is claimed.
Unexercised combinations remain open. The original directive SHA-256 still
matches its recorded bytes. Preserve the settled Item 6 queue and owner decisions.
Future separate reviews can pair price-range fields more closely in the Shop
advanced grid and follow the header-session fixture/customer-toast items recorded
by the preceding copy audit; those do not reopen the settled launch scope.

## Cycle 4: Home, Parts, Vehicles and parts-enquiry handoff - 25 October 2026

Initial implementation checkpoint (superseded by the verified release below) on
`feat/home-discovery-ux-20261025`, worktree
`C:/Users/PC/.codex/worktrees/allied-home-discovery-20261025`, based on the latest
recorded release `93e2501b`. Both production aliases were independently inspected
and still resolved to READY `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB` before choosing
source. Existing main-checkout and other-worktree edits remain separate.
The complete supplied [implementation brief](Allied_AutoTech_Home_Parts_Vehicles_Codex_Prompt.md)
was read before editing; the standing quality directive is preserved.

Flow: Home -> direct part search or vehicle discovery -> accurate results and
compatibility context -> editable Product enquiry. Vehicles -> budget, make/model,
condition and year -> retained advanced specifications and listing details.
Browser plugin not available; installed Playwright/Edge supplies rendered evidence.

Revalidated hosted evidence: anonymous unfiltered product and vehicle discovery
returned HTTP 200 with zero public matches; filtered brake/Foreign Used queries
also returned zero. Fitment makes returned HTTP 200 with no active choices both
without a search and with Toyota. Public APIs prove absence of currently visible
records, not absence of all private or unpublished inventory. Products require
active categories/parents; vehicle listings require AVAILABLE status and an active
branch; fitment makes/models must be active. These public requests did not expose
private stock. No client mapping or failed-request cause was found for these zeros.
A single published Tyre Change service has a fuller description than its short
preview. There is one public branch and no published reviews. Baseline captures
and safe request receipts: `%TEMP%/allied-home-discovery-20261025`.

| Brief acceptance / batch                        | Implementation and status                                                                                                                                                                                                                         | Verification / dependency                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue states                                | Implemented: separately read unfiltered publication evidence for filtered zero results; retain error/retry and inputs; collapse irrelevant controls for known empty catalogues; omit empty/single-page pagination.                                | Rendered checks in progress; independent public reads are not a cross-request database snapshot. Unknown availability never becomes an authoritative global-empty claim.                                                                                                                                              |
| Parts intent and finder                         | Implemented: persistent direct search, two discovery choices, compact optional saved-vehicle path, honest no-makes fallback, selection prerequisites, reset explanation and grouped technical details.                                            | No category-specific fitment requirement metadata exists; grouping retains all fields without inventing category rules. Existing compatibility engine remains authoritative.                                                                                                                                          |
| Vehicles                                        | Implemented: budget, make/model, condition and year range first; advanced driving/assembly groups; remove exact-name jargon, duplicate year input and merchandising/equipment choices without dropping existing deep-link semantics.              | Naira/kobo, ranges, Apply/cancel/clear/chips/history and keyboard checks in progress. Searchable equipment taxonomy remains a modelling/content dependency.                                                                                                                                                           |
| Home                                            | Implemented: distinct navigation routes, authentic supplied campaign/equipment imagery, fuller service preview, concise process, conditional inventory/reviews, distinct carousel tasks and initially paused marquee.                             | No operational service data changed. Static-hero alternative deferred because the established carousel capability is retained. Owner should approve fuller tyre/service scope and supply additional authentic workshop photographs.                                                                                   |
| Parts -> Contact                                | Implemented: Product default, conditional context, stable context identity and editable text; sole complete branch is selected without a needless choice; multi-branch selection remains.                                                         | Proven API dependency repaired compatibly: public PRODUCT may omit productId for unlisted parts. Supplied IDs are still checked; customer-linked enquiries and other source requirements remain strict. API must be released before the matching frontend; the forward constraint migration must precede API rollout. |
| Populated fixtures and later owner seed request | Implemented: 20 varied products/parts, 12 vehicles, 5 categories, 3 makes, 6 models and 4 services. `/demo` shares actual card renderers, shows explicit fictional labels, illustrative prices/images, sample details and no operational actions. | No production database seeding, fake genuine availability, public fictional testimonials, staff/customer enrollment or financial records. The optional local-only fixture API is read-only, requires `--demo` and refuses hosted/production execution.                                                                |
| Accessibility / responsive / regressions        | In progress: 320/390/768/1024/1440, populated/empty/failure states, keyboard focus, disclosures, chips, URL/history, pause/reduced motion and scoped axe.                                                                                         | Final results below; automated/emulated checks do not certify real devices, screen-reader speech or full WCAG conformance.                                                                                                                                                                                            |
| Publication                                     | Not performed in this implementation checkpoint.                                                                                                                                                                                                  | Preserve launch restrictions, Item 6 and existing release/backup safeguards. Demo records are intentionally separate from genuine catalogue APIs and database records.                                                                                                                                                |

This cycle does not reopen the settled launch decisions. Real publishable inventory,
approved prices/availability, authentic catalogue photos and customer reviews remain
owner inputs. Do not populate application/shared/production databases to make a
layout test pass or delete existing records as a cleanup shortcut.

### Checkpoint evidence and remaining acceptance

Source implementation is complete across the requested surfaces, but **final browser
acceptance is incomplete**. No commit, push, deployment or application database seed
was performed. `/demo` is a built customer-facing route in this worktree, not a URL
currently available to production visitors. It is deliberately distinct from genuine
inventory and dashboard records. The later request to make populated areas visible
is implemented as an explicitly fictional read-only preview; it does not certify
real prices, stock, services, condition reports or compatibility.

Passed checks:

- Full frontend lint, typecheck and formatting; full unit run **147 files / 988
  tests**. Four additional isolated fixture-contract tests passed separately after
  final review, using the real product, vehicle, category and service parsers.
- Final optimized `browse_enquiries` build, TypeScript compilation and standalone
  preparation passed after the visible Home illustration labels and final demo
  image-label correction. No server startup success is implied by this build.
- Backend typecheck, scripts typecheck, lint, formatting and **10 focused unit
  tests** for public parts enquiries and the existing security boundaries passed.
  OpenAPI export/type regeneration and validation passed for **347 paths** using
  synthetic local test configuration, without connecting to a database.
- Latest selected development-browser run: **16 passed / 1 failed** across 17
  cases. Populated Parts/Vehicle cards and read-only demo layouts passed at 320,
  390, 768, 1024 and 1440; scoped axe/reflow, dependent finder choices, stale
  suggestions, grouped detail retention, generic/selected Product editable
  prefill, context transfer and synthetic submission checks passed in that run.
  The failed case expected six brake examples where the fixture contains five.
  The assertion is corrected; its rerun is still required. Earlier broad runs
  included cold-dev compilation and obsolete copy/fixture assertions and are
  not counted as final passes.

Rendered evidence used `http://127.0.0.1:3165`, local synthetic APIs and installed
Edge/Playwright because Browser plugin was not available. Page identity, meaningful
content, no framework error overlay, scoped page-error checks, screenshots and
interaction assertions passed for the selected populated cases. This is fixture
evidence from the development build, not production acceptance. Screenshots include
`%TEMP%/allied-autotech-playwright/6f4ab084236c/discovery-remediation-*` and the hosted
baseline directory above. The long full-page captures retain the sticky header at
the interaction scroll position; they do not establish first-viewport positioning.
The screenshot helper now scrolls to the top and blurs focus before capture, but
those improved captures have not yet been generated.

The final optimized preview startup was repeatedly rejected by automatic approval
review with **“blocked by policy”**, including after the user's explicit “Do the
preview yourself. I approve.” No more specific reason was supplied. No launch
workaround was used. Ports 3165 and 5021 were checked closed. This tool restriction
blocks the final Home carousel/FAQ, empty/error/populated Home, broad catalogue,
Contact and saved-vehicle regression run; source/build checks do not replace it.
The final Home labels, final demo label, standalone fixture response-envelope fix,
and screenshot-helper change are not browser-reverified. The standalone fixture
now includes the required `meta.requestId`; strict API response validation remains.

Resume in this worktree when local preview execution is available. The intended
preview is loopback-only, backend origin `http://127.0.0.1:5021`, port 3165, launch
mode `browse_enquiries`; the existing optimized build is retained. For manual
populated review use the explicit read-only `scripts/discovery-fixture-server.mjs
--demo`. For the regression run **do not** start that separate fixture: the suites
own port 5021 sequentially. Use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3165`,
`RUN_HOME_TESTS=true`, and:

```powershell
.\node_modules\.bin\playwright.cmd test tests/e2e/shop-quality.spec.ts tests/e2e/vehicles-quality.spec.ts tests/e2e/home-quality.spec.ts tests/e2e/contact-quality.spec.ts tests/e2e/saved-vehicle-fitment.spec.ts tests/e2e/discovery-remediation.spec.ts tests/e2e/parts-fitment.spec.ts --workers=1 --reporter=line --max-failures=6
```

Test discovery succeeds: **127 cases in seven files**, not 127 executed passes.
Fix and rerun any proven defect, inspect Home and first-viewport phone/desktop
captures, and update this checkpoint before release review. Real-device mobile
keyboards, screen-reader speech, private stock/publication management, real dashboard
operations, actual DB persistence and full WCAG conformance remain unverified.
Category-specific technical fitment disclosure needs authoritative metadata; all
current technical fields remain grouped and optional without invented rules.

The compatible public Product API change must precede the frontend release.
Release review below supersedes the initial API-only migration assumption.
At this initial checkpoint no database check, migration, backup,
restore or operational submission ran in this cycle; isolated mocked unit tests
do not constitute persistence or backup-recovery acceptance. Existing rollout
safeguards, launch restrictions and Item 6 remain mandatory.

Docker completion review: **32 images / 10.3GB, 13 stopped containers, 14 volumes /
1.012GB, 50 build-cache records / 4.398GB** were retained. No Docker resource was
created, removed or reclaimed by this cycle. Useful shared dependencies are reused
through verified junctions; no package installation or image archive was created.
Host C: free space measured **12,651,687,936 bytes** during final checks, versus
13,392,957,440 at this cycle's start; necessary Next build/test artifacts account
for task activity, and no physical disk-reclamation claim is made. The useful
optimized build remains for the blocked review; database volumes and other tasks'
resources were untouched. The mandatory hygiene rule is preserved in root AGENTS
and the linked guide; Markdown is a review requirement, not automatic garbage
collection.

### Production release review - 25 October 2026

The user explicitly authorized production deployment. Implementation `b9162cc4`
was committed and pushed; frontend release CI, isolated backend database-safety CI
and the secret guard passed. Vercel candidate
`dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv` built READY with domain promotion withheld.
Hosted Edge verification replaced the blocked local-preview check: 13 real-data
scenarios at 320/390/768/1024/1440 and eight additional browser-only fixture
scenarios at 390/1440 passed, with zero page exceptions. These covered Home
carousel/FAQ, populated/empty/refresh-failure recovery, Parts state distinctions,
vehicle budget/condition URL and chip semantics, draft cancellation, grouped
finder details and unknown fitment, editable generic Product enquiries and the
read-only populated demo. Scoped axe/reflow and representative screenshots passed.
The first scratch Home run used an ambiguous FAQ selector shared with the Help
dialog; scoping it to main resolved that test issue. Temporary Vercel review
access was revoked after each run and existing protection was verified preserved.
This is selected hosted acceptance, not a claim that all 127 local cases ran.

Deeper release review caught a missed database dependency before any production
change: `aat_enquiry_target_valid` still required productId for every Product
enquiry. The earlier "no migration needed" assessment was incorrect; mocked
service tests did not prove persistence. The obsolete API build was stopped.
Forward migration `20261025050000_public_unlisted_parts_enquiries` expands only
anonymous Product enquiries to permit an unlisted part, retaining product/source
requirements for customer-linked and all other enquiry types. It updates no
records, removes no columns and atomically replaces the check under a bounded
lock timeout. Prisma's field model is unchanged because this is a SQL check
constraint. A new real-PostgreSQL integration regression is included in CI.
No earlier migration was edited. Empty replay, persistence tests, fresh backup,
separate restoration/rehearsal, guarded target migration and image verification
must pass before this release is promoted. Final receipts follow after rollout.

The new isolated target passed all 65 migrations, `db:check` and **13/13** actual
persistence/security tests (three integration plus ten focused unit cases).
The first integration attempt omitted the existing Origin header and required
synthetic phone field; those fixture omissions were corrected without weakening
either guard. The successful recheck used the same task-created isolated database,
preserved the first failed receipt and reset or deleted no records.

### Verified production release - 25 October 2026

**Released.** Frontend runtime source is `b9162cc43bd6fa56ca88d3a07d280ffad4b3dff8`;
backend, constraint migration and cross-platform checksum pin are
`2fc02bafdde75385fffad9c46767615a506f5eb2`. Later backend/docs/type-description
changes do not change the candidate's frontend runtime. Both main and www aliases
were independently verified on READY **`dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`** at
**07:07:45 UTC / 08:07:45 Lagos**. API deployment
**`da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`** is ACTIVE with **16/16** successful
provider steps; all four actual deployment image digests match the verified
manifest. Existing capacity, secrets, permissions, collection-only policy,
`browse_enquiries`, indexing/protection settings and disabled payments were preserved.
The compatible migration preceded the API, which preceded frontend promotion.

Current acceptance supersedes the earlier blocked checklist:

| Surface                      | Final evidence / status                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                         | Verified real empty catalogue state at 320/390/768/1024/1440; carousel/keyboard/FAQ and pause/play checked; browser-only populated/refresh-failure/retry/empty previews and reviews at 390/1440.                                                                                                                                                                             |
| Parts                        | Direct and vehicle paths, grouped detail draft, actual unknown-fitment status, populated shared cards, genuine empty vs filtered no-match, loading/failure/retry and corrected five-brake-example assertion verified in hosted fixtures.                                                                                                                                     |
| Vehicles                     | Populated/missing-media cards; budget Naira-to-kobo URL values, condition, independent chip removal and cancelled drafts verified at 390/1440; genuine empty state on production. Older supported URL semantics remain covered by existing passing unit contracts.                                                                                                           |
| Enquiry                      | Generic Product classification and editable draft survive public-resource refresh on the real site. Actual isolated HTTP persistence returned 202 without an invented product ID; linked-customer and other-category database constraints still reject missing references. No real production enquiry was submitted.                                                         |
| Demo                         | Public [read-only demo](https://alliedautotech.com/demo): 20 products/parts, 12 vehicles, four services, five categories, three makes and six models. Fictional prices/images/availability are visibly labelled, independently filterable, and sample details cannot order/reserve/submit. No dashboard, customer, staff, financial or genuine catalogue seed was published. |
| Accessibility and responsive | Selected page identity, meaningful content, no framework overlay, zero page exceptions, scoped axe, no horizontal overflow, keyboard/disclosure/modal controls and inspected desktop/phone captures passed. Emulation and automated checks do not certify real devices or screen-reader speech.                                                                              |

Release verification: all three workflows passed on the final backend/migration
source: [frontend release](https://github.com/Otto-space/allied-autotech/actions/runs/40158808468),
[isolated database safety and real parts persistence](https://github.com/Otto-space/allied-autotech/actions/runs/40158806716),
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40158484492).
Manual workflow dispatch covered the final `.gitattributes` checksum pin. Local
**43/43 packaged-image/release checks** passed, including non-root commands, CA
bootstrap, media/app imports, isolated migration replay, separate restore and drift
rejection. Local **13/13 database/security tests** passed. The earlier full frontend
988-unit run and later four fixture-contract checks are separate local receipts;
the final frontend workflow also ran the complete production check.

Selected hosted candidate coverage was **22 scenarios**: 13 real-data journeys,
eight browser-only fixture journeys and one explicit autoplay pause/play case.
The real 13 journeys were repeated successfully on the public production domain
after promotion, at the representative widths above, with zero page exceptions.
The 17 health/screenshot/axe entries in each real-data receipt are checkpoints
within those 13 scenarios, not 17 distinct scenarios. The full local 127-case
matrix remains unexecuted because preview startup was blocked by tool policy;
the selected hosted acceptance replaces the release blocker without claiming
that entire matrix passed. Real-device keyboards, screen-reader speech and real
authenticated staff/customer operations were not exercised in this release.

Database safety: confirmed the exact production host/25060/database, strict TLS
and separate backup/migrator/runtime roles. The provider listed **nine managed
backups**, latest **25 October 05:22:10 UTC**. Managed encryption, seven-day
retention/PITR and existing separate managed-restore evidence were reviewed against
the provider's documented recovery features. A fresh production logical archive
was actually restored into a new local isolated `_ci` database: **89 tables**, all
pre-existing row counts preserved, with the forward migration rehearsed from
64 to 65 and `db:check` passing. This was not a new managed PITR restore or a
restore over production. A new exact-target verified backup at **06:56:39 UTC**
preceded the guarded production `npm run db:migrate`; the target then passed
`npm run db:check`, all 65 checksums, validated constraint and runtime-column checks.
No production business DML, reset, data deletion, history resolution or grant
change was performed. Runtime remains unable to read the migration ledger or
perform ownership/DDL/TRUNCATE/superuser/role-creation operations.

An initial backup failed; client/permission checks and a successful verified retry
preceded any migration. A host-clock pause invalidated local time-bound processes;
affected Docker tests were rerun sequentially and the local restore was inspected
before resuming, without reset or failed-history changes. A post-migration
aggregate check initially tried to read the ledger with the restricted runtime
role and correctly received a permission denial. It was completed read-only using
the separate migration role; the migration was not rerun and no grant was expanded.
Every temporary operator firewall rule was removed and the original app-only
rules verified, including the final postcheck. API readiness and five public
catalogue/branch/service reads then returned 200. Public products, vehicles and
make choices remain truly empty; one real service and branch remain published.

Immediate frontend rollback is `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB`; API rollback
is `5c1ea9a7-6211-46d2-995f-c45e504bf9e9` and its protected immutable manifest.
The expanded SQL check is compatible with the prior application and must remain
in place during any application rollback. Never downgrade/restore the database
as an image-rollback shortcut. Recheck current provider state before future work.

Bounded disk cleanup removed the two task-owned, never-deployed obsolete API
images (`b9162cc4`, `dddef8c0`), five never-started test containers and their unused
internal network after checking exact IDs, state, image provenance, mounts and
container references. Docker totals during that cleanup changed **39 -> 37
images**, rounded **11.84 -> 11.81GB**, and **18 -> 13 containers**. All **14
existing volumes / 1.012GB** were retained. Current/rollback/other-task images
(including the independent `f0062282` build) and **6.627GB of useful warm cache**
were retained; no blanket prune, registry deletion or image archive was used.
Both task-created isolated verification databases were removed with the supported
test-only drop command after confirming exact loopback targets and zero active
connections; their measured logical sizes totalled **34,606,462 bytes**. Durable
verified backups and protected receipts remain. Host C: free space measured
**12,582,514,688 bytes** after cleanup; rounded Docker totals and logical database
sizes do not prove an equivalent physical host-space recovery. Local preview/API
ports 3165/5021 remained closed. Existing unrelated worktrees and main-checkout
edits were preserved.

Evidence: `%TEMP%/allied-home-release-20261025/` contains candidate/fixture/playback
and final production receipts plus responsive captures. Protected backend release,
backup, rehearsal, firewall, migration and image receipts remain under this
worktree's ignored, ACL-restricted deployment directory. No credentials, archive
contents or customer records were added to source. Owner inputs remain genuine
publishable stock, prices, approved service detail and authentic catalogue media;
the new demo is not evidence of genuine availability. Preserve settled Item 6.

## Cycle 5: Owner-directed homepage restoration — 25 October 2026

The owner's preference for the previous homepage supersedes conflicting design
guidance from Cycle 4. This correction starts from the complete released `3bf61321`
in isolated worktree `allied-home-restoration-20261025`, branch
`fix/home-restoration-20261025`. Both live aliases were independently checked at
07:27:19 UTC and still pointed to `dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`.
Main-checkout edits and independent staff-filter work remain untouched.

Baseline: the actual Home implementation at `93e2501b`, before `b9162cc4` changed
its hero, typography, partner introduction and editorial structure. Home history
and file-level comparisons show that intervening commits were unrelated. The
saved `allied-home-discovery-20261025/before-home-1440.png` confirms that design;
`allied-home-release-20261025/production-home-{1440,390}.png` records the redesign.
There is no unresolved competing baseline candidate.

Restored: trust-led hero, original workshop/showroom/family/parts artwork, Nippo
headings, partner introduction, workshop services, original technician story and
principles, darker vehicle section, illustrated parts section, equipment, customer
feedback, FAQ and contact invitation. The extra lifestyle grid stays omitted:
its themes already appear in the hero. Retained improvements are the paused
marquee (less competing motion), fuller published service descriptions, three
clear process steps, distinct failed/empty requests and retry controls, current
enquiry-only CTAs and the correct Product enquiry handoff. No booking, checkout,
reservation, inventory, permission or backend change is introduced.

The feedback section remains visible when there are no published reviews. Its
link restores direct discovery of the existing `/reviews` page, whose moderated
feedback, filters, account-aware action and privacy boundaries are preserved.
No review has been fabricated. `/demo` and all production-only sample catalogue
components/data are removed. Deterministic fixtures now live exclusively in tests;
shared real Parts/Vehicle cards retain their ordinary behaviour. The route
inventory is regenerated and a 404 regression replaces the demo acceptance.

Initial local lint/types/format, 992 tests in 148 files and optimized build passed.
The development browser run was stopped after duplicate-fetch assertions failed
under React development effects (first case also exceeded its cold compilation
timeout). This is not counted as release acceptance. Automatic approval review
blocked optimized loopback startup with “blocked by policy”; no alternate startup
was used. Browser plugin not available; existing Playwright and installed Edge
are used without downloads.

Hosted review passed 16 focused real/fixture scenarios on preview `80a967e3`,
then all 16 passed again on the production-configured `3b0c353c` candidate while
main/www remained on the existing release. The existing public-review suite
passed all 23 cases at 320–1536px: filters, cursor reset, empty states, error and
malformed recovery, stale requests, four synthetic roles, private-field exclusion
and untrusted text. No real sign-in or review submission was made. The suite's
separate access-cleanup wrapper initially returned failure because another
completed review had already revoked its own temporary key; both owned keys were
revoked and the provider state was rechecked. Existing protection was retained.
Initial preview anonymous account lookup was unavailable with preview settings;
production-configured review uses the existing production forwarding settings.
Expected 401/404 and deliberately injected 503 responses are not page exceptions.

Final polish gives the illustration caption a dark contrast surface. Additional
normal-motion checks found identical hero heights across all four slides at five
widths, visible keyboard focus and lab load layout-shift observations below 0.027.
These are lab/emulation results, not field performance. Doubling Home text at
320x568 reproduced min-content overflow in the parts/equipment grids. Scoped
zero minimum widths, breakable headings/links and stable icons corrected it in
browser-injected proposed styles; a permanent regression is added. Final hosted
acceptance must verify the committed CSS without injected styles before promotion.

Read-only rollout review at 07:53 UTC confirmed the unchanged active API,
database online, nine managed backups (latest 05:22:10 UTC) and the existing
06:48:38 UTC successful separate restore rehearsal across 89 tables/65 migrations,
with original rows unchanged and no production write. Existing encrypted
off-device retention/PITR evidence remains applicable. No new database command,
backup, restore, migration, role/grant change or Docker build is needed for this
frontend correction. Settled Item 6 and launch restrictions remain unchanged.

### Released and verified

Runtime source **`bb92ca529c3c75e8ed0b6439051412996184c0c0`** is live on READY
Vercel **`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU`**. Main/www aliases independently
matched at **08:08:20 UTC / 09:08:20 Lagos** on 25 October 2026. Final source
[frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40174871261)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40174871259)
passed. The complete 992-test frontend suite, lint, types, formatting and optimized
build passed locally on the implementation; exact final-source CI repeated the
release gate with lockfile-installed dependencies. Local reused Next is 16.3.8;
the hosted/CI lockfile version is 16.4.3. No package/dependency change was made.

Final acceptance: **16/16 hosted real/isolated-fixture scenarios** on the exact
production candidate, **7/7 additional stability/focus/enlarged-text/long-name/
broken-image checks** with committed CSS and no proposed-style injection, and
**23/23 public-review regressions** on the preceding candidate with unchanged
review code. After promotion, **9/9 real-data production scenarios** passed with
zero page exceptions and scoped axe checks. Home sampling covers
320/390/768/1024/1440px; the review suite additionally covers
360/375/430/1280/1536px and a short 320x568 screen. Lab layout-shift observations
were 0.0010–0.0269; all four hero slides had identical heights at each sampled
width. CSS text enlargement is a stress test, not a claim of real browser-zoom or
screen-reader acceptance. Source Home's full 18-case optimized localhost suite
remains unexecuted because startup was blocked; equivalent hosted checks above
are the actual acceptance evidence. Real devices, screen-reader speech and real
authenticated operational submissions remain untested.

The production page shows genuine empty parts/vehicle/review states and the
published service. Populated cards/reviews were verified only in browser-isolated
fixtures; no synthetic record was published. All retained Home images loaded in
the real-data desktop/phone inspections. Primary/secondary CTA destinations,
parts-enquiry editable prefill, FAQ/directions, mobile navigation, touch/keyboard
carousel, pause/play, reduced motion, retry/retained refresh failure and shared
real Parts/Vehicle cards passed. `/reviews` is public and linked; `/demo` is an
actual HTTP 404. Production anonymous account lookup shows the normal sign-in
action; the earlier preview-only unavailable-account state is not present.

Backend stays on ACTIVE `da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`, source `2fc02baf`.
No database command, migration, backup/restore operation, business DML, grant
change, real enquiry/review submission or payment was performed this cycle.
Immediate frontend rollback is `dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`; the preceding
preferred-design release `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB` is also retained.
Application rollback must retain migration 65 and the compatible API constraint.

Evidence outside source: `%TEMP%/allied-home-restoration-20261025/` contains
`candidate/hosted-qa.json`, `stability-qa.json`, preflight/postflight receipts,
`production/hosted-qa.json`, real `production/home-{1440,390}.png`, full-page
captures and review-page screenshots. Compare against the baseline/redesign
captures recorded above. Temporary automation keys were revoked, existing
protection retained, browsers closed and local ports 3166/5021 closed.

No Docker resource or dependency installation was created. Inspected context,
builders, image/container references, data volumes and disk usage; useful current,
rollback and other-worktree resources were retained. During concurrent activity
Docker totals changed from 37 images/11.81GB, 13 containers, 14 volumes/1.012GB,
6.627GB cache to 38 images/11.84GB and 6.715GB cache, with container/volume totals
unchanged. These additions are not owned by this frontend task and were retained.
Automatic approval review rejected removing the task's superseded `.next` output
with “blocked by policy”; no alternate deletion was attempted. The measured
143,481,750 bytes of generated output remain alongside 451,146,323 bytes of useful
warm cache. Host free space was 11,335,639,040 bytes after that rejected cleanup;
no reclaimed-space claim is made. Docker/database volumes and backups were untouched.

This completes the owner's focused homepage correction. Further business-approved
inventory and authentic customer reviews remain content inputs, not fixtures to
publish. Existing broader role/device/manual acceptance and settled Item 6 retain
their recorded scope; no further redesign is implied by the previous audit.

## Cycle 6: Audit A01–A07 — 25 October 2026

Scope: the complete 25 October UI/UX audit in Downloads and the supplied implementation
brief, read before editing. This is finite Batch 1, not acceptance of every route or
an instruction to redesign Home again. Revalidated both live frontend aliases on
`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU` and the backend ACTIVE deployment
`f9239c36-d4b7-4ef0-b8ba-479cda926a13`. Reused the clean homepage-restoration
worktree and dependencies/cache on `fix/audit-actions-20261025`; merge `b45513f1`
combines the preferred Home with the independently released `ff42b0e2` backend fix.
Only the tracker required conflict resolution, retaining both release receipts.
Main-checkout uncommitted work is preserved. No additional worktree, dependency
installation, editor profile, Docker build or application database write was needed.

### Revalidated findings and changes

| ID  | Current evidence and repair                                                                                                                                                                                                                                                                                                                                                                                                                          | Boundary                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Limited-release filtering left the customer group labelled My orders with only Saved items. The group now reads Saved items; full mode reads Orders & saved items and preserves distinct destinations.                                                                                                                                                                                                                                               | Existing route restrictions and staff navigation are unchanged.                                                                                                                     |
| A02 | Both finance headers still linked to absent /admin/operations. Back to overview now opens the existing /admin route, permitted to the same administrators.                                                                                                                                                                                                                                                                                           | No route or permission was added.                                                                                                                                                   |
| A03 | Saved-vehicle refresh, paging and retry buttons were unstyled native controls. They now reuse explicit secondary actions; garage management remains an underlined navigation link. Refresh exposes busy/disabled state.                                                                                                                                                                                                                              | Fresh ownership/configuration checks, unknown fitment and URL filtering remain intact.                                                                                              |
| A04 | Policy contact refresh still used the body-text link class. Both editors now use a shared secondary action, including busy state.                                                                                                                                                                                                                                                                                                                    | Selection, eligibility, review, approval and publication safeguards are retained.                                                                                                   |
| A05 | The overview still linked to restricted customer booking/order/payment details and advertised booking. It now describes the enquiry release, offers Request a service visit, omits unavailable actions and retains real historical summaries without misleading links. The date preset now reflects its actual range.                                                                                                                                | Full-mode record links and permitted operational access remain. No commerce flag or direct-route restriction changed. Help launch guidance was already mode-aware; it was retained. |
| A06 | Backend publicReviewer projects trimmed profile first/last name and a review-scoped photo URL. PublicReviewProfiles reads only a currently APPROVED review's current portrait; missing/unapproved/no-photo requests are 404, private/no-store, and do not expose contact details or garage media. The owner-only profile sentence contradicted this. Profile, upload/replacement/removal, review guidance/review confirmation and Privacy now agree. | Disclosure correction based on verified source/tests, not a claim of a confirmed data leak. No public field, storage rule or media permission changed.                              |
| A07 | Audience remained a dropdown. Native radio choices, audience-specific help and a persistent audience summary now sit beside the editor/review action; the existing confirmation repeats the audience and its consequences.                                                                                                                                                                                                                           | Customer reply form remains customer-only. Single-flight writes, preflight, review/cancel, draft recovery and unknown-outcome locks remain.                                         |

`action.tsx` consolidates the existing brand button foundation into explicit primary,
secondary, tertiary, danger and navigation variants plus a programmatic selected toggle.
`docs/ui-actions.md` documents semantics and migration boundaries. Only the named
consumers migrated; no blanket link-background rule or dependency was introduced.
The full source census records 1,209 native buttons, 105 native anchors and 58 buttons
using text-link styling across 283 files. These are review signals, not 1,209 defects.
The inventory now retains an 18-aspect per-page checklist and evidence record across
all 104 public/auth/customer/work route patterns; unreviewed aspects remain explicit.
Shared primitives do not imply acceptance of their untested consumers.

### Acceptance evidence

Browser plugin not available; existing Playwright with installed Edge was used, without
browser downloads. Local development preview: http://127.0.0.1:3166, launch mode
browse_enquiries, isolated browser/API fixtures. No production fixture was published.
Desktop/mobile before screenshots cover overview, support, policy contacts and finance
headers; after screenshots additionally cover Parts, profile, reviews and Privacy.
Evidence is outside source at `%TEMP%/allied-audit-actions-20261025/`.

The initial 31-case focused matrix passed: 360/390/768/1024/1440 widths, populated
customer historical activity, empty/error overview, administrator finance return links,
Super Admin contact refresh in both policies, saved-vehicle refresh and customer
profile/review/privacy disclosures. Main-region axe checks, overflow, page identity,
nonblank content, framework overlay, keyboard radio selection, review audience and
cancel-without-write assertions passed. Page exceptions were checked in the customer
and support matrices. The first attempt was stopped after an incomplete Parts fixture
had no make options and did not open the vehicle-discovery tab; this was a fixture
setup error, corrected before the passing run, not fictional stock added to the app.

Additional regression: 28/29 selected cases passed initially; the remaining
wrong-thread case failed only during Playwright trace teardown because two review
jobs shared the same output directory. The case passed on a sequential, isolated
rerun. Both saved-configuration workflows passed at 390/1440px; session invalidation
and late-response protection also passed. One console-health check exposed the
customer-review fixture's unimplemented notification-summary endpoint (404); an
explicit isolated zero-summary fixture corrected the setup. No application endpoint
or permission was changed to silence it. The six-screen console check then passed
without warnings, errors or page exceptions. Final DOM refinement uses a block
container for noninteractive metric summaries; the 390px overview and six-screen
console checks passed again. The additional 320x568 staff check passed empty-message
validation, associated error text, native radio keyboard operation and doubled-text
reflow without a write. Local lint, route type generation, TypeScript, all 996 unit
tests across 149 files and full-project formatting passed. The original combined
check attempts were stopped during resource contention and when the owner supplied
the new disk reserve; these are interruptions, not passing gates. Checks were rerun
sequentially with fresh reserve assertions. The optimized webpack build and standalone postbuild also passed. `/demo` is absent
from its generated route table. No production deployment or final-source hosted/CI
acceptance was performed this cycle. Local reused Next is 16.3.8; the lockfile is
16.4.3, so the normal locked-dependency release gate remains necessary before rollout.
The six existing backend public-review portrait tests passed, using the main checkout's
identical media/test source (Git equality checked against this branch). They use mocked
Prisma/storage and make no database connection or write. No schema generation,
migration, database safety check, backup/restore, grant change or production transaction
was required by these disclosure/UI changes.

Limitations: local development evidence is distinct from optimized hosted acceptance.
Fixtures verify UI states, not real role provisioning or operational readiness. Real
customer/staff sign-in, real submissions, physical devices, screen-reader speech and
actual browser zoom remain untested. Text enlargement is a CSS stress test and does
not certify browser-zoom or full WCAG compliance. No production deployment is implied.

### Next priorities

A08/A09/A12: paired range fields, concise field help and the remaining utility-action
consumers; A10/A11: compact customer/support queues and genuinely empty dashboards;
A13/A14: policy edit hierarchy and notifications/helper collisions; A15: policy reading
hierarchy. Preserve the owner's restored homepage direction. Broader checklist cells,
protected Privacy/Finance approval forms and real authenticated workforce acceptance
remain their recorded scope. Optional assistant/tours remain a later product decision.

### Completed checkpoint and disk reserve

Batch 1 (A01?A07) is complete in the local review branch; A08?A15 remain the finite
next backlog. The 104-route checklist has 12 explicitly scoped page records; all
other route/aspect cells remain uninspected in this cycle. Source discovery and
mocked acceptance are distinct from real role/device access. Before/after screenshots
and the normal/reduced-motion fixture evidence remain outside source; no screenshot,
trace archive, generated build, credential or synthetic inventory was committed.

The owner's new disk reserve was applied immediately: stopped the earlier check
chain before building, read and invoked `C:/Users/PC/.codex/scripts/assert-disk-space.ps1`,
then guarded lint/types/tests with 0.25 GiB allowances (small caches/type output).
The single warm optimized build passed its separate 21 GiB threshold: fixed 20 GiB
reserve plus a justified 1 GiB allowance, covering the measured ~451 MB warm cache,
~392 MB prior dev output and the small reused standalone bundle without a download
or dependency copy. Free space was 24.52 GiB immediately before that build and stayed
above the reserve during the measured checks. The checker is a preflight, not an OS
quota or guarantee about concurrent applications. The final measurement is recorded
in the completion tracker.

No task Docker resources were created. Reviewed desktop-linux context/builders,
image/container references and disk totals: 38 images/11.84GB, 14 containers,
14 volumes/1.012GB and 87 cache entries/6.715GB. The new running PostgreSQL container
belongs to another active task and was retained. Current, rollback, base/tool,
other-task and uncertain resources were retained; no broad prune or volume removal
ran. Removed only this batch's superseded 1,581,764-byte diagnostic trace archive
after its isolated rerun passed; retained screenshots, small receipts and useful
current build/cache. Other concurrent free-space changes are not attributed to this
batch. Earlier explicitly approved folder deletions remain subject to their recorded
automatic-review rejections; no deletion workaround was used.

### Production rollout — 25 October 2026

Owner explicitly requested production deployment after the local batch checkpoint.
Runtime `e9f48ef525b80cc215f340015b0553e5b1e3af73` is READY on Vercel
`dpl_5vyykAdQnDsAshfCKRU9KNkePJgb`. Both actual main/www aliases independently
matched at 11:13:48 UTC / 12:13:48 Lagos. This is a frontend-only promotion;
DigitalOcean remains ACTIVE `f9239c36-d4b7-4ef0-b8ba-479cda926a13`, source `ff42b0e2`.
No backend image, database migration, business-data write or permission change was
performed. The separate Shop/Vehicles revision-2 worktree remains in progress.
Future source selection must retain this release's audit fixes rather than deploy
its older frontend base over them.

Exact runtime-source CI passed: frontend release checks `40186973452`, backend
safety `40186973448`, secret guard `40186973443`. The locked-dependency hosted
candidate passed all 34 audit scenarios at 360/390/768/1024/1440px plus short-phone
validation/doubled-text checks, including zero-warning/error console health. The
first hosted attempt exposed a development-only test assumption: negated text
assertions still required Next's development portal to exist. Test-only commit
`8b5fe871` now asserts zero error portals while correctly accepting their absence.
Its frontend CI `40187506046` and secret guard `40187506070` passed. This commit
changes no deployed runtime input; Vercel excludes tests/docs, so the already verified
candidate was reused without another application build.

All nine real-data candidate checks passed: restored Home at 320/390/768/1024/1440,
loaded imagery, mobile menu, FAQ, carousel keyboard/touch/pause/play, service/quotation
links, public reviews and actual /demo 404. Scoped axe checks and page exceptions
passed. All nine real-data public scenarios passed again on production after promotion, with zero page exceptions. Expected anonymous-session 401 responses and the intentionally visited /demo 404 are recorded separately from application exceptions. The
34 dashboard scenarios used browser-isolated fixtures against the optimized candidate;
no fictitious record, real sign-in, reply, policy approval or transaction was submitted.
Physical devices, screen-reader speech and real authenticated operational acceptance
retain their stated limits.

Read-only preflight/postflight confirmed the database online, nine automated managed
backups (latest 05:22:10 UTC), existing encrypted off-device seven-day/PITR safeguards,
and today's successful 06:48:38 UTC separate 89-table/65-migration restore rehearsal,
original rows unchanged. No new database command, backup or restore was needed or run
for this frontend-only release. Backend origin, browse/enquiries mode, disabled private
testing and existing deployment protection were retained. Temporary hosted QA keys were
revoked and their absence verified before promotion. Immediate frontend rollback is
`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU`; preserve the current backend and migration 65.

Evidence: `%TEMP%/allied-audit-deploy-20261025/` holds scoped preflight/postflight,
`hosted-suite.json` and `candidate-public/hosted-qa.json` plus desktop/mobile captures.
Hosted audit screenshots refresh the existing `allied-audit-actions-20261025/after-*`
files; the before captures remain intact. Production captures use a separate directory.

Production completion: live Privacy copy matched the new profile first/last-name
and current-photo disclosure on both main and www; the restricted customer Orders
URL still redirected to Contact. These three additional read-only checks passed
at 11:15:50 UTC / 12:15:50 Lagos, without writes or page exceptions. All browser
contexts are closed. Exact-source CI, 34 hosted fixture scenarios, 9 candidate
public scenarios, 9 production public scenarios and the 3 changed-copy/restriction
checks are complete. Real-account operational submissions remain untested.

Disk completion: reserve checks passed before CLI upload, browser QA and final
handoff; final C: free space was 23.83 GiB. No local rebuild, dependency installation,
image archive, extra worktree or editor profile was created for this rollout.
Docker remained at 38 images/11.84GB, 14 containers, 14 volumes/1.012GB and 87 cache
entries/6.715GB. No task-owned redundant Docker resource existed to remove; useful
current/rollback/other-task resources and evidence were retained. Main-checkout
uncommitted edits and the independent R2 work remain untouched.

## Cycle 7: Shop, Vehicles and enquiry continuity — 25 October 2026

Bounded revision 2 implementation released. Frontend reviewed tree `cfba360d`,
READY `dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe` on main/www; backend `91455d10`, ACTIVE
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19`; database history/schema verified at 70.
The current audit/homepage source was merged and retained. This cycle does not
redesign other dashboard pages or complete all broader role/state acceptance.

| Area               | Verified behaviour and evidence                                                                                                                                                    | Limits                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Shop               | Broad product language, visible meaningful categories, native mode selection, scoped recorded choices, typed oil grade/ml, family reset, paired NGN budgets, explicit sort/history | Real catalogue still has zero published records; no inferred family/specification backfill                                |
| Vehicles           | Cross-field make/model search, exact full sort cursor, budget/condition preferences, requirements intent distinct from listing                                                     | Matching/persistence use real isolated PostgreSQL; no real listing or sourcing promise invented                           |
| Contact            | Both budgets and criteria in editable draft/review, listing reference, Keep/Start preserving both drafts, resume/reload, session separation and storage-failure protection         | Submission is mocked in browser; actual persistence/routing/authorization passed isolated API tests; no real enquiry sent |
| Catalogue admin    | Grade and explicit ml validation/review/persistence, family/category compatibility, shared other-product authoring preserved                                                       | Browser admin save is a fixture; no live product/category mutation performed                                              |
| Supporting queues  | New intent projected to authorised queues with existing branch/assignment/template restrictions; readable labels retain legacy listing semantics                                   | No new real authenticated operational sampling; broader dashboard redesign outside scope                                  |
| Recovery/rendering | Global/category empty versus no match/error, pending/stale searches, invalid budget focus, Escape return, responsive 360–1440                                                      | Edge automation and sampled main-state WCAG scans; no full physical-device/screen-reader certification                    |

Final source checks: 1,003/1,003 frontend units (150 files), lint, TypeScript,
formatting, optimized production build, zero production audit vulnerabilities;
backend CI, physical schema-drift rollback test, migration review/history/backup
checks, isolated domain tests and fresh 65→70 production-archive restore rehearsal.
All 18 hosted fixture browser cases passed in one final run. Two real public
read-only cases passed on the candidate and again on production at 390/1440.
No automated WCAG-tag violation or application error appeared in sampled main
states. Keyboard validation/modal focus and Escape were automated; full manual
assistive-technology and operational-role acceptance remain untested.

Visual inspection caught and fixed inherited oversized native radios. Real-data
inspection caught a generic footer enquiry losing criteria; Contact and bounded
WhatsApp footer links now follow applied client-side preferences. The category-only
empty state is explicit. Existing shared support for other products remains;
new specialist tyre/battery/other-fluid/car-care fields and optional oil approvals
are deferred pending their business contracts. Never seed fixtures to satisfy
missing publication data. No checkout/payment/delivery/reservation was enabled.

Manifest: `tests/quality/shop-vehicles-r2.txt`. Full contracts, migration/rollback
and detailed evidence: `backend/docs/shop-vehicles-search-r2.md`. Screenshots:
`%TEMP%/allied-shop-vehicles-r2/` (fictional populated fixtures) and
`%TEMP%/allied-shop-r2-real/` (real empty data/public prefills). Temporary hosted
review keys were revoked and existing protection retained. Local Next server
startup was rejected by automatic approval review; hosted validation completed
without an alternate local startup attempt.

Owned synthetic tmpfs test container was removed after verifying no other consumer.
Retained current/rollback images, useful caches, all data volumes, source, other
worktrees, private backups and the native recovery database. No broad prune or
unknown-file deletion. The 20 GiB reserve passed measured task preflights; final
reading is in the completion tracker. This does not enforce a machine-wide quota.

Remaining acceptance: real catalogue publication/labels and reviewed fitment are
business inputs; authenticated live queues and real private detail states remain
unsampled. Keep prior cycles' broader dashboard/manual backlog and settled Item 6
scope. No homepage restoration or broader redesign is implied by this release.

## Cycle 8: Notifications across roles - 25 October 2026

Bounded notification-only implementation on `feat/notifications-experience-20261025`.
Original baseline `0253a651`; checkpoint `04559c7a`, then current released R2 source
`71d3f60d` merged as `628d6add`. Shared generated contracts were regenerated.
No current production release, role, customer data or business policy was changed.

| Page/surface                                   | Verified implementation and state scope                                                                                                                                                 | Evidence/limit                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Customer `/dashboard/notifications`            | Focused inbox, optional full-width settings, read/unread, All/Unread/advanced filters, paging, whole-account bulk scope, retry and uncertain-write recovery                             | Populated browser-isolated fixtures; source-record commerce stays launch-restricted                                            |
| Staff/Admin/Super Admin `/admin/notifications` | Same workspace; own inbox and current managed-access gate, no title-based permission grants                                                                                             | Legacy four-role and represented eight responsibility fixtures; real operational accounts unsampled                            |
| Shared bell/preview                            | Global count, 99+ display/full accessible count, five frozen recent rows, no read-on-render, retry/empty/error, focus/Escape/outside dismissal                                          | Account/session isolation; no duplicate toast/sound stream                                                                     |
| Settings                                       | Reviewed switch changes, immutable channel policy, truthful defaults, unavailable SMS/marketing state and deliberate future consent                                                     | Existing preference/idempotency protections retained; no real provider delivery triggered                                      |
| Source-record context                          | Explicit read of displayed related IDs only, no hover/render/scroll acknowledgement or focus theft; missing/revoked source redaction                                                    | API integration and targeted rendered journeys; restricted full-mode customer commerce remains separately unsampled            |
| Browser push                                   | Local native subscription AND permission AND server binding, no prompt on mount, device-only off, endpoint/account isolation, bounded persistent ID deduplication and safe inbox clicks | Worker fake-provider + actual handler/storage harness; native Edge subscription probe failed with permission-denied AbortError |
| Producers/recipients                           | Persisted security events added transactionally; existing branch/assigned/delegated/internal-note boundaries and optional channel policy retained                                       | Isolated real PostgreSQL checks, no fabricated production events or broad escalation                                           |

Post-merge checks already passed: 1,018 frontend unit tests; 477 backend unit tests;
51 integration cases (42 domain/context/preference/retry/identity + 5 push-provider
fixtures + 4 ownership/summary). All 70 existing migrations replayed on a new
isolated `_ci` target with restricted runtime and `db:check`. Backend types, lint,
format, secret guard and 410 mounted/documented API operations passed. No new
notification migration is needed. Final frontend checks/browser evidence follow.

Fixtures never certify a real production account, physical device, screen-reader
speech or native delivery. Native probe used an ephemeral local Edge profile and
keys: permission reported granted, then subscribe failed with `AbortError:
Registration failed - permission denied`; no external provider send occurred.
Production push configuration already exists, confirmed read-only without exposing
secrets. A supported device/provider delivery and actual OS-click check remains.
Deploy the compatible push worker before the new service worker/frontend; missing
endpoint fingerprints intentionally fail closed. No publication in this cycle.

Screenshots: `%TEMP%/allied-notifications-cycle-20261025/` contains four-role
390/1440 inbox/preview/settings captures plus 360/768/1024 long-content views.
Final migration/API/browser/native receipts: `%TEMP%/allied-notifications-final-20261025/`.
Desktop/mobile captures were visually inspected; baseline screenshots were blocked
before local preview became available, so no manufactured before/after claim.
Current fixture preview is development mode with reused installed dependencies;
locked-dependency hosted acceptance is a separate pending release check.

Disk interruption and recovery: browser testing paused when C: fell below the
mandatory 20 GiB reserve. The approved disposable 1.94 GiB batch was automatically
rejected and retained. Owner completed CapCut uninstall, independently verified
about 5 GiB recovered and 21.16 GiB free before resuming a 1 GiB bounded stage.
Chrome, source, other worktrees, histories, databases, backups and release resources
were retained. No blanket cache/Docker prune or deletion workaround was used.

Final rendered checkpoint: 155 distinct browser scenarios have passing latest
outcomes across the recorded runs; this is not one clean full-suite run. The
147-case run first passed 143: one cold development redirect exceeded its wait and
passed unchanged on recheck; three old workforce assertions omitted the existing
Fitment link. Assertions were corrected only for the three already eligible
templates; all eight workforce scopes then passed. Nine focused context/focus/
doubled-text/reduced-motion cases passed, including seven permitted source-record
journeys. All four roles' 390/1440 inbox/preview/settings captures were refreshed
in an eight-case passing run. Restricted full-mode customer commerce context pages
remain inaccessible in the current browse/enquiries preview and were not counted
as passing. Physical-device zoom and full screen-reader speech remain unsampled.

Final device correction: push-status now returns only the current account/session's
endpoint hashes. A saved binding for an older endpoint cannot make the renewed
local subscription appear enabled. Six focused device tests passed after this
correction, including actual SHA-256 comparison and no repeated permission prompt;
five isolated push API/worker cases passed, including endpoint renewal and keeping
another session's device enabled. The earlier full frontend suite passed 1,018;
the six-case focused recheck includes one newly added regression (not 1,024 distinct
tests). Frontend types and full formatting passed; full lint exposed one unused
test import, removed and validated along with all subsequently changed source/tests.
The final endpoint-hash contract/types were regenerated and checked separately.

The optimized frontend build and standalone postbuild now pass on source
`0def5c64`, using the existing dependencies and `browse_enquiries` configuration.
It was initially blocked by the mandatory disk preflight. The owner subsequently
removed all four approved redundant installers (1,147,739,384 measured file bytes,
about 1.07 GiB); their absence and retention of both installed extensions were
verified. The 1 GiB build preflight passed with 22.08 GiB free, and the postbuild
reading was about 22.04 GiB. Chrome was untouched. No dependency install, duplicate
worktree or Docker resource was needed. The former disk/build blocker is resolved.
Build log: `%TEMP%/allied-notifications-final-frontend-build.log`; manual-cleanup
receipt: `%TEMP%/allied-notifications-final-20261025/owner-cleanup-verified.json`.

Installed Next is 16.3.8 versus the lockfile's 16.4.3; exact locked-dependency CI and
optimized hosted browser acceptance remain release checks. The rendered scenarios
were verified in the local development preview; this successful optimized build
does not turn them into production-mode browser evidence. Genuine native delivery
and OS-click acceptance remain unverified for the device reason above.

Live release was rechecked read-only: main/www still serve
`dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe`; backend remains ACTIVE
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19` with no pending rollout.
No notification deployment was performed. Release API/general worker before the
frontend, then verify native delivery/clicks on a supported consented test device.

## Production notification release - 25 October 2026, 17:26 UTC

Notification runtime 345847d5 is deployed: backend 1876e3d1-ab99-4e26-8a58-1ea4fcb0d46a
ACTIVE; frontend dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3 READY on main/www. API and
general worker preceded frontend promotion. Home/reviews, R2 and audit fixes,
permissions, database history at 70 and browse/enquiries restrictions are preserved.
No production fixture, customer message, transaction, migration or grant change.

Exact locked Next 16.4.3 CI passed: 1,019 frontend units, lint/types/format/build
and production audit; backend safety and secret CI passed. Nine image checks,
production read-only db:check, runtime least privilege and current worker heartbeats
passed. Today's separate 89-table restore and nine managed backups were verified.
Temporary exact-IP database access and hosted review keys were removed.

155 hosted fixture browser cases passed across 142+13 complete runs, including
four role families and eight workforce scopes. An outdated opt-in fixture failed
initially; adding its actual endpoint/hash contract resolved it without app changes.
Live Edge checks on both domains at 390/1440 passed Home/Reviews, authentication,
/demo 404, images, wrapping and console/runtime checks; no API writes. Native
delivery/OS clicks, physical devices, full screen-reader and authenticated real-role
acceptance remain unverified. Item 6 and broader operational acceptance remain open.

Full release/rollback/evidence details: backend/docs/notifications-experience-20261025.md
in the reused allied-home-restoration-20261025 worktree. Runtime remains 345847d5;
subsequent edits are evidence and the E2E fixture correction only. C: postflight
29.54 GiB free; current/rollback images, warm cache, databases/backups and other
tasks retained. No broad prune, duplicate install/worktree or image archive.

## Cycle 9: Product compatibility concurrent edits — 25 October 2026

Route `/admin/products`, administrator product detail editor. Another editor could
change a legacy compatibility between the freshness read and write. The new editor
sends the child version on update/retirement; the API checks it inside the product
mutation lock and rejects stale changes with 409 before history or mutation.
The administrator response exposes the version, while the public projection stays
limited. An older response without a version disables edit/retire and asks for a
refresh. A rejected review disables repeat confirmation, keeps the draft and offers
explicit reload of current values. The draft key includes the child version so
obsolete session storage does not override that reload.

Nine isolated PostgreSQL integration cases passed under a non-owning runtime role;
concurrent writes produced one success, one 409 and one history increment. Stale
retirement was rejected. All 13 Edge/Playwright editor cases passed locally,
including a 320px write-time conflict, draft recovery, no horizontal overflow and
automated WCAG 2.2 AA rule checks. A focused follow-up confirmed no duplicate
confirmation after rejection. The capture is
`%TEMP%/allied-compatibility-conflict-mobile.png`. Final-source checks and
hosted release evidence are tracked in the site-completion tracker. This is
isolated/fixture-rendered evidence, not a real authenticated production editor
session; physical devices and screen-reader speech remain untested.

On the 70-migration release branch, final-source backend race tests passed 9/9,
frontend/API builds, types and lint passed, and the optimized editor run passed
11/13 before two issues were isolated. The preflight retry rule was corrected so
a failed read can be retried safely while an attempted stale write cannot; a
separate screenshot timed out under concurrent checks. Both cases and the mobile
write-time conflict passed after the final rebuild (3/3 focused), with no new
horizontal overflow or automated accessibility violation. Hosted authenticated
acceptance remains open.

## Cycle 10: Customers and Customer Care - released 25 October 2026

Backend source dc0322f0; final frontend fd19aabc in the reused allied-shop-vehicles-r2-20261025 worktree,
branch feat/customers-care-20261025. Live backend 9ed4a4f2-683a-41f2-ab43-39673783a4a5
ACTIVE; frontend dpl_BVUgeibwBeTL3EvTZPiiCM9nMNgf READY on main/www at 19:44 UTC.
Notification source 17bc43fc and concurrently released compatibility source 313c4f9c
were merged and reverified; the release guard stopped when production changed.
Other worktrees/main edits are preserved. Home, finance and broader redesign remain
outside this cycle; only the shared semantic status presentation crosses dashboards.

Actual routes: Admin/Super Admin /admin/customers and details, legacy /admin/support
and case routes, managed Customer Service enquiry/complaint workspaces, customer
/dashboard/support and conversations. Existing per-page index entries remain valid.
Implemented genuine compact tables, visible details, labelled server search/filter/
cursor return state, copy controls with reserved space/focus/touch/manual fallback,
real reviewed account transitions/session revocation/audit, conversation-first care,
public/internal audience separation, retained drafts and per-operator notice dismissal.
Managed contact projection and dismissal retain exact responsibility/case scope;
sales-only readers gain no contact fields, suspension or provider permissions.

Locked Next 16.4.3 CI passed 1,024 units plus lint/types/format/build and production
audit (zero production vulnerabilities). Backend safety CI passed full empty replay
and schema checks at 71 migrations, the real missing-column guard and permission/
mutation flows. Final merged-source real isolated PostgreSQL/HTTP suite: 55/55 across
six files including the existing compatibility fix. Four non-root image contracts
passed on the task fixture. Route/OpenAPI coverage remains 415 operations/355 paths.

Final compiled Edge candidate: 15/15 new customer/care cases and 19/19 complete
customer-detail cases passed; 13/13 compatibility
editor cases passed on the merged predecessor. The final detail-only batch removes
stretched secondary panels and garage payment fields, corrects the synthetic garage
fixture and refreshes matching before/after captures. Conversation regression run passed 60/61; the disclosure shortcut
was corrected and all six focused role/audience/outage/responsive cases passed on the
rebuilt source. All 61 distinct cases therefore passed across the full run and rerun,
not in one all-green run. The table wrapper/assistive-label containment issue and
1366px grid override were fixed. Responsive 360/390/768/1024/1440, 1366x768 desktop,
200% reflow emulation, keyboard, contrast, scoped Axe and normal-flow console/runtime
checks passed. Broader backend run failures were investigated and resolved in focused
reruns; exact counts and caveats are in backend/docs/customers-care-20261025.md.

Forward migration 20261025170000_support_delivery_notice_dismissal applied through
the protected runner after a fresh verified production backup. Separate actual restore
rehearsal preserved all 89 original table hashes and migration ledger through 70-to-71.
Live db:check/history/checksums, least privilege, backup SELECT, readiness and eight
worker heartbeats passed. No existing grants changed. Temporary database IP access
and owned hosted-review keys were removed. Twelve real read-only post-promotion
journeys passed on both domains; no real customer was suspended, replied to or had
a notice dismissed for acceptance.

Synthetic before/after table, detail and care captures: %TEMP%/allied-customers-care-20261025/.
Browser receipts: %TEMP%/allied-customers-care-hosted/, allied-customers-care-regressions/
and allied-customers-care-compatibility/. Live smoke: %TEMP%/allied-customers-care-live/.
UI mutations use HTTP fixtures; API integration uses real isolated PostgreSQL. No OS
clipboard read; write outcomes are instrumented. Touch/zoom are emulated. Physical
on-screen keyboard/devices, full screen-reader, every shared-status consumer and
operational authenticated real-role acceptance remain unverified. Recovery was a
logical archive restore, not a new managed physical PITR cluster. These limitations
and broader site-completion Item 6 remain open; no perfection claim.

Only the owned auto-remove tmpfs fixture and eight superseded local candidate tags
were removed. All 14 volume identities, protected native fixtures/restores/backups,
current/rollback/base/tool images and other tasks were retained; no broad prune.
Postflight C: 28.77 GiB free at measurement; no machine-wide reserve guarantee.

## Cycle 11: Cart clear across tabs - candidate 25 October 2026

The reviewed customer cart could change in another tab after the client's final
read but before the empty-body DELETE. The server now requires the reviewed item
IDs, product IDs, quantities and unit prices, compares them under a cart lock and
returns 409 without deletion when anything changed. The client sends this snapshot
while preserving its full preflight, draft review and unknown-outcome safeguards.
The backend contract and all 13 compiled cart fixture cases passed. The selected
320px and 1280px cases passed automated axe/overflow and keyboard interaction;
this does not replace physical-device or full screen-reader verification. A fresh
isolated 71-migration replay and two backend integration files passed. Actual
production customer carts were not mutated for acceptance. Release and real-role
checks remain open; the per-page dashboard backlog is unchanged.

## Cycle 14: Help, Learn and safe practice - local 26 October 2026

Selected brief Phases 0-3 implemented in feat/help-learn-practice-20261026 from
released 76377d43. Public Help/Quick help and dashboard entry points now reach
server-filtered, versioned learning: 17 articles, three semantic-target guides and
11 fictional local exercises. Source flags remain off for publication. No AI,
operational lookup/action tools, new schema or unrelated dashboard redesign.

Actual isolated API/session fixtures cover visitor/customer/Admin/owner and all
workforce templates, combined/delegated access and CEO_MD scope. Managed Admin
does not gain legacy administration. Private titles/bodies/guide/scenario content
stay on the backend; 191 final client chunks contain none of 94 restricted markers.
Real live-page guides observe user events, preserve dirty support inputs and offer
written mode for missing, obstructed or narrow targets. Local practice validates
editable examples, confirms replacement, searches fictional part evidence, reviews
and resets only its own memory. It has no operational mutation adapter.

Final local checks: 1,032/1,032 frontend units, 77/77 backend checks and 18/18
optimized Edge browser cases; types, lint, format, build/postbuild and API contract
checks pass. Browser practice traffic contains no writes or external requests.
320/390/768/1440 practice and dashboard-entry overflow checks and scoped Axe pass;
keyboard modal exit/focus restoration, refresh/pause, route and identity transitions
are exercised. A new 7px entry overflow at 320 was fixed with an accessible 44px
icon button. Desktop/mobile captures were visually inspected.

Evidence/checkpoint: docs/help-learn/IMPLEMENTATION_STATUS.md, content register,
capability map and operations guide; screenshots %TEMP%/allied-help-learn-20261026/.
Playwright/installed Edge used because Browser plugin was unavailable. API/browser
fixtures, intercepted failure/hostile-content cases and actual production acceptance
remain distinct. Physical devices, full screen readers, other browsers, locked CI
and hosted acceptance are unverified. Installed Next 16.3.8 differs from lock16.4.3.
No production deployment or real customer/business write occurred; existing site
completion Item 6 and the broader dashboard backlog remain open.

## Fitment and product media - 26 October 2026 local candidate

Scope: `/admin/fitment` (permitted Sales/Operations authors, independent technical
reviewers, Admin/Super Admin) and `/admin/products?media=<id>` Images/Compatibility.
Branch `feat/fitment-media-20261026` reuses allied-home-restoration from recorded
release 76377d43; other worktrees and pending work are retained. No shared rollout.

Reproduced legacy Toyota/Camry labels with blank controls using the actual previous
component and isolated fixture. Unchanged review made no write. Corrected explicit
legacy reconciliation, normalized ID hydration outside suggestion pages, owner-bound
selection drafts, snapshot preservation during refetch, stale/version blocking and
mismatched context. Evidence readiness and approval are distinct; unknown years stay
missing. Editor task groups, paired years, populated/required qualifier priority,
secondary disclosures, contextual controls and independent review/history are verified.
Product tasks separate Images from legacy Compatibility while retaining old deep links
and list filters. Gallery moves use an atomic, versioned full-permutation backend
operation. Main selection, upload stages, trust/validation, audit and cleanup survive.
Hosted URL validation now rejects literal private/local and common expiring URL forms.

Evidence and precise acceptance matrix: `backend/docs/fitment-product-media-20261026.md`.
Before/after captures are actual rendered components with synthetic fixtures; no stock
or evidence was invented for production. Isolated native PostgreSQL replayed 71
migrations and passed db:check; 21 API/database integrations, seven backend units and
40 frontend units passed. Full frontend lint/types/optimized build and backend
lint/types/OpenAPI/route checks passed. Browser checks use installed Edge, with scoped
Axe, keyboard/focus, 360/390/768/1024/1440 and existing 320px regression. A separate
real API/browser case uses actual file bytes, database persistence, public image
access and removal against an isolated database and memory storage provider.
Final compiled browser counts and artifact paths are recorded in the evidence doc.

Outstanding: real authenticated production-role, physical-device/on-screen keyboard,
full screen-reader, actual object-storage-provider and locked Next 16.4.3 CI acceptance.
Installed Next is 16.3.8; no dependency duplication. 200% native browser zoom and full
contrast/motion acceptance are not inferred from narrow-width/Axe checks. Business
must provide real photos/evidence and reconcile actual legacy records; names do not
establish approved product types or compatibility. No production data/role/storage
write or production deployment occurred. Site-completion Item 6 remains open.

Final fitment/media checkpoint: 36/36 compiled scope cases and 12/12 adjacent
upload/product regressions passed (48 total). Actual native isolated API media
lifecycle and URL rejection passed; 200% logical reflow/reduced-motion emulation
is distinguished from native/device acceptance. Owned preview/test API stopped;
54.78 MiB superseded browser output removed, current evidence retained. C: 29.88 GiB
free at measurement. Docker daemon unavailable; no Docker resources created or pruned.
Gallery alignment follow-up: removed an inherited sibling margin, rebuilt and passed
all five populated-gallery widths again with an actual desktop alignment assertion.
Current review captures reflect the follow-up; no production release or new scope.

Fitment/media production checkpoint - 26 October: runtime a28753ab is live in
frontend dpl_CucTTefbZ71ApHiWsYA8P9JrPoH9/backend caeac741-805b-47a5-bb2d-d9e703cdff77.
Locked CI and hosted Next 16.4.3 passed, closing the local dependency-version gap.
Thirteen read-only Edge journeys at 390/1440 passed; both aliases verified, no page
runtime errors/overflow, Home-to-Parts and authentication redirects retained.
Captures: %TEMP%/allied-fitment-media-production-20261026/. Read-only production
schema/privilege/heartbeat checks passed; no migration/business write. Real signed-in
fitment/review/provider upload, physical and screen-reader acceptance remain open.
See backend evidence for rollout, recovery/rollback and disk-retention receipts.

## Cycle 14 production addendum - 26 October 2026

The owner subsequently authorised deployment of Help, Learn and Practice Phases 0-3.
Frozen runtime `adef02f9` includes the actual preceding fitment/media release
`a28753ab`; broader redesigns and separate pending branches remain outside scope.
Both domains point to Vercel `dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD` (READY);
backend `1dbceb73-075e-4f41-bd76-deb3daf71354` is ACTIVE. Learning, guides and
safe local practice are enabled, AI remains disabled and browse/enquiries mode is
preserved. All three exact-source CI workflows passed, including locked Next 16.4.3
and 1,036 frontend tests; production dependency audit zero vulnerabilities.
Merged learning/media regression 26/26, deployment specs 32/32 and packaged contracts
10/10 passed. Read-only production public catalogue/practice and private-denial
probes passed. Frontend provider READY/alias evidence does not establish hosted UI
or authenticated-role acceptance. Physical-device, full screen-reader and actual
production-role journeys remain unverified; earlier local fixture/browser evidence
retains its stated boundaries. No business record or message was submitted.

Full release, rollback, backup/restore and disk evidence:
[Help/Learn production record](../../docs/help-learn/PRODUCTION_RELEASE.md).
Original Cycle 14 no-publication/locked-CI limitations describe the historical local
milestone and are superseded only by the explicit evidence in this addendum.
Site-completion Item 6, business policies and unrelated pages remain open.

The correction is released: frontend `dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u`
READY on main/www, backend `98401193-fb85-48d9-8c51-462dcadd6d19` ACTIVE,
source `76377d43`. The production API and public route smoke passed; the real
signed-in cart clear, physical devices and screen-reader flow remain untested.

## Cycle 12: Staff access revision — candidate 25 October 2026

Status, branch and role changes now require the selected account revision in the
backend. Missing revisions fail validation; concurrent stale changes return 409
without overwriting the winning decision. The existing dashboard sends the
revision and keeps its review, result verification and unknown-outcome controls.
Fresh isolated database tests passed, including competing mutations. Seven
compiled browser fixtures passed at 320px and 1280px. These are mocked browser
flows, not real signed-in role, physical-device or screen-reader acceptance.
Production release and hosted verification remain open.

## Cycle 13: Customer table and sidebar responsiveness - 26 October 2026

Owner screenshots showed customer rows stacking their actions when the sidebar
expanded. Reproduced at 1200 CSS px: approximately 105px rows expanded versus 57px
collapsed, with table overflow. The shared dashboard suffix-based action selector
overrode the intended no-wrap rule. Dedicated row controls now keep both actions
together. Stable identity/status/date/action column widths, compact horizontal
padding and a flexible email column keep all six columns visible at 1184-1920px
in either sidebar state. Long identities remain complete and wrap naturally.

The requested table, desktop navigation and mobile-drawer scrollbar tracks are
hidden. Overflow remains scrollable with touch/wheel/keyboard; the page scrollbar
is unchanged. The pinned identity column becomes static on phones. Focus capture
reveals whole controls clear of the pinned column and table edges; this fixes an
observed 1024px Edge case where native Tab focus left an action partially clipped.
Existing account review/sending safeguards, search, sort, paging and permissions
are unchanged. No real customer/account, database or external-message writes.

Final compiled local Edge run: 22/22 browser cases in one complete run (13 new
responsive/navigation cases plus nine existing care regressions). Six desktop
widths 1184/1200/1280/1366/1440/1920, narrow widths 320/390/768/1024, short sidebar,
customer/admin navigation and mobile Escape focus passed. Copy/manual fallback,
touch emulation, filters/detail return/paging, long content, sampled Axe/contrast,
and 200% reflow emulation passed. Four related units, targeted ESLint, TypeScript,
formatting, optimized build and standalone postbuild passed.

Initial failures were retained: cold dev compilation exceeded its first navigation
wait; a two-pixel desktop overflow and wrapping status label were corrected; native
keyboard focus exposed the clipping defect fixed above. Navigation test locators
were made stable while disclosure state changed. The final compiled run is green.

Evidence: %TEMP%/allied-customer-table-20261026/ contains before/after screenshots,
row metrics and traces. %TEMP%/allied-customer-table-compiled.log records 22 passes;
allied-customer-table-build.log and allied-customer-table-final-types.log retain
build/type results. Browser plugin unavailable; installed Edge/Playwright used.
Fixtures use synthetic example.test records and intercepted APIs, not published data.

Dependencies were reused (installed Next 16.3.8; lockfile 16.4.3). Exact locked CI,
hosted acceptance, authenticated real-role, physical devices and full screen-reader
testing remain unverified. Vercel management read returned 403; no access protection
was changed. The last recorded frontend release remains dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u;
DigitalOcean was read-only verified ACTIVE at 98401193-fb85-48d9-8c51-462dcadd6d19.
No production rollout was requested/performed in this cycle. Item 6 stays open.

Local-artifact postflight: owned development and compiled preview servers stopped;
C: measured 29.99 GiB free (30.30 GiB before work). Browser evidence totals about
8.4 MiB. Reused dependencies/worktree and useful compiled build/cache retained;
no install, extra worktree, profile copy, image archive or Docker resource created.
Docker inventory was unavailable because its daemon was stopped; no Docker cleanup
was attempted. Source, unrelated work, histories, backups and databases retained.

26 October combined production checkpoint: runtime 3ccee21a publishes the pending
customer table/sidebar, required staff-revision and Help/Allie batches together.
Backend e8c5297d-93f5-41e0-97bd-0c7851fa5daa ACTIVE; frontend
dpl_5hGWpdJyGqQgG69dcumqFQ2RU7HQ READY on main/www. Exact-source locked CI,
1,039 units, 41 isolated integrations, nine image cases, 57 hosted-candidate fixture
browser cases and 22 live read-only checks passed. Captures:
%TEMP%/allied-pending-release-production-20261026/ (real public reads), plus existing
allied-customer-table-20261026 and allied-allie-20261026 folders (synthetic fixtures).
Provider-cookie/identity/timing harness qualifications, three skipped provisioned
cases and remaining actual-role/device/screen-reader limits are explicit in
backend/docs/pending-commits-production-20261026.md. No business submissions or
schema migration. Broader Item 6 remains open; other worktrees preserved.

Revision 4 W1 local checkpoint: real workforce account directory replaces UUID-first lookup.
Scoped backend projection and copied-detail authorization, URL filters/pagination,
cleared failure states and existing reviewed editor retained. 31 isolated database/HTTP
tests, 14 focused units and 18 distinct fixture browser scenarios passed across
320/390/768/1024/1440 plus existing 430px editor coverage; exact reruns and initial
fixture/locator/reflow corrections are in docs/help-learn/WORKFORCE_DIRECTORY_W1.md.
No production writes/publication. Installed Next 16.3.8 differs from lock 16.4.3;
hosted/actual-role/device/screen-reader acceptance and full Revision 4 foundation
remain open. The 106-route structural coverage baseline is not completion.

Revision 4 W2 local checkpoint: owner demotion atomically removes role-dependent
delegation, advances workforce version and records reason without deleting valid
scoped duties, independent financial grants or histories. Invitation acceptance
cannot revive dormant delegation. The review submits both account/workforce
revisions. All 37 isolated HTTP/DB tests, 1,053 frontend units and optimized build
passed. Updated W2 browser specification is not rerun: compiled preview start was
blocked by automatic approval review; no alternate startup. W1 browser evidence
is separate. No schema migration, production rollout or real communication.
Evidence: docs/help-learn/WORKFORCE_ROLE_DEPENDENCIES_W2.md. Remaining foundation,
actual AI, all-route learning, handoff/live chat and evaluations stay required.

Revision 4 W3 local checkpoint: assignment/delegation definitions pinned to reviewed
version 1, using forward migration 72 with portable LF checksum. Fresh empty replay,
schema comparison/db:check, preserved reduced populated fixtures and existing
non-destructive SQL guard passed. Fixed a reproduced delegated-admin copied-target
branch bypass (200 before, 403 after); canonical versioned fitment, assignee and
support-recipient eligibility align. Strict legacy mutation receipts preserved;
updated clients explicitly request version metadata. All 57 isolated HTTP/DB cases,
five backend units, 1,057 frontend units, lint/types/contracts and optimized build
passed. W2/W3 rendered QA remains open after policy-blocked compiled preview start.
No production migration/deployment, real messages, provider call or published stock.
Evidence/rollback dependencies: docs/help-learn/WORKFORCE_TEMPLATE_VERSIONS_W3.md.
Current C: postflight 28.12 GiB free; same useful Docker/current/rollback resources
retained, no pruning. Complete effective-access/transition matrix, actual AI, full
learning coverage, reviewed handoff, gated chat and evaluations remain required.

26 October campaign release: 8c11c3a0 is live with the supplied unaltered poster on
home/About, complete 4:5 framing and About workshop-wall archive removed. W1/W2
committed workforce changes included; unfinished W3 preserved separately. Local
61 distinct browser cases accepted after documented stale-fixture corrections,
1,053 units, scoped Axe/keyboard/responsive checks and all CI passed. Production
alias identities and independent backend health verified. Hosted actual-role,
physical device and full screen-reader acceptance remain open. Evidence, exact
release/rollback IDs, disk qualification and screenshot paths are in
backend/docs/pending-commits-production-20261026.md, campaign release section.

26 October 2026 - owner-authorised pending W3 workforce commit 432308e0 deployed
as reconciled runtime c4e0005d, preserving live campaign/W1/W2 and payment-source
concurrency source 2033b159. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a ACTIVE;
frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln READY, both apex/www aliases verified.
Guarded forward migration 72 and db:check passed after fresh backup and actual
separate populated 90-table restore/migration rehearsal with original row hashes
preserved. All exact-source CI, 123 restricted-runtime integrations, 41 release/
image cases and 43 distinct hosted fixture browser journeys accepted. Post-release
DB/least-privilege/worker checks and original app-only firewall verified. No grants
changed or real business submissions. Existing rapid overlapping staff-directory
filter loss remains separate; actual-role/device/screen-reader acceptance open.
Operator harness/timeout qualifications and compatible recovery composition are
in backend/docs/workforce-versions-production-20261026.md. Other worktrees and
uncommitted edits preserved; no speculative Docker cleanup; C: 27.71 GiB free.
Full Revision 4 implementation and broader Item 6 remain open.

26 October 2026 - Revision 4 W4A local checkpoint: server-derived responsibility
capabilities/branch/scope/provenance and assign/revoke added/removed/retained preview.
Delegated hidden-source and maximum-scope redaction retained; optional impact digest
is recomputed inside the existing locked mutation, rejecting stale/expired reviews
without partial writes. Position, baseline, independent grants and approval rules
are unchanged; full effective-policy/nav/session/subscription composition is open.
Fresh synthetic native CI target replayed 72 migrations, schema/db:check and runtime
least-privilege checks passed. 56 workforce plus seven learning integrations, 12
backend units, 1,066 frontend units, final lint/types/contracts and optimized build
passed; 24 focused units rechecked the final lifecycle correction. 77 distinct local
fixture browser cases accepted at 320-1920px, impact review 390/1440px with Axe,
keyboard, overflow and inspected screenshots. An initial raw-503 fixture expectation
was corrected to the existing safe generic error; no product safety was weakened.
The exact prepared preview script started on 127.0.0.1:3167 after fresh explicit
owner approval. All browser APIs were intercepted; no real submissions/deployment.
Evidence: docs/help-learn/WORKFORCE_EFFECTIVE_ACCESS_W4.md. The 106-route completion
gate remains unmet; actual AI/provider evaluation, full learning, persisted Customer
Care handoff and staffed/gated live chat remain required. C: postflight 27.85 GiB;
no Docker/worktree/profile/install duplication or speculative pruning. Other active
worktree changes/releases are preserved and require reconciliation before any rollout.
Full Revision 4 and Item 6 remain open.

26 October 2026 - Revision 4 W5 local checkpoint: canonical managed-workforce
navigation/page/action predicates, scoped revision metadata and server-relative
activation/expiry rechecks. Access loss discards stale reads, protected drafts,
learning and staff notification previews; forbidden pages return to the permitted
overview with an explanation. Owner baseline preserved even with a business-position
record, including the current-role guarded legacy invitation helper. No authority,
commerce, schema or real messaging capability added. Existing unknown-save recovery,
MFA, branch/assigned scope and independent approvals retained.
75 distinct native HTTP/DB cases accepted across bounded runs on the W4 synthetic
CI target; db:check and runtime restrictions reverified. Full 1,086 frontend units,
then 29 route/draft and 16 final preview cases passed; lint/types/contracts and the
final optimized build passed. 87 distinct intercepted browser cases accepted in
12 bounded batches, plus two console/Axe/overflow screenshot rechecks at 390/1440px.
Mobile/desktop images visually inspected; real roles, physical devices and full
screen-reader acceptance remain open. Tests exposed/fixed notification cache and
record-navigation draft regressions; harness qualifications are documented.
Evidence: docs/help-learn/WORKFORCE_NAVIGATION_SESSIONS_W5.md. The full Revision 4
and 106-route completion gate remain open: independent policy composition, real AI,
persisted reviewed handoff, gated staffed chat and provider evaluation are required.
No W4/W5 deployment. Other active worktree changes/releases retained and need
reconciliation before publication. Disk preflight stopped a low-headroom build;
space recovered without deletion. Reviewed obsolete dev-output deletion was blocked
by automatic approval review; no alternate removal attempted. Browser batches kept
at least 27.074 GiB in accepted receipts. No Docker resources created/pruned.

Revision 4 W6 (27 October): backend-only provider/retrieval core passed 51 contract/unit and 10 native learning cases with the provider mocked. No frontend interaction or source inventory changed; W5 rendered evidence above remains the UI checkpoint. Allie UI is still reviewed search, not an enabled conversation. See `docs/help-learn/ALLIE_PROVIDER_CORE_W6.md` for actual checks, provisional data flow and unfinished state/quota/endpoint/UI/provider evaluation. No new visual acceptance or deployment claimed.

Revision 4 W7 (27 October): owned transient conversation backend passed 36 native HTTP/DB and 139 unit cases with provider mocked; migration 73 fresh replay/schema/db:check and generated API types passed. No conversation UI added or new rendered acceptance claimed; W5 remains the frontend checkpoint. Owner setup instructions and a DPAPI masked-key helper are available. AI remains disabled; full 106-route acceptance, configured-provider evaluation, privacy UI, persisted Customer Care handoff and gated chat remain open. Evidence: docs/help-learn/ALLIE_CONVERSATIONS_W7.md and learning-threat-model.md. No publication.

Revision 4 W8 (27 October): local Allie conversation/privacy UI accepted in 16 distinct browser fixtures, 19 new unit cases and full 1,109-case frontend run; final focused/format/lint/build checks passed. Public and all existing dashboard roles, six widths plus 390x844, stop/unknown-outcome/clear/access boundaries, keyboard/focus/reduced motion and Axe verified as documented. Native backend 37 integrations and 60 core/state units passed with provider mocked; no real model or combined hosted journey. Existing auth launcher exclusion preserved after correcting the test assumption. Evidence: docs/help-learn/ALLIE_CONVERSATION_UI_W8.md; no publication/default AI enablement. All 106 route decisions, provider evaluation, persisted handoff and gated chat remain open.

Revision 4 W9 (27 October): actual provider evaluation and local browser composition
checkpoint accepted within limits; baseline quality issues and representative fixes
recorded in docs/help-learn/ALLIE_EVALUATION_W9.md. 80 units/39 native cases, backend/
frontend types/lint, actual guest/customer flows, native-dialog Axe and inspected
390/1440 screenshots. No new UI redesign, publication, permission expansion or build.
All 106 route gates and full handoff/live/workforce foundation remain open.

27 October 2026 - Revision 4 W10 local checkpoint: unsupported workforce history
preserved by bounded read-only contracts and revocation receipts; current grants
and mutation inputs remain strict. Nine native effective-access cases, 17 focused
frontend cases, full 1112 tests/167 files, source/scripts/frontend types and lint,
OpenAPI375/routes439+4 and one optimized cached build passed. Four final rendered
fixtures at 320/390/768/1440 passed with keyboard, Axe, overflow and no writes/errors/
external calls. Inspected mobile/desktop viewport screenshots; fixed test disclosure
and tall-element screenshot assumptions. No provider call, schema change, install,
new worktree or publication. Evidence: docs/help-learn/WORKFORCE_HISTORY_W10.md.
Exact-lock Next16.4.3 CI, hosted/real-role/device acceptance remain open. Independent
grant/account-baseline composition and granular care authority are next foundation
dependencies before persisted reviewed handoff and gated shared/staffed transport.
All 106 route completion gates remain open; full Revision4/Item6 stays active.

27 October 2026 - Revision 4 W11 local checkpoint: separate recognised active
owner grants compose with the managed boundary without widening branch duties.
Existing refund/dispute/privacy/financial-policy workspaces, current grant revision,
source eligibility, scoped notification links and stale-read/review disposal align.
Managed Admin uses the scoped refund queue and cannot recover broad legacy refund
inspection; owner/unenrolled legacy inspection and independent approval remain.
57 native HTTP/DB cases, 112 backend units, full 1114 frontend units and final45
focused cases, 18 populated role/width browser fixtures and11 history/session
regressions passed. Types/lint/contracts, final cached build and secret guard pass.
Known Next not-found CSS preload warning is verified/reported separately; full
route acceptance, hosted/device/screen-reader checks remain open. No schema/model
call, real message, install, new worktree or publication. W9 approval stays exhausted.
Evidence: docs/help-learn/WORKFORCE_INDEPENDENT_ACCESS_W11.md. C:25.79GiB free; Docker
retention reviewed without deletion, denied dev folders unchanged. Next: compatible
scoped BOOKING_CONFIRM and financial-aftercare adapters, then granular Care duties,
persisted reviewed handoff and shared staffed/gated transport. All106 completion
decisions and full Revision4/Item6 remain active.

27 October 2026 - Revision4 W12 local checkpoint: scoped booking confirmation
requires current BOOKINGS_READ branch scope AND separate BOOKING_CONFIRM. Shared
legacy capacity/calendar/assignment/schedule/version/audit/reminder guards retained.
Eleven scoped native,57 workforce/session/learning,11 legacy booking,59 backend units,
full1121 frontend and final34+35 focused cases passed. Twenty final responsive
fixtures at320/390/768/1440 and one actual browser/CSRF/API/restricted-CI-DB
confirmation passed. Fixed stripped recovery hints via explicit reviewed error codes
and narrow-detail label squeezing via detail-only stacked mobile facts.
OpenAPI376/routes440+4, generated types, types/lint/secret guard and final cached
build pass; exact-lock16.4.3/hosted/device acceptance remains open. No schema change,
model call, real message, install, new worktree or publication; W9 allowance exhausted.
Evidence: docs/help-learn/WORKFORCE_BOOKING_W12.md. C:25.56GiB measured free. Native
API stopped and synthetic browser session/cookie retired; existing frontend preview
retained. Docker resources preserved, denied dev-folder cleanup not retried.
Next: scoped financial-aftercare then granular Care permissions, persisted reviewed
handoff/shared staffed transport. All106 route gates and fullRevision4/Item6 active.

27 October 2026 - Revision4 W13 local checkpoint: scoped financial aftercare
requires current FINANCE_READ branch scope AND separate FINANCE_POLICY_APPROVE.
Minimal queue/detail, current evidence HMAC, customer-visible reviewed decision note,
receipt verification and reload-safe uncertainty block implemented. Existing legacy
fee/inspection/immutable-data/audit rules retained; no stock/refund execution.
Final62 native across7 suites,60 backend units, full1130 frontend plus67 focused,
21 responsive Staff/Admin fixtures and1 actual browser/CSRF/API/CI-DB case passed.
OpenAPI379/routes443+4, generated types, types/lint/secret guard and cached build pass.
Evidence: docs/help-learn/WORKFORCE_AFTERCARE_W13.md. No schema/model call, real message,
install/new worktree or publication. W9 allowance exhausted. Native API/session/cookie
retired; frontend preview retained. C:25.43GiB measured free; Docker useful resources
preserved and denied dev-folder cleanup untouched. Next: granular Care permissions,
canonical reviewed persisted handoff and shared staffed/gated transport. All106
route learning decisions, exact-lock/hosted/device gates and fullRevision4 remain open.

27 October 2026 - Revision4 W14C local checkpoint: operational Care view/reply/assign
intersect on the actual branch. General enquiries and complaints use canonical
reviewed assignment with checked eligible-handler pagination, CAS/audit/notifications.
Read-only controls, current help/practice predicates, public/internal separation,
revocation and reference-only uncertainty recovery implemented; unsent cross-action
drafts retained after verified success. Final14 native+61 regressions,21 backend
units, full1145 frontend/171files+36 focused,36 new responsive and50 legacy browser
cases pass. One real browser/CSRF/API/restricted-CI-DB flow saved2 assignments and
2 public replies,4 audits,zero internal messages,unchanged inventory/bookings.
OpenAPI381/routes445+4,types/lint/secret3260/correctly configured cached build pass.
Screens inspected; synthetic sessions revoked/cookie removed. No schema/provider
call,real delivery or publication. Evidence: docs/help-learn/WORKFORCE_CARE_CASES_W14C.md.
FullRevision4 remains active: next canonical reviewed persisted Allie handoff, then
shared staffed/gated transport and all106 exact route-learning decisions. W9 allowance
exhausted; new Care guidance has no actual-provider re-evaluation. Exact-lock16.4.3,
hosted/actual-role/device/screen-reader gates stay open. Useful Docker/caches retained.

## Revision 4 W15: reviewed Customer Care handoff

Verified customer Allie now opens an editable queued-message flow without requiring AI attempts. Exact destination/audience review, selected excerpts, cancel/edit, loss/reload recovery, independent drafts and canonical history/operator visibility are implemented. Full 1,161 frontend tests, 32 distinct Allie/handoff browser fixtures at 320-1440px and one real browser/API/restricted-CI-DB composition pass; scoped Axe and keyboard/focus checks are recorded. Backend ownership/privacy and transactional acceptance remain distinct from real delivery. Evidence and screenshots: `../../docs/help-learn/REVIEWED_HANDOFF_W15.md`. No provider call, production seed, publication or live-chat staffing claim. Two exact customer-support matrix entries contain partial evidence; all 106 complete route decisions remain open. Physical devices, complete screen readers, current hosted roles, new-source real-provider quality and shared staffed transport remain unverified.

26 October 2026 - complete colour/state brief, local implementation checkpoint.
Branch feat/colour-states-20261026 in allied-shop-vehicles-r2-20261025, based on
3cea520f / released runtime 8c11c3a0. Shared black/red/white tokens, branded
marketing/navigation/Allie gradients, contextual focus/selection and semantic
statuses are implemented; approved imagery and white operational surfaces remain.
No backend, schema, permission or business mutation changed. 1,053 units, lint,
typecheck, optimized build and 30 contrast pairs passed. Browser evidence accepts
324 distinct cases across 118 files; three optional cart-drawer cases unexecuted.
Firefox/WebKit, native autofill/pickers, physical devices and full screen-reader
acceptance remain unverified. Exact coverage, initial harness corrections, safe
screenshots and remaining limits: frontend/docs/COLOUR_AND_STATE_REPORT.md and
colour-browser-coverage.json. No push/deploy under this brief. Other worktrees,
Desktop edits and the separate workforce/Allie scope are preserved. Broader site
completion Item 6 remains open. Task servers stopped after checks; no Docker
resources created/deleted; final disk preflight 28.15 GiB free.

26 October 2026 - owner-authorised colour/state release deployed.
Runtime d6d8534d preserves deployed workforce/payment source c4e0005d and adds the
black/red/white presentation. Vercel dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD READY;
both apex/www aliases verified. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a
remains ACTIVE and unchanged. All three exact-source CI gates passed, including
1,057 units, zero production audit vulnerabilities and isolated 72-migration
replay/db:check. 39 hosted fixture cases and 12 post-promotion public checks passed;
independent www and backend health reads passed. Formatting/hydration harness
corrections and explicit device/native/three cart-drawer limits are documented in
backend/docs/colour-production-20261026.md. Managed backups and retained populated
restore proof verified; no new restore, production DB command or business write.
Prior frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln retained for compatible rollback.
Other worktrees and Desktop edits preserved; no Docker cleanup; C: 27.86 GiB free.
Broader site completion Item 6 and the separate workforce/Allie roadmap remain open.

26 October 2026 - colour and brand assets Revision 2 local checkpoint.
Branch feat/brand-assets-r2-20261026 in allied-shop-vehicles-r2-20261025, based on
ce3121b8 / released d6d8534d. All nine supplied files inspected and original hashes
preserved; five pixel-identical logo crops and nine responsive WebP posters prepared.
Shared red/white/black marks, Home trust/service artwork, About portrait and Services
workmanship implemented. Ad 4 withheld: nationwide delivery contradicts collection
policy; clean corrected artwork is a business/source dependency. No policy changed.
1,057 units, lint/types/build/format and 30 contrast pairs passed. 103/109 broad
fixture browser cases passed; six await optimized replay (three development loading/
navigation failures and three Help/Learn tests with the local flag disabled). The
three prior cart gaps passed in focused checks; real Strict Mode dialog cleanup and
pre-hydration image-error handling repaired. Final local preview start was rejected
by automatic approval review, reason only "blocked by policy"; specific local-only
approval requested and pending. No bypass, push, deployment or database command.
See frontend/docs/BRAND_ASSETS_R2_REPORT.md and brand-assets-r2-coverage.json for
exact evidence, missing clean recaptures, platform limits and reused dependency
version discrepancy. Both live domains still dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD.
Other worktrees and unrelated edits preserved; broader Item 6 remains open.

26 October 2026 - mobile public support placement, P1 local correction. Live
Tyre Change detail at 320x640 reproduced the fixed support dock overlapping
31px of the handling-branch field during ordinary scrolling. This was a real
unfocused field obstruction, not a screenshot artifact. The shared narrow/short
viewport rule now presents Help and WhatsApp as an in-flow support strip after
the page content, retaining 48px-or-larger targets, safe-area padding and the
existing header Help route. Desktop floating controls remain as before. A
read-only browser style preview showed the field fully visible and the support
strip after the footer; no application record or message was submitted. The
exact local source passed frontend lint, typecheck, 1,057 units, optimized
build/postbuild and formatting. Exact hosted-candidate interaction, 390px,
short-landscape and adjacent-page checks remain before publication. Browser
plugin unavailable; installed Edge/Playwright provided the live baseline and
style preview. Prior rejected local preview startup was not retried.

27 October 2026 - hosted P1 acceptance for the same support correction.
Protected exact-source candidate dpl_3ipmjkYQNpcTMXqDnv9wgyEDm1QJ rendered
the real public Tyre Change detail using read-only public API data. Field hit
testing and zero obstruction passed at 320, 390, 768 and 900x400 coarse-pointer;
1024 retained its desktop control without intercepting the field. The mobile
support actions remain reachable below the footer and Ask Allie opens/closes.
Home/About/Services brand artwork, keyboard and failure states passed 21 of 22
hosted cases; the final 720px reflow check passed after replacing an inaccurate
CSS-zoom emulation. Five of six earlier pending cases passed; Review Cart is
launch-restricted and keeps its earlier isolated full-mode fixture evidence.
No form submission, real customer data mutation or production frontend release.
Actual device/browser zoom, screen reader and live authenticated-role checks
remain open. The next P1 review is public enquiry draft/account switching and
uncertain-submit recovery, already identified in release-blockers.md.

27 October 2026 - the brand/support batch is deployed. Final frontend source
8433ff57, Vercel dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ READY on both apex/www;
the previous dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD is retained for rollback.
Locked frontend/secret CI passed. Seven read-only production routes at sampled
320/390/1440 widths passed title/H1, page-error, overflow, logo and action
checks. Tyre Change selector hit-testing passed at 320px and Allie opened and
closed. Backend stayed ACTIVE and unchanged; no form, customer or payment
submission occurred. Exact proof and remaining physical-device, actual zoom,
screen-reader and role acceptance limits are in BRAND_ASSETS_R2_REPORT.md.
The next P1 item was revalidated against the exact released source on 27 October:
public enquiry and complaint forms already clear private fields, review and receipt
on account invalidation while retaining the duplicate-prevention lock for an
uncertain anonymous send. Ten existing browser cases cover both request kinds at
draft, review, pending, unknown and completed stages; another covers validation
racing invalidation. The production deployment `dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ`
was re-inspected on both domains. No application change or repeat test run was
needed for this resolved item. Next independent P1 review: wider public forms,
actual mobile keyboard/text enlargement and measured performance, reproducing a
specific defect before editing. Real API and cross-device acceptance remain open.

27 October 2026 - About mobile hero layout shift, P2. Fresh read-only Edge
contexts at 390x844 reproduced the same CLS contribution, 0.0832804 in three
loads. Layout-shift attribution showed the second hero CTA moving to a new row
when the approved Quicksand font loaded, pushing the campaign artwork down
57.09px. Five other sampled public routes had no comparable shift; those
single-run lab samples are not field Core Web Vitals. The scoped CSS change
stacks the two CTAs through 480px, so fallback and final font geometries agree.
An optimized local build passed TypeScript and packaging. Three fresh 390px
candidate loads measured CLS about 0.0000056 each. At 320, 414, 480, 481,
768, 1024 and 1440px, the About page had no horizontal overflow or page
exceptions; sampled 320/390/481/1440 Axe scans had no violations and the
campaign image loaded. The local reused Next installation is 16.3.8 while the
project requests 16.4.3, so locked CI and an exact-version hosted candidate
remain required before release. The local preview's unrelated authentication
proxy aimed at absent localhost:5000; no account or API mutation was tested.

Production follow-up: exact frontend source `8fa386cba46836adfaf43d8529b985c83c47255a`
passed locked frontend CI and the secret guard, then deployed as Vercel
`dpl_6wmkNSL8eWDvHKKmqafU6rkb9C5k` READY. Independent apex and www
inspection resolved to that ID; the previous `dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ`
remains a rollback candidate. A protected exact-source preview first measured
zero or about 0.0000056 CLS at 390px. On the live apex, three fresh 390px
About loads each measured 0.0000056. About at 320/481/1440 and Home, Contact
and Help at 390 returned 200, with titles/headings, no page errors or overflow.
The About campaign artwork loaded; its Services/Contact CTAs kept valid
destinations and the sampled 390px Axe scan reported no violations. API
mutations were blocked and none attempted. Backend readiness remained 200;
no backend image, schema, payment, provider or business record changed.
This is sampled lab/browser evidence, not a field Core Web Vitals claim or
physical-device/complete screen-reader acceptance.

27 October 2026 - read-only Contact enlarged-root-text sampling. Browser plugin
was unavailable; installed Edge/Playwright inspected live `/contact` at
320, 390 and 1440 CSS pixels with a 200% root-font-size override. The page
identified correctly, had a meaningful heading, no document overflow or page
exceptions, and the form controls stayed within each viewport. At 390px the
public branch loaded as Allied AutoTech - Port Harcourt, a synthetic reserved-
domain draft opened the local review dialog, and its subject/message/branch were
readable without overflow. All API mutations were blocked; Send was not clicked.
Screenshots are retained outside the repo under `%TEMP%/aat-contact-text-200-*`.
Aborted About/Help prefetches occurred during navigation; there were no failed
form-data requests. This is a CSS root-size simulation, not actual browser zoom,
mobile keyboard, screen-reader or production submission acceptance. No Contact
defect was confirmed or code changed. Existing product/service/vehicle account-
change source and focused rendered-test coverage were inspected, not rerun; the old
release-blockers bullet claiming that reset was still unimplemented is superseded.

27 October 2026 - visual identity audit candidate on feat/visual-identity-audit-20261027.
All V01-V55 findings from the owner audit are retained in VISUAL_IDENTITY_AUDIT_CHECKPOINT.md.
Initial fixes cover the overview/Care CSS collision, availability truth, reply focus,
reference/message density, authoritative unread counts, reviewed homepage help,
practice instructions, Privacy/numeric type, footer destinations and customer wording.
Backend session labels have isolated pure-unit evidence; no backend release yet.
Homepage follow-up bounds the intact campaign, compacts sparse product/review states,
removes duplicate vehicle promotion and uses the existing black/red gradient.
Latest full unit run 1070 passed; two additional Home behavior tests passed separately.
Four isolated actual-component Home Edge cases passed at 360/390/768/1440; earlier
8 booking-card cases passed, with a later browser-close timeout followed by a successful sequential 8/8 rerun.
Full Next journeys, exact-lock CI, remaining audit findings and actual-role/device
acceptance remain open. Candidate is not yet published. See checkpoint for precise
evidence, dependencies, local-preview restriction and preserved unrelated work.

27 October 2026 - visual-audit frontend batch released. Runtime a1b8ce45 preserves
concurrent Contact/location source 42855c0d and publishes customer clarity and sparse
Home fixes. Vercel dpl_GKfQv1k4cD5qTKZj3c6LaP8Y4iqz READY on both domains.
Exact locked frontend CI 40478325501: 1072 units, lint/types/format/build and zero
production audit vulnerabilities; secret guard 40478325469 passed. Same backend
source at e925ecec passed isolated safety CI 40476605252. Hosted fixture acceptance
7 new plus 35 regressions passed; 14 candidate and 14 production public read-only
checks passed at 390/1440 with zero mutations/page exceptions. Backend remains
79d7a0ac-4e83-4b73-ae46-40af4731a604 ACTIVE/readiness200. No DB/worker/provider write.
Session-label and new homepage-help backend changes remain committed, not released.
Full V01-V55 goal remains active; next Shop discovery/detail and empty overview.
Evidence/rollback: backend/docs/visual-audit-frontend-production-20261027.md and
frontend/docs/VISUAL_IDENTITY_AUDIT_CHECKPOINT.md. Existing other-task edits preserved.

27 October 2026 - Contact visit-preference validation, P1. The released
`8fa386cb` source sent every visit-preference error to the date field and marked
both date and time invalid, even when time or the message needed correction.
Runtime `317b1678` targets and announces the actual date, time or message field,
clears stale feedback when edited, and keeps the request subject to staff
confirmation. Eleven focused units, six Edge Contact scenarios (including
320/390/1440px), TypeScript, changed-file lint/format and an optimized Next
16.4.3 build passed. The local build used a junction to matching installed
dependencies, so standalone tracing warned about paths outside the worktree;
the exact-source locked frontend CI `40472135463` and secret guard `40472135440`
passed independently. Vercel `dpl_24sXMLFwUuX6ag8PqMTtGaVH2xPh` is READY on
both apex and www. Live Edge at 390/1440px used the published Tyre Change
service and confirmed field focus, `aria-invalid`, visible error text and zero
API writes. API readiness returned 200. No backend, schema, provider, payment,
customer record or business policy changed. Other authenticated journeys,
physical devices and complete screen-reader acceptance remain open.

27 October 2026 - Shared viewport and support UX, P1/P2. The owner explicitly
requested a fixed mobile Ask Allie/Whatsapp dock, no visible Allie scrollbar,
breadcrumb-first page entry and scrolling to linked controls/selection targets.
The mobile rule had changed the dock to position: static. It now stays fixed
above the safe area with reserved document space and focus clearance. Allie
keeps a fixed header/close action and a separate scrollable body with hidden
scrollbar styling; scrolling and keyboard access remain available.

ViewportNavigation is mounted once in the shared root layout. New pathname
entries reveal breadcrumbs (or main content when none exist); explicit hashes
reveal their targets. Same-page hash links, linked buttons/tabs, selectors and
checked controls reveal visible aria-controls/data-scroll-target destinations.
Ordinary controls remain visible. Contact enquiry type, vehicle-intent radios,
visit preferences and Allie responses identify their actual target fields.
Keyboard focus stays clear of the header and support dock. Pointer activation
finishes before scrolling; validation/dialog focus takes precedence, pending
entry adjustments cancel on fresh user input, and optional learning walkthroughs
retain their own focus. A duplicate legacy support focus handler was removed.

The first fixture run rejected an invalid synthetic learning href and incomplete
API envelopes; fixtures were corrected without weakening production validation.
Subsequent checks caught pointer-focus scrolling cancelling a checkbox click;
that defect was fixed and the picker/validation/review regressions passed.
Reload acceptance checks actual hash visibility below the header, allowing native
browser focus restoration. Browser plugin not available; existing Playwright/Edge
was reused with intercepted synthetic API responses and no real writes. Final
14-case browser matrix passed: 320x568, 390x844, 768x900, 844x390, 1024x900 and
1440x900 support/modal tests with axe scans; 390/1440 page entry, repeated anchors,
hash/reload, selection, checkbox and radio journeys; and four adjacent Contact
validation, review/confirmation and pointer-picker regressions. No horizontal
overflow or page errors were observed. Screenshots: %TEMP%/allied-allie-viewport-
390.png and matching 1440.png. Native keyboard, physical devices, screen readers
and exhaustive authenticated-role combinations remain unverified.

27 October 2026 - P1 public Parts detail enquiry copy. On the live 390px page,
the only listed oil filter had no branch availability, yet the detail said to
arrange collection from a listed branch and repeatedly described ordering.
The candidate is based on the current fbb6565a frontend release and uses the
existing launch-mode gate to require staff confirmation of stock and collection
arrangements before visiting. Full-commerce wording remains separate. Price,
availability, fitment and the product-specific enquiry destination are unchanged.
An optimized Next 16.4.3 build, scoped lint and hosted CI passed before this
rebase; a rendered 390px detail showed the revised wording, product enquiry link, no
overflow and no page exception. A protected preview built, but its dynamic
product route returned 503 because the preview environment lacks BACKEND_ORIGIN;
that is a preview configuration gap, not hosted journey acceptance. Desktop and
exact-source CI and production verification remain pending. No customer form or financial action was
submitted.

### Historical 26 October Allie visual checkpoint

This earlier visual checkpoint is retained as evidence. Its AI deferral wording
is superseded by Revision 4 and the later W6-W15 implementation records.

## Cycle 15 - Help, Help & Learn and Allie - 26 October 2026

Bounded owner-requested refinement, runtime candidate aa54fba8, branch
feat/help-allie-20261026 in allied-shop-vehicles-r2-20261025. Help's bare learning
link is now a branded card; /learn has three visible modes, all-kind eligible search,
plain task/source presentation and query/mode-preserving navigation. Allie uses a
small native SVG and compact content-based panel/sheet with approved answers,
source/actions/unknown fallback; no provider, record lookup or action tool. Actual
role/context eligibility and in-memory practice boundaries remain authoritative.
Reproduced oil-filter search progression timing failure and repaired refresh/remount
readiness. Busy/missing/written/paused states explain themselves; live guides are
non-modal and do not fill/submit. Practice uses a single sticky mode signal,
editable sample care replies, honest hints and specific feedback. Dedicated practice
pages suppress floating support controls after actual mobile overlap review.

Evidence: 1,039 frontend tests; seven actual authenticated API cases, 71-migration
fresh isolated replay/db:check and runtime privilege checks; lint/types/build,
OpenAPI/types/424 operations. All three exact-runtime CI workflows passed. Real
isolated API/compiled Edge acceptance: 29/29 baseline plus six final-polish rechecks,
Help/hub/Allie at 360/390/768/1024/1440 and practice at 320/390/768/1440; scoped Axe,
keyboard/focus/Escape, reduced-motion/logical reflow, denied/private/unknown/error,
identity clearing, actual 30-second guide refresh and node replacement. Practice
network assertions observe no business writes or external traffic; form drafts and
practice inputs remain separate. No new production publication or real business write.

Full criteria, design-reference comparison, screenshot index, CI links and precise
limits: [Allie checkpoint](../../docs/help-learn/ALLIE_IMPLEMENTATION.md).
Local screenshots: %TEMP%/allied-allie-20261026/. Installed Edge/Next 16.3.8 local
rendering is distinct from locked Next 16.4.3 CI. Physical devices/native keyboards/
zoom, full screen-reader and actual authenticated production-role acceptance remain
open. Existing launch/policy/permission constraints, other worktrees and unrelated
Home/dashboard scope are preserved. Site-completion Item 6 remains open.

## Shop publication checkpoint - 28 October 2026

28 October 2026 - Shop visual-audit frontend released. Runtime 552ee418,
Vercel dpl_79uCiatbRsCvM2jtPJkwsx53efpP READY on both apex/www after promotion
and 14 live public checks. Preserves 9f9311cf collection guidance and fbb6565a
mobile navigation. Locked frontend CI 40673723280: 1072 units plus build/types/
lint/format passed; secret guard 40673723234 passed. Eight final hosted Shop/
product cases passed; ten retained-navigation cases passed on earlier candidate.
Backend 79d7a0ac unchanged, ACTIVE/readiness200. No local/shared DB test or write.
V20 initial mobile spacing and V23 wider vocabulary remain partial; full V01-V55
goal remains active. Evidence/limitations/rollback and disk-preflight incident:
backend/docs/shop-audit-production-20261028.md. Other tasks/dirty work preserved.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/compatibility-release-20261025; it is not a claim of current production identity.

Release source `313c4f9c` passed exact-source frontend CI. Production-configured
Vercel `dpl_GDqL1pgfFbWtb7avvNGGW8Zu3bNH` is READY on both main and www aliases,
after the matching API became ACTIVE on `634b9110-8ad0-455e-ad7d-48cd9ee35681`.
Protected candidate Home, Help, Parts and admin routes responded successfully.
The final three browser-isolated editor cases passed on the actual main domain:
320px write-time conflict/draft reload, safe failed-read retry, and mobile
layout/automated accessibility. All requests that could write were intercepted
inside the browser; this does not claim an authenticated operator test or
production data change. Public Home/Help/Parts responded 200 after promotion,
`/shop` resolved to `/parts`, and `/demo` remained 404. Wider role/device and
manual screen-reader acceptance remain in the prioritized backlog.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/parts-enquiry-copy-current-20261028; it is not a claim of current production identity.

28 October 2026 - P1 public Parts detail enquiry copy released. The only live
oil filter had no branch availability, yet its detail told visitors to arrange
collection from a listed branch and repeatedly described ordering. Runtime
9f9311cf builds on fbb6565a and uses the existing launch-mode gate to require
staff confirmation of stock and collection arrangements before visiting.
Full-commerce wording remains separate. Price, availability, fitment and the
product-specific enquiry destination are unchanged. Exact-source frontend CI
40668317540 and secret guard 40668317916 passed. A preview without
BACKEND_ORIGIN returned 503 on dynamic detail; the protected production-target
deployment returned the corrected page, then was promoted as
dpl_68bNV74wNajB9vW1Ly85nzmmdEvU. Both apex and www serve that ID. Live Edge
at 390/1440px passed product-detail heading, corrected copy, collection FAQ,
product-specific Contact navigation, no horizontal overflow and no page errors.
No customer form, payment or inventory action was submitted. Native devices,
screen readers and authenticated-role acceptance remain outside this check.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/customer-vehicle-payment-filter-20261027; it is not a claim of current production identity.

27 October 2026 - P1 vehicle-payment history on purchase detail. The verified
customer list API candidate filters by the owned vehicle transaction before
pagination, and the purchase panel requests that target and rejects a mismatched
row or incomplete history. This prevents unrelated account history from exhausting
the client scan; source payment locks and eligibility remain authoritative.
Six focused Edge/Playwright fixture cases passed on the locally compiled page:
later-page unresolved requests, wrong-target data, failed fetch and repeated cursor.
The first run used a blocked Next development origin and was not counted; the
successful run used localhost. Frontend typecheck, scoped ESLint/formatting and
exact-lock GitHub frontend release checks passed. A fresh isolated PostgreSQL
service test covered owner/target/cursor boundaries. This is not a full-page
accessibility or real production-role acceptance. The backend and frontend must
release in that order; no production deployment or financial transaction was made.
Evidence and provider-access limit: backend/docs/customer-vehicle-payment-filter-20261027.md.

27 October 2026 - Contact visit-preference validation, P1 local correction. At
`/contact` with an anonymous service enquiry, a future date and missing time,
the rendered form focused and marked the already completed date field. Entering
the time left the shared error visible until another review. A 4,000-character
message plus visit details also focused the date rather than the message. The
shared SERVICE/VEHICLE preference validator now identifies the field that needs
correction; the form marks it, connects its error description, focuses it and
clears stale feedback on editing. Both visible preference fields expose their
required state. Review still creates no booking, hold or payment. Eleven focused
unit cases, frontend typecheck, scoped lint/format and `git diff --check` passed.
Read-only isolated Edge/Playwright CLI interaction confirmed the before/after
missing-time focus and correction, message-overflow focus, valid review dialog,
and no overflow at 320px. The local API responses were fixtures; no POST was
sent. Exact-source locked Next 16.4.3 frontend release CI 40448703220 and
redacted secret guard 40448703167 passed for runtime c54ef088; the reused local
Next installation is 16.3.8. Hosted acceptance, wider public forms, physical
keyboard/screen-reader checks and full site completion remain open.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/parts-enquiry-copy-20261027; it is not a claim of current production identity.

27 October 2026 - P1 public Parts detail enquiry copy. On the live 390px page,
the only listed oil filter had no branch availability, yet the detail said to
arrange collection from a listed branch and repeatedly described ordering.
The bounded candidate, rebased onto exact live frontend source a1b8ce45,
uses the existing launch-mode gate to ask visitors to confirm stock and
collection arrangements before visiting. Full-commerce wording remains separate.
The product's price, availability, fitment and enquiry destination are unchanged.
An optimized Next 16.4.3 build and scoped lint passed; a rendered 390px detail
showed the revised wording, exact product enquiry link, no overflow and no page
exception. Desktop optimized/hosted acceptance and release verification remain
pending. No customer form or financial action was submitted.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

## Customer history and Saved items - bounded candidate, 28 October 2026

V41/V42: current care and load/retry status remain first. Customer-only Activity history uses a native keyboard-operable disclosure; date drafts remain mounted across closing/opening. Verified all-zero periods use one message instead of five metrics, a flat chart and repeated empty record panels. Existing records, date filtering, permissions and staff analytics remain available. The launch limitation is shorter and placed with historical records. Remaining current-care empty cards are outside this batch.

V52: a successfully loaded empty collection has one browse action. Loading/error states retain navigation and retry; populated collections retain the toolbar action. Labels say Favourite products/Browse Shop without changing API values, saved IDs or mutation contracts.

Acceptance: 12 focused units pass (including empty vs historical data, date draft retention, staff preservation and refresh/session behavior); types and scoped lint pass. Six hosted desktop/mobile history/Saved fixtures added for native keyboard disclosure/tabs, date changes, error recovery, one action, overflow and sampled Axe. These browser checks and exact-source cloud CI are pending; this candidate is not deployed. Existing dirty tracker/asset files and other worktrees remain untouched.

### Historical merged-branch checkpoint

The following dated observation is retained from fix/compatibility-concurrency-20261025; it is not a claim of current production identity.

The earlier hosted run passed 11/15 scenarios. It found phone overflow caused by
absolute assistive labels escaping the table's scroll containing block, and a
1366px filter-grid override. Both are fixed in source and await final compiled
acceptance. Earlier fixture envelope/ambiguous-selector failures were corrected;
they are not counted as product regressions. Final checks and release evidence
will follow; this checkpoint does not certify production rollout.

## Cycle 10: Product compatibility concurrent edits — 25 October 2026

Route `/admin/products`, administrator product detail editor. A second editor could
change a legacy compatibility between the first editor's freshness read and write.
The older draft could then overwrite the newer record. The editor now sends the
child's version for update and retirement; the API compares it inside the existing
product mutation lock and returns 409 before history or record mutation if stale.

The administrator response exposes the child version while public product data
retains its limited projection. Existing bare DELETE clients remain accepted during
the transition. When an older response lacks a version, the editor disables
edit/retire and asks for refresh. A rejected review disables repeat confirmation,
preserves the draft, refreshes the record and offers explicit reload. Including the
child version in the form draft key prevents reload from restoring obsolete values.

Nine isolated PostgreSQL integration tests passed using a new `_test` database on
127.0.0.1:55581 with a non-owning runtime role. Concurrent same-version writes
produced one success and one 409; history advanced once and stale retirement was
rejected. All 65 then-current migrations replayed without schema diff. Thirteen
local Edge/Playwright product-extras cases passed, including a 320px conflict,
draft recovery, no horizontal overflow and automated WCAG 2.2 AA rule checks. A
focused follow-up verified that a rejected confirmation cannot be resent. Frontend
and backend types, lint and builds passed on the pre-merge source. The integrated
source then passed a fresh 71-migration replay, restricted-role `db:check`, nine
focused backend integration cases, generated contracts, typecheck, lint and
optimized builds. Its rendered editor suite and hosted release checks remain open.
The mobile capture is `%TEMP%/allied-compatibility-conflict-mobile.png`.

These are isolated and fixture-rendered checks, not an authenticated production
editor session. Real device and screen-reader speech remain untested. The current
`browse_enquiries` restriction and genuine catalogue content requirements remain.
The next review should verify an authorised admin QA session on the matching
release and continue the per-page operations backlog.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

28 October 2026 - Customer history and Saved items released. Runtime 0b5a9b76, Vercel dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno READY on both domains after 14 public checks. Preserves published Help/Allie/navigation 0d4dd992 and Shop 552ee418. Exact frontend CI 40680419648 passed 1074 units, lint/types/format/build and production audit; secret guard 40680419233 and isolated backend safety 40680419675 passed. Eighteen final hosted journeys plus two native keyboard/focus/hover cases passed. Backend 79d7a0ac unchanged, ACTIVE/readiness200; no local/shared database write. V42/V52 released with sampled evidence; V41 remains partial for current-care empty cards. Full V01-V55 goal stays active. Evidence, recovery, harness failure and limitations: backend/docs/customer-history-production-20261028.md. Other tasks and dirty files preserved.

## Owner-reported favourites refresh defect - 28 October 2026

P1: on the reported public Engine Oil Filter page, a confirmed save displayed Saved to favourites only until reload. ProductActions initialised a local false flag and never read the saved collection. Reproduced against live frontend 0b5a9b76 with an isolated customer/collection fixture: save succeeded, reload lost the saved label. An initial fixture envelope lacked its required message and was corrected before reproducing the actual failure.

Candidate reads the existing authenticated, uncached owned favourites API, following pagination until the product is found or absence is confirmed. It shows Checking favourites while reading and an explicit retry on failure; an incomplete read is never treated as unsaved. Product navigation resets the action instance; session changes cancel late reads. Successful saves still depend on matching server receipts and retain existing CSRF/role/mutation guards. No browser storage substitute, API/schema change or customer-data mutation is introduced. A pathological repeated cursor or more than 100 pages fails safely with retry, rather than making an unsupported unsaved claim.

35 focused units passed across saved-state persistence, later pages, removal, failure/retry, product/account changes, account mutation and launch gates. Hosted desktop/mobile refresh acceptance and exact-source CI are next. Current-care/notification presentation investigations are deferred while this owner-reported failure is repaired. Wider V01-V55 goal remains active.

28 October 2026 - Owner-reported product favourites refresh defect released. Runtime ef06efb7, Vercel dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv READY on both domains after 14 production public checks. Product detail now reads persisted favourites with pagination and explicit loading/error/retry states. Final CI 40704788016 passed 1080 tests, lint/types/format/build and zero production audit vulnerabilities; secret guard 40704788037 and isolated backend safety 40704788003 passed. Sixteen hosted fixture cases passed, including save-refresh/removal/retry at 390/1440 and retained focus/navbar behavior. Concurrent published sources 09efa694 and 4aafaebb are preserved. Backend independently advanced to 8fd37e1c (image 4fbc9cbb), ACTIVE/readiness200 with the favourites API unchanged; this task made no backend/database write. Evidence and precise limits: backend/docs/favourite-refresh-production-20261028.md. Wider V01-V55 goal stays active; next current-care empty-card and notification-availability clarity work. Existing dirty files and other worktrees preserved.

## Current-care density candidate - 28 October 2026

V41: render recorded current service, garage vehicle, next booking, quotation/payment, order, inspection and update summaries only when present. A verified fully empty response has one concise starting point and the existing garage/support actions; the header retains the single service-visit action. Vehicle-only summaries use a white surface and do not imply work is in progress. Grids adapt to the number of populated sections; current service timelines, exact money, requested-time labels, account ownership and launch-restricted links remain unchanged. History/date drafts and error/loading/session handling stay in the existing parent.

Ten new component cases and twelve overview/history/launch regression cases pass; types and scoped lint pass. New full-route acceptance covers compact empty states at 360/390/768/1440, keyboard focus plus hover, real garage navigation, single-record combinations, populated summaries and sampled Axe. Rendered acceptance and final-source CI remain pending. The first browser preflight correctly stopped at 19.3 GiB free; no browser/build/upload ran then. Source-only edits and small no-cache component checks continued; later free space recovered independently above 25 GiB and browser verification resumed after a passing preflight. No cleanup or database writes ran. V48 notification availability remains the next bounded batch; this candidate does not complete the whole visual audit.

28 October 2026 - Compact customer-care release completed. Runtime 73436a31, Vercel dpl_J3Yv5aJwRGrzwZe6fiUPyeNdd81t READY on both domains after 14 public production checks. Empty care is compact; recorded cards, history drafts, permissions and error/session boundaries remain intact. Preserves published Help/Learn 072e0509, notification preview 1a33815c and favourites ef06efb7. Final-source CI 40715112526 passed 1092 tests plus types/lint/format/build and zero production audit findings; secret guard 40715112493 and isolated backend safety 40715112523 passed. Twenty-five final hosted dashboard/notification cases passed; ten unchanged-source learning cases passed on the preceding candidate. Two actual public homepage explanation cases passed at 390/1440 with three valid destinations, reviewed article, honest AI label and focus return. Initial extra-test heading expectation was corrected to the actual summary-then-topic sequence, without runtime changes. V41 density/V04 public explanation have released sampled evidence; full V01-V55 remains active. Backend 8fd37e1c unchanged by this task, ACTIVE/readiness200. No shared DB/customer writes. Evidence, rollback, disk interruptions and limitations: backend/docs/customer-care-density-production-20261028.md. V48 notification preference/channel distinction is next; preserve other worktrees.

## 28 October 2026 - V48 delivery preference clarity candidate

Reproduced the live 390px SMS row showing a prominent On state beside unavailable delivery using isolated account fixtures. The actual settings now distinguish Default/Saved/Last known preference from Service enabled, Delivery unavailable and Availability unknown. Missing or stale channel data never implies sending is available. Marketing consent, versioned writes, explicit recovery and account guards remain unchanged; policy and delivery feature flags are not changed. Shared details explain required messages and valid contact details without repeating future-marketing paragraphs in every row. Both preference consumers use the same availability contract.

12 new contract/render cases plus 29 adjacent notification/recovery cases passed (41 total). TypeScript noEmit and scoped lint passed. Nine hosted role/viewport/state cases were added; the initial live baseline failed at the expected old label and retained its screenshot. An initial harness configuration error (string grep) was corrected to RegExp before that baseline ran. Actual candidate browser checks, exact master CI and production promotion remain pending. Current published source a51a58b8 and later master release records are integrated. Existing dirty tracker/asset records and the active master backend work are preserved. No learning target, permission, backend API, schema or approved delivery policy changed; no learning definition needs a new version for this presentation-only batch. Full V01-V55 scope remains active.

28 October 2026 - V48 delivery preference availability released on master runtime 2725efea, Vercel dpl_Ch3kcHTq565fAMKne6hFT8NPKw7R verified on both domains. Default/saved choices, unavailable delivery and unknown/stale availability are distinct. Final exact CI: 1216 tests passed, 12 optional cases skipped, production audit zero vulnerabilities; frontend 40768336402, isolated backend safety 40768406734 and secret guard 40768336321 all passed. Thirty final hosted notification/permission/recovery cases and 14 candidate plus 14 production public checks passed. An initial refresh test assumption was corrected to verify explicit and background refresh separately; runtime code was unchanged. Published consolidated a51a58b8 and all prior favourites/care/learning improvements are preserved. Backend 3ee6748f remains ACTIVE/readiness200 and unchanged by this task. Master integrations preserved all concurrent source and generated-contract hashes. No shared DB/customer/message writes; actual delivery and private-account/device acceptance remain unverified. Evidence and limitations: backend/docs/notification-preference-availability-production-20261028.md. Full V01-V55 goal remains active; continue the remaining visual, typography and navigation ledger items.

## 28 October 2026 - V53/V55 customer guidance candidate

Garage entry now keeps basic make/model/year entry separate from a native optional Shop-search disclosure. Existing linked vehicles and the dedicated Set up parts search action open the setup directly. Selection labels explain that available search choices update the basic names but do not prove fitment; missing choices can be skipped. Validation reopens the disclosure before focusing its missing field. Turning setup off and back on preserves its specification draft; saving with it off still explicitly removes the link under the existing payload contract.

Privacy guidance now explains request, authorised review and the separate execution boundary, with a real Customer Care follow-up destination. Approved-pending-policy records state that no data change is scheduled. Source authority: PrivacyRouter review/holds checks, retention-and-privacy.md, retention-policy-workspace.md and the disabled retention worker. An execution procedure is not currently implemented or authorised by this batch; no automatic deletion, deadline, new permission or operational policy is invented. Existing learning content already states the same boundary; no guide target or workflow contract changes.

Two isolated live 390px baselines failed at the expected previous interface and retained screenshots. Local TypeScript noEmit, scoped lint and formatting passed. Six new rendered acceptance cases and existing garage/fitment/privacy regressions are prepared; hosted checks, exact master CI and promotion are pending. Current published fitment source 8d2dfd69 has been incorporated. The active public-copy worktree and all unrelated edits remain preserved. Full V01-V55 scope remains active.

## 28 October 2026 vehicle condition and owner-draft cycle

- Preserve current live 55714afd and master garage/privacy guidance; use existing
  stock, listing, managed media, Customer Care, permissions and workforce boundary.
- Add attributed owner condition/issues with correction audit, engine code/cylinders,
  crossover/minivan, actual branch-location discovery, saved-content preview and
  photo-before-publication validation. Unknown owner facts stay unknown.
- Private BMW preparation uses seven actual reviewed views; plate masks are limited
  to identifier pixels. No stock/listing published or production enquiry submitted.
- Isolated persistence, denied access, CAS, publication/media race, search and enquiry
  regression checks pass. Ten distinct mocked rendered cases cover public card/detail,
  home, filters, missing photos, authoring import, preview/correction and Axe.
  Exact-master CI, production rollout and hosted acceptance remain pending.
- Backend handoff and requirement matrix:
  `backend/docs/vehicle-marketplace-implementation-20261028.md`.
- Real-role, physical-device and independent vehicle-condition acceptance remain
  unverified. Public VIN search remains a privacy/business decision.
