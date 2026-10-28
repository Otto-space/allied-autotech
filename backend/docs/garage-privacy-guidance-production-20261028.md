# Garage and privacy guidance production release — 28 October 2026

Runtime `55714afd1d52e834aa4d83a1123a85f6748b962f` is published as
`dpl_6b35E89UpjSP9heFX88nWWB6BFdA`, independently verified on both
alliedautotech.com and www.alliedautotech.com at 22:41:54 UTC. Eighteen subsequent
public read-only browser checks passed. The full V01–V55 audit remains active.

## Customer behaviour

- **V53:** basic garage entry stays available without understanding catalogue
  linking. A native optional Shop-search disclosure explains the distinction.
  Linked vehicles and the direct setup action open it automatically. Validation
  reveals a missing field before focusing it. Toggling setup preserves the extra
  specification draft; saving with setup off explicitly removes the existing link
  under the unchanged API contract. Search selections do not claim confirmed fitment.
- **V55:** the privacy page explains request, authorised review and separate
  execution, with a real Customer Care follow-up link. Approved-pending-policy
  records explicitly say information has not been deleted or anonymised and no
  data change is scheduled. The steps remain visible on mobile as well as desktop.
  An old mobile rule hiding the list was found during screenshot review and removed.

No permission, schema, migration, retention executor, delivery promise or feature
flag changed. Existing learning definitions already explain these workflow
boundaries; no semantic guide target changed. Actual privacy execution still needs
a separately approved process; this release does not implement or promise it.

## Verification

- Local TypeScript, scoped lint and formatting passed before release integration.
- [Exact-source frontend CI](https://github.com/Otto-space/allied-autotech/actions/runs/40780036790)
  passed **1,225 tests**, with 12 optional cases skipped, plus lint, types,
  formatting and the locked production build. Production dependency audit: zero
  vulnerabilities. The installation audit still reports three development-inclusive
  findings (two moderate, one high); dependencies were not changed by this batch.
- [Repository secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40780036778)
  and [isolated backend safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40780036897)
  passed for that exact master commit. A separately dispatched safety run
  [also passed](https://github.com/Otto-space/allied-autotech/actions/runs/40780112964).
- **41 final combined-source hosted cases passed**: new guidance at 390/1440px;
  360/768px layout; tablet Axe/modal checks; short mobile dialog; keyboard focus,
  hover, navigation/Back draft retention; create/edit validation; pending saves;
  stale, denied and uncertain results; customer-only access; linked/default vehicle
  selection; and late-response/session isolation. Accounts and writes were fictional
  fixtures, with unmatched API calls denied. This is not real private-account acceptance.
- **18 candidate and 18 production public checks passed** across Home, Privacy,
  Shop, About, Help, Services, Vehicles, product detail and Allie at 390/1440px.
  The new static hero, equipment image/anchor, FAQ keyboard operation, readable
  prices and policy navigation passed with zero attempted writes/page exceptions.
- Screenshots were visually inspected, including the final mobile privacy steps
  and desktop/mobile garage forms. Automated assertions now require the privacy
  steps to be visible, rather than merely present in the DOM.

Initial test issues were corrected without weakening behaviour requirements:
an asynchronous request counter assertion ran too early; a new linked-vehicle
fixture omitted required `isActive` fields; and three legacy Shop locators used
the removed finder button instead of the current radio. An interrupted first
runner had no final receipt and is not counted as a complete run. The corrected
35-case run and subsequent 41-case runs are retained separately; the final combined
run passed all 41 in one invocation.

## Source preservation and safety

The initial promotion preflight stopped when public-copy source `bee7ed8f` reached
production. That entire published release was merged, preserving its static Home,
copy and imagery alongside prior favourites, fitment, notification and learning
fixes. Combined master then passed fresh CI/build/browser gates. Neither earlier
candidate was promoted over the newer public release.

Master's unrelated W16 work and generated contracts were preserved by before/after
hashes. A tracker-only stash conflict was resolved by keeping both complete sections;
all recovery stashes remain. The four pre-existing dirty audit files were preserved.
No branch/worktree was retired: these contain active or unrelated work.

Backend `3ee6748f-ed72-4c89-b9a1-f1963e891190` remained ACTIVE with no pending
deployment and readiness 200. Backend source/schema/scripts match published
`a51a58b8`. No local/shared database writes or backend rollout ran in this batch.
Eight managed backups were verified, newest `2026-10-28T05:22:10Z`. Existing
off-device encryption/retention/PITR evidence was retained. The separate populated
logical restore-and-forward rehearsal finished `2026-10-28T11:37:56.500Z`, passed
and preserved original-row hashes. No new restore or physical PITR drill ran.

Immediate compatible frontend rollback is `dpl_Akw8ic1B6NQFGgL7tDDrm3pskZZ3`,
source `bee7ed8f`; retain the existing backend. Promotion rechecked aliases/backend
immediately before mutation and verified both domain assignments afterward.

Evidence is under `%TEMP%/allied-garage-privacy-20261028/`: baseline screenshots,
corrected/release/merged hosted receipts, final screenshots, exact CI and log summaries,
master preservation receipts, promotion preflight, production aliases and public
receipts. Provider-only browser state is ignored/private and contains no customer
session; it must not be committed or published.

Disk preflights passed before uploads, browsers and promotion. No local dependency
install, build, Docker build or cleanup was performed. Inventory retained: 53 local
images, 13 stopped containers, 14 volumes and 230 cache entries. These include
other tasks/current recovery resources. Free space changed independently; no
reclamation or machine-wide reserve guarantee is claimed.

## Remaining work

Physical devices, full screen-reader and real private-account acceptance remain
unverified. Missing catalogue model choices and genuine product photography are
business-data dependencies. The final audit still needs remaining service-enquiry,
About/Contact/Help hierarchy, disclosure consistency, security-session rendering
and wider route/state acceptance. Reconcile the published public-copy changes with
each corresponding ledger item instead of duplicating that work.

Final disk postflight: 29.79 GiB free on C:. Both aliases were reverified at 22:46:54 UTC; the backend remained ACTIVE without a pending deployment.
