# Contact clarity release - 29 October 2026

Contact findings V34/V35/V36 are deployed to alliedautotech.com and
www.alliedautotech.com as READY deployment `dpl_CXXM8WeyShRAKrZZNRCCEBvrKY2i`.
Runtime source is `35c314c678d038b7a59ce6fe90aa74df7007aefd`; the final test-only
review revision is `f2b748199a34cc6903440f4e4e1d6cbd3f8f6e88`.

## Customer-facing changes

- A sole verified handling workshop is a labelled read-only value. Multiple,
  paginated, unavailable and failed choices retain the existing picker and recovery.
- Empty subject/message errors identify the missing field. The existing first-error
  focus, validation limits, public identity checks and review step remain intact.
- Short preparation and next-step guidance replace repeated instruction cards and
  the redundant form heading. Desktop retains two columns; mobile prioritises the
  form. Privacy, approved hours, acknowledgement versus resolution, contact channels,
  account access, drafts, source context, branch routing and receipt remain available.
- The duplicate named Contact region found by Axe during acceptance was corrected.

Changed runtime: `frontend/app/contact/{page.tsx,contact.css,contact-record-picker.tsx}`,
`frontend/app/components/contact-parts-enquiry.tsx` and
`frontend/lib/api/support-schemas.ts`. No API, database, permission or policy change.

## Acceptance evidence

- Nineteen focused schema/source/draft unit tests, TypeScript and scoped ESLint passed.
- Runtime-source frontend CI `40815116193`, isolated backend safety `40815184586`
  and secret guard `40815116234` passed.
- Final review CI [40819657340](https://github.com/Otto-space/allied-autotech/actions/runs/40819657340)
  passed **1,256 tests**, with 12 optional cases skipped, plus lint, types,
  formatting and production build. Production dependency audit: zero vulnerabilities.
  The installation audit still reports three development-inclusive findings
  (two moderate, one high); this batch does not resolve them.
- Final review isolated backend safety
  [40819714453](https://github.com/Otto-space/allied-autotech/actions/runs/40819714453)
  and secret guard
  [40819657385](https://github.com/Otto-space/allied-autotech/actions/runs/40819657385)
  passed. No local or shared database test/write ran in this batch.
- **68 distinct hosted fixture cases have passing evidence**: 52 passed in the
  initial complete run; the remaining 16 passed after fixture corrections. A
  strict identity-based aggregation verifies that the corrected set equals all
  initial failures, with no omissions, flaky or skipped cases. This is not a
  claim that the initial 68-case run passed. The four focused Contact cases also
  passed separately on the final runtime.
- Coverage includes Contact enquiry/complaint payloads, source and branch selection,
  drafts, review/cancel/send, keyboard focus, hover, scoped Axe and responsive
  layout; adjacent catalogue, service, favourites and managed Care workflows.
- **20 candidate and 20 production public read-only checks passed** at 390/1440px.
  They cover Home, Privacy, Shop, About, Help, Services, Vehicles, service detail,
  product detail and Allie. No page exceptions, overflow or attempted business
  writes were observed.
- **Four post-release Contact fixtures passed** at 360/390/768/1440px: field-specific
  errors, first-error focus, review/Escape/draft preservation, visible keyboard focus
  while hovered, automatic branch payload, focused receipt and scoped Axe.
  All identity and mutation responses were intercepted; no real enquiry was sent.
- Screenshots were retained and reviewed. Browser plugin was unavailable; installed
  Playwright/Edge was reused. Physical devices, private accounts and comprehensive
  screen-reader acceptance are not established by these fixtures.

Evidence folder: `C:/Users/PC/AppData/Local/Temp/allied-contact-clarity-20261029/`.
Key receipts: `baseline.json`, `focused-integrated-results.json`,
`regression-results.json`, `final-regression-results.json`,
`effective-regression-results.json`, `candidate-public-receipt.json`,
`production-public-receipt.json`, `production-contact-results.json`,
`promotion-preflight.json`, `production-aliases.json`, `final-review-ci.log`.
Screenshots are in `integrated-results/` and `production-contact-results/`.

## Corrections and release integrity

Initial fixture failures were retained. Corrections covered the actual public
support endpoint, current product label and vehicle enquiry contract, approved
email/directions, current Shop title, public-image GETs already present in hosted
SSR, and reloading after switching between fictional empty/populated catalogues.
Known unused font/fallback preloads are accepted only after checking the actual
same-origin asset, response type and matching font-face/fallback CSS declaration.
They remain a performance limitation; unknown warnings and errors still fail.

Review CI `40818978400` passed tests/build but failed Prettier on the console helper.
The formatting-only correction passed the final full CI. No runtime change was
made to obtain that pass. Release preflight verified that the final review differs
from the staged runtime only in the three reviewed test files, excluded by
`frontend/.vercelignore`; the tested production build was reused without rebuilding.

The first promotion attempt received Vercel HTTP 403. Fresh CLI identity and project
checks succeeded; both domains still pointed to the previous release. Every gate
was rechecked before the second attempt succeeded at 2026-10-29T04:56:37Z.
Both domains were independently verified against the promoted deployment.

Published source `060dba8d` and the concurrent W16D frontend are preserved. The
backend remains `9c91eeff-b191-4de5-b9d5-0e6d06134d42`, ACTIVE, without a pending
deployment, and passed readiness 200 in release preflight. Compared with backend
source `2586c61b`, the only committed backend change is reviewed CSO help article
version 3. That content update is **not published by this frontend release**;
the live backend retains version 2. Existing API/schema/permissions are compatible.

Eight managed off-device backups were verified, newest 2026-10-28T05:22:10Z and
under 24 hours old at promotion. Retained provider encryption/retention/PITR
evidence is documented in `vehicle-marketplace-implementation-20261028.md`.
The separate populated restore-forward rehearsal finished 2026-10-29T00:00:42Z,
passed with equal original-row hashes and 78 final migrations. This batch did not
perform a fresh restore, physical PITR test or migration.

Frontend rollback: `dpl_AzXytZPjJgVb93kjfcb79KsuZtVH`, source `060dba8d`.
Preserve the compatible current backend during any frontend rollback.

## Remaining work and preservation

All 18 audit sections and V01-V55 remain in scope. This release closes only the
sampled Contact acceptance; it does not establish whole-site completion. Service
V28/V29/V30 was already published in source `060dba8d` and remains included.
Unused preloads, authored service wording, outstanding typography/navigation,
About/Help and role/state acceptance remain in the checkpoint.

Next About baseline is recorded under `about-baseline/`: all 11 principles are
expanded (1,649px at 390px wide); equipment pictures are 90px mobile/110px desktop
with no enlarge control. No overflow or page exception at 360/390/768/1440px.
V31/V32 need implementation. V33 must be assessed against the now-changed Home
and Services composition, preserving approved artwork and real equipment evidence.

Existing dirty tracker/brand records, other worktrees and both retained tracker
stashes were preserved. No dependency installation, Docker build or new worktree
was required. Docker's desktop-linux daemon was unavailable during the final
read-only inspection; no Docker resource was deleted or claimed reclaimed.
The shared disk preflight passed at 28.78 GiB before promotion. This is a
point-in-time check, not a machine-wide reserve guarantee.
