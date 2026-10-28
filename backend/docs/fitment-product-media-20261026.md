# Fitment and product media implementation - 26 October 2026

Candidate branch: `feat/fitment-media-20261026`, reused
`C:/Users/PC/.codex/worktrees/allied-home-restoration-20261025` from recorded
production source `76377d43`. The initial read-only provider check confirmed backend
`98401193-fb85-48d9-8c51-462dcadd6d19` ACTIVE. This is a local candidate, not a
production release. Other worktrees, the pending staff-revision correction, Help
work, customer-table correction and the main checkout's dirty tracker are preserved.

## Reproduction and correctness

The actual previous component was rendered with an isolated Toyota/Camry legacy
rule: its detail displayed the association, while both editor controls were blank.
An unchanged review was blocked before any API write. This established a UI mapping
problem, not proven production data loss. The backend includes the catalogue relation
when a normalized foreign key exists; legacy make/model strings are independent
of that relation. No safe automatic mapping can be inferred from names alone.

The editor now retains the saved labels and explicitly requires exact catalogue
reconciliation for an unmapped legacy rule. It never fabricates an ID or erases
an unchanged association. Current normalized relations initialize immediately;
a saved ID without an expanded relation hydrates by ID, independently of the first
suggestion page. Failures remain distinct from empty choices. Late responses cannot
replace a deliberate selection. Selection drafts are owner/product/rule/version
bound and excluded from generic display-string restoration. Session invalidation
clears the active selection draft. Failed reads and stale versions block saving.

A background/manual refetch preserves the active editor snapshot. If its saved
version changes, the draft stays visible and cannot overwrite the newer version.
Changing product resets context deliberately. Product/rule mismatches expose no
mutation action. The normal save still demotes an edited rule to Draft, increments
its actual version (including version 0), and preserves independent-review rules.

## Fitment workflow

- Compact Vehicle compatibility workspace; product selection, review queue and
  catalogue maintenance have distinct destinations. Product result rows have real
  targets and visible focus. List counts remain page counts.
- Focused editor replaces the long read-only detail while editing. Application,
  paired model years, restrictions, evidence and review are grouped in task order.
- Evidence readiness is separate from approval. Missing model identity, years,
  source, coverage and existing critical requirements are prominent. Missing years
  never become unrestricted coverage. Detail shows recorded/required restrictions;
  secondary unknown fields and audit metadata use disclosures. Immutable history
  refreshes after each decision.
- Relevant qualifiers are prioritized; populated or required advanced fields stay
  prominent. All remaining fields remain mounted in disclosures, so saving does not
  silently erase them. Required-customer-detail checkboxes have contextual names.
- Explicit recorded non-critical types mirror the server policy. New `OIL_FILTER`
  rules can use permitted non-critical scope; saved safety settings are preserved.
  Product names such as "Engine Oil Filter" are never guessed into a policy type.
  Unknown/critical types retain authoritative safety requirements. No production
  product type, evidence, compatibility fact, role or approval was changed.
- Catalogue search precedes creation, models depend on make, and supported years
  remain paired with a required source. Existing server duplicate/conflict handling,
  branch scope, reviewer independence, transitions, reasons and history are retained.

## Product Images and Compatibility

Old `/admin/products?media=<id>` links open Images; `tab=compatibility` selects
Compatibility. Details and return links retain list filters. Invalid tab/context
is rejected. Both tasks retain product name, SKU and actual publication context.
Legacy associations remain unreviewed and lead to the separate technical-review
workspace; there is no automatic approval or deletion of legacy identities.

Images has a saved gallery, previews and enlargement with Escape/focus restoration,
optional alt text, human display order, keyboard move controls, explicit main
selection, review-before-write and actual saved/refreshed outcomes. Exact gallery
moves are atomic even for tied legacy positions. The old zero-based API field is
unchanged; human order converts once at the boundary. Main selection is independent
of order. First attachment does not auto-select main; clearing/removing main does
not auto-select a replacement.

File selection/local preview, prepare/upload, placement/description, review and
confirmed attachment remain separate. Failed preparation retains metadata; deliberate
same-file selection works; duplicate confirmation remains guarded. Expired prepared
tickets require another upload. The UI states the actual JPEG/PNG/WebP, animation,
10 MiB, 32-8192px, 40-million-pixel and output-size constraints. Server decoding,
checksum, metadata stripping, ownership, ticket expiry, product version, storage
permissions and cleanup safeguards remain authoritative. Cancellation never deletes
an arbitrary/shared stored object. Image removal queues only eligible owned assets.

Verified gap fixed: hosted-URL writes previously checked HTTPS and credentials only.
Client/server now reject literal IP/private-local hosts, nonstandard ports, fragments
and common signed/expiring query parameters. This is lexical validation, not proof
that an arbitrary hostname is publicly accessible. No remote image proxy or DNS
fetch was added. Existing host allowlists still control display. Existing saved
URLs were not rewritten or deleted.

## Compatible backend contract

`POST /admin/catalog/products/{productId}/images/reorder` requires authenticated
ADMIN/SUPER_ADMIN, verified MFA, CSRF, `expectedVersion` and a unique complete
`imageIds` permutation. Under the shared product advisory/row lock it verifies exact
membership/version, changes all zero-based positions together, increments mediaVersion
once and records the ordered IDs in audit. Cross-product, incomplete and stale orders
fail without changes. Main flags and media assets are untouched. Up to 100 IDs are
accepted; ordinary galleries retain their existing 12-image limit. Existing CRUD
contracts and old galleries remain readable/editable/removable. Deploy the compatible
backend before a frontend using the new move controls. No schema migration is needed.
OpenAPI, handbook and generated frontend types are updated.

## Evidence and acceptance

Browser plugin was unavailable; installed Edge and repository Playwright were used.
All browser fixture records are explicitly synthetic, never production listings.
Before captures render the actual six previous files from `76377d43`; candidate
files were backed up, hash-checked and restored immediately. No repository reset or
whole-commit revert was used. Desktop/mobile captures are retained under
`%TEMP%/allied-fitment-media-review-20261026/`.

Established checks:

- Fresh isolated native PostgreSQL target on verified loopback port 63888 and the
  designated private data directory; new `allied_fitment_media_20261026_*_ci`
  database, 71-migration empty replay, schema/history `db:check`, DML-only test role.
  No application/shared/production database writes, grant changes, restore or reset.
- 21 real integration cases passed across product media and fitment: normalized and
  legacy rules, branches/MFA/CSRF, author/last-editor independence, versioned history,
  public evidence/exclusions, byte validation, main selection, ordering and concurrency.
- Seven backend unit cases passed, including input permutation/URL boundaries and
  real PRODUCT decoding/dimension/10 MiB limits. OpenAPI: 356 paths, 416 documented
  operations match mounted routes. Backend types, lint and targeted format passed.
- Frontend full lint, types and optimized build/postbuild passed; 40 related unit
  cases passed across fitment, product forms/query contracts, gallery and draft tests.
  Installed verified Next is 16.3.8; lockfile requests 16.4.3. No dependency installation
  or lock change was made. Locked CI remains a separate release gate.
- Compiled browser fixtures cover legacy/current/late/failed hydration, unchanged
  and reconciled saves, snapshot conflicts, all review transitions/history,
  authorization failures, account invalidation, read/write failures, hosted URL
  validation, file prepare/retry, gallery ordering/main/preview and URL history.
  Widths: 360, 390, 768, 1024, 1440, plus existing 320px regression. Keyboard and
  scoped Axe checks are actual rendered checks, not full accessibility certification.
- The real API/browser case uploads actual PNG bytes into isolated memory storage,
  confirms and rereads persisted attachments, exercises atomic moves and main
  selection, reloads desktop/mobile, verifies public bytes, validates corrupt-byte
  failure without gallery mutation, and removes images with public reads returning 404. Production storage/messages/business records are never used.

Final browser counts and cleanup postflight are recorded below after verification.

## Remaining limits and dependencies

No production deployment, authenticated production-role acceptance, physical-device
keyboard, full screen-reader speech or real object-storage provider acceptance was
performed. The image-storage provider in the real API/browser case is a test adapter;
application API, validation, database persistence and public access rules are real.
Business must supply authentic images/evidence and reconcile actual unmapped records.
Unrecognized part-type policy cannot be changed by guessing from a product name.
No fictional inventory, compatibility evidence or public availability was published.

Native file selections cannot be restored after a full page reload; choose the file
again. Supported application controls confirm leaving an editor and typed drafts
remain scoped; browser Back/Forward/native permission UI and physical-device behaviour
are not a promise of universal draft recovery. Background permission loss discards
private views. No new production backup/PITR/restore rehearsal ran because this task
has no shared rollout. Site-completion Item 6 and broader operational acceptance stay
open. Home, dashboards outside these consumers, notifications and commerce capabilities
remain outside this change.

## Final checkpoint

Final compiled candidate: **36/36** fitment/product-media browser cases passed in
one run, followed by **12/12** adjacent garage-upload and product-workspace cases
(48/48 total). This includes deliberate/declined discard, clearing a dependent
catalogue selection through either make control, the real API image lifecycle and
422 responses for malformed/private/signed hosted URLs. The 1440px gallery case also
passed reduced-motion preference emulation and 720x450 logical reflow/keyboard checks
(an emulation of 200% desktop reflow, not native browser-zoom or device acceptance).
Native browser zoom, full motion inspection and screen-reader speech remain unverified.

Earlier dev runs exposed a stale history panel (fixed) and test-fixture defects:
incomplete response envelopes, old labels, and metadata updates that failed to retain
uploaded-image fields or sort like the server. These fixtures were corrected; actual
API persistence/order was verified separately. Final browser cases were run against
an optimized build, with no HMR/source replacement during rendering.

[Before/after screenshot index](C:/Users/PC/AppData/Local/Temp/allied-fitment-media-review-20261026/index.md):
fitment and Images at desktop/mobile, plus actual isolated API media captures.
The complete current five-width evidence is retained in
`%TEMP%/allied-fitment-media-final-verified/`; adjacent evidence is in
`%TEMP%/allied-fitment-media-adjacent/`. Isolated replay/integration logs and the
non-secret target receipt remain in `%TEMP%/allied-fitment-media-20261026-db/`.
Synthetic session tokens were removed after the owned API stopped.

Task frontend and test API listeners were stopped. Other tasks' servers and the
shared private PostgreSQL instance/data were retained. Docker context desktop-linux
was inspected; its daemon was unavailable. No Docker resource, dependency copy,
worktree or archive was created. Reviewed superseded browser outputs (54.78 MiB)
were deleted after copying the current comparison evidence. Current build/cache,
source, databases, backups and other tasks were preserved. C: postflight **29.88 GiB**
free at measurement; the 20 GiB reserve remains a preflight, not an OS guarantee.

No production deployment. This candidate requires normal locked CI, source/release
reconciliation and authorized backend-first rollout before production use.

Desktop gallery alignment follow-up: removed the inherited sibling-section margin
inside image cards. The optimized build/types/postbuild and focused lint/format
passed again; all five compiled populated-gallery cases passed, including a measured
same-top-edge assertion at 1440px and the existing keyboard/preview/reflow actions.
This CSS-only follow-up reruns five of the 48 distinct acceptance cases above; it is
not an additional five distinct journeys. Review Images screenshots were refreshed.
The owned preview was stopped again; no production operation occurred.

## Production release - 26 October 2026

Runtime **a28753ab20773b61e4c177f62f222691824c8bf7** is live:

- Frontend **dpl_CucTTefbZ71ApHiWsYA8P9JrPoH9**, READY; apex/www aliases independently verified.
- Backend **caeac741-805b-47a5-bb2d-d9e703cdff77**, ACTIVE, no pending rollout.
  All four digest-pinned images match the release manifest. Update-spec proposal
  passed; only the four image digests changed. Backend readiness preceded promotion.
- Locked backend, frontend and secret CI passed (40321414796, 40321414674,
  40321414795). Vercel built **Next.js 16.4.3**, resolving the local-version gap.
  Nine image/runtime contract cases passed, including non-root/TLS/native media.

Production read-only db:check passed before/after at **71 migrations**. Actual
host/port/database, strict TLS, separate identities, runtime non-ownership and
absence of administrative/schema CREATE/TRUNCATE privileges were verified.
Three checked notification/identity worker heartbeats were current without error.
Temporary exact-IP diagnostic access was removed; original app-only firewall
verified after both checks. The deployment's read-only predeploy database gate passed.
No migration, grant change, seed, production business DML, real upload/review/enquiry
or outbound message ran. Configuration, permissions and browse/enquiries stay intact.

Eight managed off-device backups were listed; newest **2026-10-26 05:22:11 UTC**.
Existing encryption/retention/PITR records and successful separate **2026-10-25
18:03:19 UTC** production-archive rehearsal reviewed: 89 original tables and ledger
preserved, forward rehearsal through migration 71 passed. No new restore or physical
managed PITR test ran during this release. This is reused recovery evidence.

Thirteen anonymous read-only Edge journeys passed at **390/1440px**: Home, reviews,
vehicles, fitment/product admin authentication redirects, /demo 404 and www reviews.
Home-to-Parts navigation, visible image loading, wrapping and overflow passed;
desktop/mobile captures inspected. No page runtime errors or attempted API writes.
Console resource errors were expected unauthenticated 401s and intentional /demo 404.
Browser plugin not available; repository Playwright with installed Edge used.
Evidence: %TEMP%/allied-fitment-media-production-20261026/receipt.json and PNGs;
ignored private provider/CI/health receipts use the fitment- prefix.

The CLI refreshed expired Vercel access. Initial registry authentication stopped
before a push; verified login and guarded retry passed. An initial health probe
used /health/live and stopped promotion on 404; the configured /api/v1/health/live
and /ready then passed. Domain promotion was paused until matching backend readiness.

**Still unverified:** authenticated production fitment saves, independent review,
actual object-storage uploads, physical devices, native zoom and full screen-reader
acceptance. Earlier isolated real API/database and compiled browser checks are
separate evidence. Business must supply authentic photos/evidence and explicitly
reconcile actual legacy rules. Broader site-completion Item 6 remains open.

Rollback retained: frontend dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u, backend
98401193-fb85-48d9-8c51-462dcadd6d19 and preceding customer-care resources.
Revert frontend before an API without reorder support. Preserve migration 71 and
a history-aware checker; never restore over live or downgrade its data for rollback.

Existing desktop-linux builder/cache reused; no new worktree/dependency install,
image archive, persistent test container or volume. Contract containers auto-removed.
All 13 existing containers, 14 volumes, current/rollback/pending/other-task images
and recent useful caches retained; no speculative pruning. Docker reported images
12.06 -> 12.14 GB and cache 7.316 -> 7.488 GB. C: postflight **29.82 GiB free**;
reserve checks are preflights, not a machine-wide quota. Pending Help/Learn,
customer-table and staff-revision work was not bundled.
