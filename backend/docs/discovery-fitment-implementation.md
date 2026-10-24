# Discovery and fitment implementation

Implementation branch: `feat/discovery-fitment-20261023`, in the dedicated
`allied-discovery-fitment-20261023` worktree. Base: merged release `8968a1a1`
plus the support-email rollout evidence from `952178f0`. Existing workspace
changes and release worktrees are preserved. No production deployment is in scope.

## Implementation sequence

1. Extend vehicle records, server filtering, contracts and public/staff controls:
   condition, final assembly country, distinct powertrain, existing specifications,
   validated ranges and stable pagination. Preserve unknown legacy values.
2. Extend the existing parts catalogue and compatibility records with normalized
   vehicle identity, explicit qualifiers, evidence, approval and immutable history.
   Build the customer parts finder and staff author/reviewer workflows together.
3. Reuse the customer garage for saved search configurations and the existing
   support enquiry flow for assistance. Keep collection-only fulfilment explicit.
4. Connect authorized notification targets to sidebar navigation, contextual arrival
   and recipient-scoped read acknowledgement after successful record rendering.
5. Update active branding copy; verify contracts, migration replay, database safety,
   permissions, unit/integration coverage and desktop/mobile browser behavior.

## Non-negotiable semantics

- `USED` remains unspecified used condition. It is never relabelled locally used.
- Manufacturing origin records final assembly country. Neither make nor import
  country supplies it. The country list uses ISO codes and UN M49 regions.
- Fuel, powertrain and drivetrain are independent; legacy hybrid does not imply
  plug-in hybrid. Missing specifications stay unknown.
- Make/model/year narrows fitment candidates; it does not prove fit. Public rules
  require approval, evidence and the applicable technical qualifiers. Explicit
  exclusions take precedence. Legacy compatibility rows start unreviewed.
- All catalogue eligibility filtering happens in PostgreSQL before pagination.
- Reading a notification never completes the underlying business task. Lists,
  failed loads and unrelated records must not acknowledge it.
- Migrations are forward and additive. Only newly created, verified isolated
  `_ci`/`_test` databases may be used for database verification.

## Verification evidence

Implementation and verification are in progress. Historical release test counts
are not evidence for this branch. Record actual commands and results here as each
layer is completed. No real customer data, production write or production rollout
is authorized by this implementation task.

Country reference: [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/),
retrieved 23 October 2026. The ISO Taiwan code is included independently of the
UN regional table. Frontend and backend ship the same reviewed reference snapshot.

### Vehicle layer evidence

- Prisma client generation and 63-migration empty replay passed on the verified
  private PostgreSQL 18 cluster at localhost:63888. Schema comparison and
  `db:check` passed. Subsequent fitment migration work requires a new full replay.
- Vehicle discovery plus missing-column guard integration: 15 passed. This covers
  all seven sort orders, ties, null mileage last, exact counts, signed cursor
  binding, 10,000 synthetic listings, assembly regions, condition and powertrain.
- Frontend full unit suite: 145 files, 969 tests passed after the vehicle changes.
  Both TypeScript projects and targeted vehicle lint passed at that checkpoint.
- New Playwright desktop (1440px) and mobile (390px) workflows passed, with no page
  errors, horizontal overflow or axe violations in the filter panel. Validation,
  focus, assembly shortcuts, powertrain, ranges, sorting and back/forward checked.
  Screenshots are in the temporary Playwright output directory, outside the repo.
  Browser-plugin tools were unavailable; the existing Playwright/Edge setup was used.
- A mid-interaction full-page screenshot disturbed Edge's non-modal dialog state;
  viewport screenshots preserve the normal interaction and are used for this test.

These results do not certify the unfinished parts fitment and notification work.

### Fitment foundation evidence and remaining work

- The forward 64th migration replayed on a second newly created private `_ci`
  database; schema comparison and `db:check` passed. It adds draft review defaults,
  normalized makes/models, scoped rule metadata, evidence, independent-review
  constraints, unique semantic fingerprints and append-only history. No existing
  compatibility row is promoted, guessed or deleted. The migration is now applied
  in this isolated target and must not be edited; fixes require another migration.
- Thirteen engine unit tests and four authenticated HTTP integration scenarios
  passed. The latter exercise real PostgreSQL constraints/history protection,
  delegated Operations authoring, Workshop review, branch/MFA/CSRF restrictions,
  self-review rejection, duplicates, stale edits, public draft visibility,
  qualifier uncertainty, exclusion precedence and SQL/presentation agreement.
- New routes are under `/public/fitment` and `/staff/fitment`. The managed workforce
  boundary permits only this newly guarded module in addition to existing paths.
- Legacy catalogue public projections and vehicle facets now omit unapproved rules.
  Existing discovery fixtures asserting legacy draft visibility must be updated to
  represent the new approved-evidence semantics; the whole backend suite is pending.
- The new staff/public parts screens, model-bound catalogue search/count/paging,
  product/category attribute controls, saved configuration flow, notification navigation/read acknowledgement and final
  branding/browser/build checks remain required. No claim of full completion.
- Non-critical/universal scope requires an explicitly recorded non-braking part
  type. Unclassified parts retain conservative critical handling. Technical review
  of actual manufacturer evidence remains an operational responsibility; no broad
  external fitment dataset or fake production catalogue has been inserted.

Follow-up: five fitment HTTP scenarios plus the 13 engine cases and the real
missing-column guard passed (19 tests). Legacy compatibility writes now record
actors/version history, draft removal retires the record, and the old routes reject
changes to normalized or reviewed rules. Public legacy projections/facets exclude
exclusion rules as well as unapproved rows. The modern decision endpoint retains
exclusions so they override broader approved inclusion evidence.

Withdrawal authority: either a current scoped author or technical reviewer may
retire a rule. Retirement removes the verified claim while preserving its history;
it does not grant authority to approve or edit the rule. Tests cover technical
reviewer retirement separately from authoring permission.

### Parts search, staff workflow and collection checkpoint (23 October 2026)

Implemented locally after the foundation commit:

- Public normalized-car search applies approved evidence and exclusion predicates
  in PostgreSQL before pagination, exact totals and verified totals. It supports
  stored condition/classification/type and parent-category filters. Public product
  projections omit private evidence sources and reviewer identities.
- The desktop/mobile parts finder restores vehicle context from safe URLs, clears
  dependent selections together, distinguishes all four fitment outcomes and keeps
  unknown details unverified. The existing contact enquiry receives validated,
  editable car/part context without accepting customer identity or redirect input.
- Staff can record/clear real product condition, OEM/aftermarket classification and
  product type. Category administration supports a top-level parent and one level
  of subcategories. Hierarchy writers serialize concurrent moves; cycles, third
  levels, inactive ancestors and unsafe deactivation are rejected.
- `/admin/fitment` exposes current scoped Sales/Operations authoring and independent
  Workshop/Quality review, with create/edit/submit/approve/reject/retire, sources,
  technical restrictions, required customer details and immutable actor/version
  history. The managed dashboard loads the component's own scoped styles. Editing
  demotes approval. Approved rules must be retired before changing a product type.
- Only recorded ACCESSORY products may propose universal scope. Recognized
  non-braking consumable types may propose non-critical model-bound rules;
  unrecognized types and braking parts retain conservative critical requirements.
  No source dataset or guessed real fitment was inserted into production.
- New checkout requests accept COLLECTION only and reject delivery/contact fields
  before stock reservation. Public fulfilment never advertises retained delivery
  policies. Existing delivery order snapshots and policy history remain readable.
  Confirmed checkout clears its draft; uncertain requests retain their original
  idempotency key and body.

Checkpoint verification (not full release acceptance):

- Frontend full unit suite: 146 files, **975 tests passed**.
- Backend focused catalogue/fitment/order/schema-guard tests: eight files,
  **62 tests passed**, plus **13 fitment-engine unit tests passed** separately.
  This includes real isolated missing-column rollback, normalized filter/count/
  paging, scoped HTTP authorization, independent review and history protection.
- Discovery integration: **12 scenarios passed**, including 10,000 synthetic
  products, stable signed cursors after withdrawal/deletion and preserved reviewed
  history. Its fixtures now explicitly represent approved evidence; unreviewed
  legacy rows remain excluded.
- Collection checkout browser coverage: 39 scenarios passed across the final
  focused rerun and the preceding 38 passing scenarios. Includes 320-1536px editor/
  review/receipt checks, axe, original-request retry, session invalidation,
  stale-cart preflight, branch paging and historical delivery reads.
- Parts finder browser coverage: three desktop/mobile/error scenarios passed.
  Staff browser coverage exercises authorship, independent review, self-approval
  rejection, editing/demotion, rejection/retirement, history and uncertain saves.
  Browser requests use intercepted synthetic fixtures; server authorization is
  covered separately by isolated PostgreSQL HTTP tests.
- Current `db:check` passed: 64 reviewed migrations, compatible history and no
  Prisma schema difference on the verified private localhost:63888 `_ci` target.
  No schema changes were made in this checkpoint. No application/shared/staging/
  production database was accessed. No new backup or restore rehearsal ran.
- OpenAPI validation: 340 paths; route coverage: 400 documented operations plus
  four infrastructure routes. Staff read/write results now have explicit response
  schemas. Secret guard passed. Targeted lint and both TypeScript projects passed
  at their recorded checkpoints; final broad build/release checks remain pending.

Required follow-up: explicit public subcategory controls, saved garage search
configurations, notification navigation/read-on-successful-display, the final
multi-select/facet requirement audit, whole-backend regression, production build,
least-privilege runtime verification and final desktop/mobile scope acceptance.
This checkpoint is local implementation evidence, not deployment approval.

Staff follow-up checks: the styled desktop/mobile/uncertain-save browser scenarios
passed (three scenarios), including edit/demotion, independent rejection and
technical retirement. Four existing product/category create/edit browser
regressions passed with the new attributes. Eight fitment HTTP scenarios now pass,
including universal-accessory review and rejection of product-type changes that
would carry an existing approval onto a different classification. Legacy catalogue
screens link to the scoped technical-review workspace and do not offer legacy
edit/remove actions for normalized or reviewed rules.

### Saved garage configuration checkpoint (23 October 2026)

Saved configurations now reuse CustomerVehicle and the existing owned garage API,
media and removal flow. They are independent of Vehicle/VehicleListing sale stock.
The feature exposes nickname, one default per customer, an explicit normalized
make/model link and optional vehicle specifications. Axle/position stays with the
part search. Legacy manual names remain unlinked rather than being guessed.

- Garage writes lock the owned customer profile, then the selected owned vehicle.
  Default changes serialize and audit any previous default being cleared; the
  unique database slot is retained. Stale expectedUpdatedAt rejects the entire
  transaction, including an attempted default switch. Ordinary edits to a retained
  inactive catalogue link remain possible; new/changed links require an active
  matching catalogue identity and a supported year. Model/year changes clear
  implicit prior technical specifications.
- Owner reads return isDefault without exposing the internal slot. defaultOnly=true
  finds the owned default independently of the normal result page. A foreign
  account cannot read, mutate, remove, page through or change the default of
  another customer's vehicles. Removal preserves associated bookings.
- The garage editor supports catalogue linking, nickname, default and editable
  specifications, while keeping the existing manual workflow and media controls.
  Missing record revisions block editing rather than producing an unversioned
  fallback. Unknown specifications stay blank.
- The parts finder can select/switch saved vehicles and reuse the default even
  beyond the first option page. It re-reads the owned record before applying it,
  clears on session changes/expiry, aborts late reads and does not overwrite a newer
  search. Saved-account controls stay mounted while the URL-bound manual car draft
  resets, avoiding repeated account requests and layout jumps on each selection.
- Only model identity, year and vehicle qualifiers enter a public search URL. VIN,
  registration, nickname, default state and account identifiers are excluded.
  Accidental VIN/registration copies in specification fields are not exported.
  Limited catalogue launch mode does not enable account controls or checkout.

Verification: all 14 PostgreSQL scenarios passed together after the final lock
change: six saved-configuration HTTP scenarios and eight existing garage-media
scenarios. Five saved-vehicle browser
scenarios plus the newer-search race scenario passed across desktop/mobile,
including real catalogue selection for an unlinked garage car. Two existing garage
create/edit/short-modal regressions and the three existing parts-finder browser
scenarios passed. Browser data is intercepted synthetic fixture data; database
ownership/default/retention enforcement is checked separately over authenticated
HTTP against the verified private `_ci` target. The full frontend unit suite now
passes 146 files / 977 tests; TypeScript, targeted lint, API export, OpenAPI/route
coverage and secret guard passed at this checkpoint. No additional migration or
production deployment ran.

Notifications, explicit public subcategory controls, the remaining multi-select/
facet requirement audit, full backend regression, production build and final
least-privilege/staging acceptance remain required before full completion.

### Notification context implementation (23 October 2026)

The existing owned inbox, manual read operations, summary refresh and broadcast
channel are extended with server-resolved destinations. No arbitrary stored URL
is used. Current customer ownership, staff branch, workforce action/assignment,
finance scope and dispute/refund grants are checked before exposing an action.
Queries batch resource identities by kind and avoid a lookup per notification.
Sidebar counts use only accessible targets; the personal inbox/bell retain own
legacy notices for manual management. Security notices retain their account link.

One distinct unread record directs through the owned notification resolver to its
record. Multiple records open a paged Needs attention queue with individual links
and an explicit full-page route. Expand-only sidebar parents remain expanders;
collapsed groups retain their indicators. An inaccessible or unresolvable notice
remains manageable in the inbox without an invented record link.

The new context/read-context operations accept an exact allowlisted resource and
explicit owned notification IDs. They recheck current access, expiry and support
message membership/visibility. Read writes are idempotent and preserve the first
read time. They never update order, booking, support or payment business status.
Staff acknowledgement serializes with existing identity/responsibility changes.

Successful record views mount a contextual banner and acknowledge only after it
is displayed in a visible tab. Conversation notices additionally wait for the
actual message element to enter view. Loading, errors, mismatched records,
generic lists, expansion controls, aborted navigation and session changes do not
acknowledge. Read failure leaves the record usable with a scoped retry. Existing
broadcast/focus refresh updates sidebar/bell counts across tabs.

Exact workforce booking details and an independent staff selected-payment read
close two existing off-page navigation gaps. Workforce and legacy staff support
views accept validated message anchors and load the real history page rather than
searching only the current list. Optional visible-message IDs find older related
notices beyond the first 100 updates; bounded batches handle large unread sets.

Current verification: eight authenticated PostgreSQL HTTP scenarios and five
workforce personal-boundary cases passed together on the verified private native
PostgreSQL `_ci` target. They cover recipient/record isolation, concurrent
idempotency, unchanged business status, CSRF, expiry, independent message reads,
private/mismatched message denial, staff branch/assignment projection,
reassignment revocation, exact older-message navigation and 130-notice batches.
The full frontend unit suite passed 146 files / 979 tests. OpenAPI validation and
route coverage passed for 347 paths / 407 operations plus four infrastructure
routes. The notification browser scenarios passed across focused runs, including
mobile/desktop, cross-tab, failed/mismatched loads and message-visibility gates.
A clean 24 October run passed all 25 selected notification/payment regressions,
including list order, on-page/off-page focus, single-flight approval, retained
drafts, competing decisions and uncertain refund recovery. The selected payment
keeps its list position and refreshes its independent read after an action;
automatic focus occurs once per selection, preserving receipt focus afterward.
Changed-file frontend lint and TypeScript passed. Secret guard passed for 2974
non-ignored files. These checkpoint results are not a whole-project release
verification.

No new migration, shared database write, production send, push or deployment ran
for this checkpoint. Public subcategory controls, the final vehicle facet/multi-
select audit, whole-backend regression, full production checks and final staging/
least-privilege instructions remain required for the complete requested task.

### Category hierarchy and multiple vehicle selections - 24 October 2026

Public category controls now use the existing category collection API with root,
parent and literal prefix search. Root products and active children are included;
a child selection is constrained to its stated parent. The client clears child
and cursor state when changing parents, supports legacy category links, separate
readable chips, keyboard sequencing and mobile layouts. A real PostgreSQL hierarchy
scenario passed alongside the 12 existing product-discovery cases (the hierarchy
scenario was rerun with an appropriate fixture/request timeout). Desktop/mobile
hierarchy browser checks and category keyboard/retry coverage passed at this
checkpoint. Remaining legacy browser expectations are being refreshed for the
reviewed fitment UI; no complete final browser-suite pass is claimed yet.

Vehicle conditions and powertrains support bounded distinct multiple selections,
OR within each field and AND across other filters. Singular links remain supported.
Individual choices have removable chips. Make/model changes clear obsolete trim.
New database scenarios cover combined selections, validation and explicit assembly
countries/BEV/ICE. Final full-suite results remain pending.

A fresh empty private PostgreSQL 18 database at localhost:63888,
`allied_release_20261024161409_18e1b1eca829_ci`, was verified before the complete
64-migration replay. Schema comparison and db:check passed; the full serial backend
suite then began against that target. No application/staging database was used.
The fresh production audit discovered Next.js/Zod and backend transitive advisories;
patched dependencies are being installed only in this feature worktree. Existing
shared dependency targets are preserved. Final audit/build/regression results will
be recorded after completion. See discovery-fitment-release-review.md for the full
requirement matrix, change manifest and data-preserving staging sequence.

## Discovery/fitment production release - 24 October 2026

The requested vehicle/parts discovery, category hierarchy, independently reviewed
fitment, owned saved configurations, collection policy, scoped notification
navigation/read-after-display and active slogan changes are implemented and live.
The user explicitly authorized production deployment after verification. Final
backend acceptance passed 1,422 tests (156 intentional fixture/owner/queue skips);
frontend checks passed 985 tests plus lint/types/build/format; all 168 combined
browser scenarios passed without failures, skips or flaky results. Both production
dependency audits report zero vulnerabilities. Pushed GitHub frontend, database-
safety and secret-guard checks passed.

A new empty localhost-only _ci target replayed all 64 migrations. A fresh production
archive was actually restored into another new _ci database (86 tables), then the
two additive migrations rehearsed from 62 to 64 with existing rows preserved. The
protected production runner created/verified another fresh backup, applied only
the reviewed migrations, passed db:check and runtime privilege/schema verification,
and restored the app-only firewall. No staging data or existing grants changed.

Backend deployment 5c1ea9a7-6211-46d2-995f-c45e504bf9e9 is ACTIVE with 16/16
successful steps and all four pinned digests verified. Eight live backend GET
checks passed. Vercel dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr is READY and separately
verified on both custom domains. Keep the previous compatible app releases and
backups; review newly used enum values before a code rollback. No database
downgrade/reset or provider/payment activation is part of this release.

The service index fixture now supplies its own unrelated catalogue baseline rather
than depending on test order; all final backend tests passed on another new target.
Legacy provisioned harnesses remain explicitly gated, with skips reported rather
than treated as passes. Bounded Docker cleanup removed only the never-deployed
032fe09c API image; current/rollback images, all containers/volumes and warm caches
were retained. See discovery-fitment-release-review.md for exact evidence and
remaining acceptance limits. Item 6 and other settled operational decisions keep
their current scope; this feature rollout does not close the whole site queue.
