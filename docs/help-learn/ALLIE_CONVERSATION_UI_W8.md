# Revision 4 W8: conversation in the existing Allie panel

27 October 2026. Local `feat/allie-conversation-ui-20261027`, based on W7 `6cacdfda`,
reusing the same worktree/dependencies. No push, deployment, app-environment change,
real provider request or business submission. Full Revision 4 remains active.

## Implemented behaviour

The existing dialog offers **Ask Allie** and **Reviewed help** when the server
advertises configured, release-permitted AI. Conversation code loads on demand;
without that capability, reviewed search/topics/guides/practice remain available.
The catalogue `ai` contract is now boolean. It stays false unless reviewed help,
explicit AI/key/model/token-budget configuration and a permitted release are present.
Catalogue-only mode still blocks conversational writes. Defaults remain disabled.

Start and Send are explicit. Only question, registered page enum, expected version
and operation UUID leave the composer. There is no browser-stored transcript,
operational-form capture or client-owned history. Public/account clients use separate
namespaces, without failed authenticated writes falling back to public writes.
Account requests reuse existing CSRF/session invalidation; guest CSRF stays in memory.

Answers render plain text, steps, caveats, source versions and registered actions.
Current eligible catalogue metadata validates destinations/modes before rendering;
unsafe URLs, hidden/stale sources and work-to-public human actions fail closed.
Links do not forward questions or create support records. The panel disclosure and
website privacy notice explain OpenAI processing, imperfect secret screening,
encrypted transient conversation/turn receipts, the six-turn context window,
expiry/worker/backup distinctions and the limits of Clear/provider storage controls.

Stop aborts browser work and attempts persisted server cancellation; late packets
cannot replace a reconciled view. Unknown outcomes require checking current state
before a deliberate new turn; there is no automatic turn retry. Recent session
conversations resume explicitly. Clear has a review step. Unmount aborts requests;
access/source changes and expiry discard obsolete input/history. Focus, online and
pending-operation checks revalidate state. Close/refresh do not promise deletion.

Login/MFA/recovery and dashboard/work security paths suppress conversational input.
The auth layout still omits its floating launcher. The parent hides learning during
access checks and remounts the boundary when the eligible catalogue changes.
Rendered inspection removed a duplicated notice and compacted Refresh/Clear into
shared secondary controls. Existing brand/dialog, keyboard close/focus return,
source links and multiline composition remain; no animation was added.

## Actual verification

- Full frontend lint/types and **1,109 units / 167 files passed**. After final visual
  polish, **26 focused cases / three files**, changed-file lint and formatting
  passed. The new conversation unit file has 19 cases: explicit send, safe sources,
  no browser transcript, stop/late response, unknown-result checking, clear review,
  account isolation, context reset, unmount, security mapping and unsafe destinations.
- **16 distinct local Playwright cases passed** at `http://127.0.0.1:3167`, using
  installed Chromium, one worker and intercepted API fixtures. Browser plugin not
  available; no installation/profile copy. Widths **320/360/390/768/1024/1440**, plus
  a **390×844** follow-up/composer case. Public, Customer, Staff, Admin, Super Admin,
  source navigation, stop/late packet, unknown network outcome, quota fallback,
  access invalidation, default-off and auth-page absence passed. Tab/Enter/Escape,
  focus return and 360px reduced motion passed; Axe WCAG 2.2-tagged checks, overflow,
  relevant console/page errors and external-request assertions passed where applied.
- The first browser run passed 12/13: its remaining assertion expected a launcher
  on `/login`. Source/rendered evidence confirmed the intentional auth exclusion.
  The corrected full 15-case run passed; the added short-mobile follow-up case then
  passed. No auth redesign or bypass was introduced to satisfy a test.
- Screenshots saved outside Git and visually inspected:
  `%TEMP%\allied-allie-conversation-390.png`,
  `%TEMP%\allied-allie-conversation-1440.png`,
  `%TEMP%\allied-allie-composer-390.png`. They show isolated help fixtures, not live
  model answers or actual customer records.
- Final optimized webpack build/standalone preparation passed using **installed
  Next 16.3.8**; lockfile 16.4.3 exact-lock CI remains a release gate. Preview was
  stopped/restarted by verified process identity. The installed build cleaner
  explicitly preserves `dev` and `cache`; denied dev cleanup was not retried via build.
- **37 native HTTP/DB cases passed** on W7's verified synthetic CI target, including
  new AI capability/configuration/release checks. Existing ownership, MFA/CSRF,
  concurrent claim, cancellation, revocation/expiry, retention and workforce cases
  passed with provider mocked. `db:check` passed; no W8 schema/migration change.
  **60 provider/state units passed**; backend lint/types, OpenAPI **375 paths**,
  **439 documented + four infrastructure operations**, generated frontend API types
  and secret guard passed. A corrected export used inert test placeholders at
  loopback port 1, without a database connection.
- Repeated native campaigns exceeded the retention assertion's ten-row backlog
  assumption. Two deliberately ancient synthetic expiries now prove that one-row
  cleanup skips an older empty row, without a reset or runtime cleanup change.
  Final 37-case rerun passed. A further guest-lock/retention ordering scenario
  identified in review still needs targeted reproduction before exposure.
- Setup accepts trimmed `Yes`/`YES`. Explicit `-KeyFromClipboard` supports terminals
  unable to paste into masked input, with a copy-after-command pause to prevent the
  command replacing the copied key. Synthetic DPAPI, overwrite preservation,
  mixed-case and clipboard-sequence/stub checks passed without reading the real clipboard
  or calling a provider. No real key/configuration is recorded here.
- Coverage structure remains valid; **all 106 routes still await full acceptance**.
  Native receipts remain in `%TEMP%\allied-allie-state-20261027-db`; W7's 36-case
  receipt was retained separately as `allie-w7-final-36.log` before the W8 run.

## Remaining gates

Browser API interception and real HTTP/DB adapter mocks are separate evidence layers.
The real browser → isolated backend → configured-provider journey, >=100 reviewed
evaluation cases, bounded provider run, factual-support review and actual usage/
latency are not yet accepted. Malformed-provider browser behaviour, guest-lock
ordering, hosted cookie/proxy behaviour, replicas, actual role accounts, physical
devices/on-screen keyboards and full screen readers remain unverified here.

Finish workforce baseline/independent/history composition, all-route learning/mode
decisions, editable persisted canonical Customer Care handoff and human takeover/
availability/schedule/capacity/shared-transport-gated chat. Contact is not completed
handoff. The owner reports 60,000 TPM / 10 RPM, purchased credits and an enforced
US$1 project cap; key setup is guided separately. Those reports are not provider
requests/quality evidence and do not authorize public AI enablement or deployment.

C: postflight **26.40 GiB free**, above the 20 GiB reserve. No Docker resources,
worktrees, installs or duplicate profiles. Read-only inventory: desktop-linux,
87 images, 13 stopped containers, 14 volumes, 9.433 GB build cache; no pruning or
assumption that reclaimable resources are useless. Four approved obsolete dev
folders remain after W7's policy-blocked deletion. Newer unrelated release worktrees
were preserved; reconcile them and actual deployment before any publication.
