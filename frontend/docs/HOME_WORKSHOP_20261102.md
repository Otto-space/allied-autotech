Public service-note exposure is resolved by the reviewed public projection in
2c6f58d0; stored administrator evidence is retained. Service catalogue/detail imagery
is restored. See [the release report](../../docs/PUBLIC_SERVICE_PRESENTATION_20261102.md).
Historical authoring/access notes below describe the earlier state.

Latest hero redesign, seven-second timing and laptop-hover policy: see
[HERO_OVERLAY_20261102.md](HERO_OVERLAY_20261102.md). Published runtime 485fb2c5.
Earlier composition and motion observations below are historical.

# Home and About workshop restoration - 2 November 2026

## Latest publication and remaining authoring

The Home/About implementation is retained in released source `6f3cf203`, frontend
`dpl_7HctXP7eYBDvCc9i7TnQsiG9hYgP` and backend
`1597c138-919c-4470-b991-0add596837f9`. Both actual domains were verified after
promotion. Four unmocked public price/navigation/team smoke cases passed at
390/1440px. Live carousel checks passed again: three loops 56.8s, hover/manual
pause and keyboard behavior 54.0s, controlled slow/failed images 26.8s.
The separate [vehicle-access report](../../backend/docs/vehicle-operator-access-20261102.md)
records its migrations, role checks, release receipts and actual acceptance limits.
The original Home publication below remains historical evidence.

Latest safe screenshots, visually inspected at desktop Home and mobile About:

- [Mobile Home before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-home-390.png)
  / [after](C:/Users/PC/AppData/Local/Temp/vehicle-operator-20261102/public-final/home-390.png)
- [Desktop Home before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-home-1440.png)
  / [after](C:/Users/PC/AppData/Local/Temp/vehicle-operator-20261102/public-final/home-1440.png)
- [Mobile About before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-about-390.png)
  / [after](C:/Users/PC/AppData/Local/Temp/vehicle-operator-20261102/public-final/about-390.png)
- [Desktop About before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-about-1440.png)
  / [after](C:/Users/PC/AppData/Local/Temp/vehicle-operator-20261102/public-final/about-1440.png)

One authoring follow-up is pending: the three newly created full service descriptions
contain internal workbook/discount notes. The owner cannot sign in right now, so no
alternative authentication or database authoring was attempted. Prepared replacement
copy below removes that internal explanation. Apply through normal review/Confirm,
changing only description and preserving IDs, final prices, quantities and durations:

- Diagnostics: Full vehicle health check with a PDF copy of the scan result. Confirm
  appointment duration, vehicle suitability, exact scope, parts/materials inclusion,
  tax and any warranty conditions with the team before work is agreed.
- Wheel Alignment: 3D correction of all four wheels. The listed duration is one hour
  and the listed warranty is seven days. Confirm vehicle suitability, scope,
  materials, tax and warranty conditions with the team before work is agreed.
- Generic Lube Oil Service: Lube oil change with air-filter and AC-filter cleaning.
  This is separate from Basic Oil Service, which has a different scope and price.
  Confirm suitable oil, oil and filter compatibility, parts/materials inclusion,
  appointment duration, tax and any warranty conditions before work is agreed.

This is pending editorial authoring, separate from genuinely unresolved workbook
package, duration, tax/material and warranty conditions documented below. The
published final amounts already reflect the authorised reduction exactly once.

Released source `1224d942d0e8cd76315786e735bc56185dc51c22` was published on
`alliedautotech.com` and `www.alliedautotech.com` (www redirects to apex).
Frontend: `dpl_Ehmd5TkgUMnWp2CHHZoUmp7CiTZL`; backend:
`dea3489e-0d93-4aad-9e0d-998fae51190b`, ACTIVE, 16/16 steps, four matching digests.
Subsequent unrelated work on master belongs to its own release; it is not claimed
as part of this publication.

## Sources, placement and composition

The complete owner brief dated 1 November, its asset register, all 15 photographs
and Sheet1 of `AUTHORIZED SERVICE PRICE.xlsx` were inspected. Actual photographs
are 5616 x 3744 (portraits 3744 x 5616), larger than the brief's reference dimensions.
Originals remain unchanged. `scripts/prepare-workshop-assets.mjs` creates 13
metadata-stripped WebP variants, 2,547,642 bytes total, through the existing Sharp
pipeline. `workshop-asset-manifest.json` records all 15 original names, hashes,
dimensions, delivery paths, crops and exclusions.

- Open-bonnet diagnostics leads the hero and diagnostics card. Alignment and tyre
  action complete the carousel; the diagnostic tablet supports equipment content.
- The complete seven-person team photograph retains its natural ratio on Home and
  About. Both posts and the full structure of the portrait lift remain visible.
- The existing injector-tester photograph was visually verified. IMG_3258 is the
  smoke leak detector, correctly labelled in the About equipment gallery.
- About retains mission, vision, principles and existing anchors, and adds team
  imagery, the team anchor and the portrait lift. Equipment disclosures and photo
  viewing remain available.
- Shop uses explicitly illustrative Engine oils, Filters and Replacement parts
  discovery when fewer than three eligible photographed products exist. These are
  not fabricated SKUs, stock or compatibility claims. Castrol and the green-car
  performance composite are withheld. Real vehicle images and fault disclosures
  remain intact. Photo-led cards fill their media regions; portrait/group subjects
  use deliberate preserving compositions.

The carousel uses initial server-rendered HTML, one H1/current link, a prioritised
first photo, six-second rotation and a 500ms opacity transition. One controller
handles hover, persistent manual/focus pause, explicit Play, reduced motion,
visibility/offscreen suspension, keyboard arrows, buttons and touch. Current
content remains while the next image decodes; an eight-second bounded wait skips
failed candidates. All-image failure retains readable copy and working links.
Controls reserve space before enhancement. Timers/listeners clean up on unmount.
No new dependency, duplicate profile or worktree was required.

Guidance consulted: [WAI carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/),
[web.dev carousel guidance](https://web.dev/articles/carousel-best-practices),
[LCP guidance](https://web.dev/articles/optimize-lcp), and installed framework docs.

## Authoritative service mapping

Before writing, both the public API and signed-in All services catalogue were
inspected, including inactive visibility and pagination. Exactly one service
existed: Tyre Change, version 6, NGN 1,000, 30 minutes. The eight existing parent
groups were verified. An old tracker price was stale; the actual record was
preserved, with no reinterpretation of its quantity or scope.

All three unambiguous offerings were created through normal administrator review
and Confirm save, then independently read from the public API:

| Offering                          | Sheet1 evidence                                                        | Existing parent                   | Published amount and duration | Record                                 |
| --------------------------------- | ---------------------------------------------------------------------- | --------------------------------- | ----------------------------- | -------------------------------------- |
| Comprehensive Vehicle Diagnostics | Row 18: 10,000 less 20% = 8,000; full health check and PDF scan result | Vehicle Diagnostics & Inspections | NGN 8,000; duration unknown   | `3c25b4f8-10e9-43e5-b8cb-63206bab6395` |
| Wheel Alignment                   | Row 5: 5,000 less 20% = 4,000; all four wheels; 1hr; listed 7 days     | Tyre & Wheel Maintenance          | NGN 4,000; 60 minutes         | `14e8ba81-1fc2-4057-ba50-99c15060aea2` |
| Generic Lube Oil Service          | Row 23: 10,000 less 20% = 8,000; oil change and air/AC-filter cleaning | Engine & Drive System Maintenance | NGN 8,000; duration unknown   | `69e474a3-8ff5-4be5-a7ea-8edffded4bcf` |

Public verification at 08:20 UTC confirmed these exact integer-kobo amounts and
null durations, alongside unchanged Tyre Change `669f57ce-6e45-46f8-a9c4-75aa56f9d169`
at 100,000 kobo/30 minutes. Home reads the authoritative catalogue and applies no
second discount. Generic Lube remains separate from row 24's Basic Oil package
(NGN 10,000 after discount). No ninth group, duplicate job, capacity or slot was
created. Nullable-duration authoring required no Prisma schema change; booking
and public-slot guards still reject services without confirmed durations.

Only genuine workbook questions remain: R20/R21 boundaries and row 9's repeated
smaller-tyre description; equivalence of the existing tyre unit to four-tyre
packages; unnamed priced rows; unpriced inspections; Major AC's unchosen 5%/10%
markup; missing durations, warranty conditions and parts/materials/VAT inclusion.
Blank values were not treated as zero, free, a duration or a warranty promise.
Restricted commerce and financial activation policies were not changed.

## Verification and actual limitations

Browser plugin was not available; regular Playwright with installed Edge was used.
The initial hosted candidate had the same runtime as the released source. Across
17 distinct Home scenarios and 26 About regressions, passing evidence covers:

- Three complete real-time autoplay loops twice, including a final-candidate run
  of 58.5 seconds, synchronized image/copy/CTA and no timer acceleration.
- Repeated hover/leave, persistent manual pause, keyboard-focus pause and explicit
  restart, arrows, rapid selection, touch swipes with normal vertical scrolling,
  orientation/resize, offscreen return and route revisits.
- Reduced motion, doubled text at 320px, no-JavaScript HTML/photos/links, all-image
  failure, bounded stalled-image recovery, deliberately failed slides and retries.
- 320, 360, 390, 414, 768, 1024, 1440 and 1920px Home layouts; About additionally
  375, 430, 1280 and 1536px. Stable hero dimensions and complete natural-ratio team.
- Automated WCAG 2.2 AA-targeted Axe checks: no reported violations in tested
  Home main content and About states. Public-page privacy checks use synthetic
  session fixtures; no claim of authenticated role acceptance follows from them.
- About anchors, all equipment images/labels, keyboard disclosures, photo failure,
  slow-photo Close, dialog focus restoration and unsafe-query handling.

Final candidate: four interaction/loop/static/About cases passed, then both
390/1440px layout checks passed. One old slow-image test failed because navigation
waited for the delayed eager image's load event before asserting its intermediate
state. This failure is retained. Two independent controlled-delay runs observed
slide 1 while pending, released the image, and reached slide 2 in 383/202ms; both
then skipped a deliberately failed slide to a usable slide 3/CTA. The repository
regression now gates image release after observing pending instead of racing load.
That corrected regression passed against the actual public site in 18.6 seconds.
A prior lazy-team assertion was also corrected to wait for actual image decoding.

Four unmocked public smoke cases passed across apex/www at 390/1440px, checking
all three final prices, real service detail navigation, illustrative Shop discovery,
the About team anchor, no page errors and no business mutation requests.

Exact release-source checks all passed:

- Frontend release checks `41410320526`: 1,319 unit tests passed, 12 existing
  skips; production build, TypeScript, lint, formatting and API artifacts passed.
- Backend database safety `41410472971`: isolated migration replay/schema check,
  unknown-duration contracts, 15 real isolated administrator catalogue cases,
  authenticated Help & Learn and required backend regressions passed.
- Repository secrets `41410320521` passed. Nine packaged API/worker/migration-image
  checks passed, including non-root/TLS entrypoints, Sharp, imports and fonts.

Hidden visibility was tested by a deterministic visibility-event simulation;
actual native background-tab switching, physical-phone Safari/Chrome, full screen
reader use and field performance percentiles remain untested. Existing fixture-gated
Home/brand suites remain skipped where their fixture server was unavailable.
Automatic approval review rejected starting the local production server with only
"blocked by policy"; no equivalent start command was retried. Hosted production
builds supplied rendered evidence instead.

## Comparable lab samples and safe screenshots

Fresh Edge headless contexts, 390/1440 x 1000, reduced motion, network idle, no CPU or
network throttling. These are individual lab samples, not field percentiles or a
universal speed guarantee. Click-to-paint is a two-animation-frame sample, not INP.
Image transfer accounting can reflect cache behavior.

| Route / width | LCP before -> public after | CLS before -> after  | Measured image bytes before -> after |
| ------------- | -------------------------- | -------------------- | ------------------------------------ |
| Home 390      | 4272 -> 2328ms             | 0 -> 0.000004        | 101440 -> 114520                     |
| Home 1440     | 1656 -> 1572ms             | 0.000477 -> 0.000087 | 203918 -> 306666                     |
| About 390     | 1556 -> 1312ms             | 0.000004 -> 0.000004 | 0 -> 140636                          |
| About 1440    | 1288 -> 1164ms             | 0.000166 -> 0.000166 | 59152 -> 122698                      |

Public Home click-to-paint was 23.1/33.5ms. All four after samples had no overflow
or page errors. About's zero before-transfer sample is a cache-accounting limit,
not evidence that no images were delivered. Authentic additional imagery increases
some payload measurements; responsive variants and below-fold lazy loading remain.

Public pages only; no private account, payment or customer details:

- [Mobile Home before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-home-390.png)
  / [after](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/public-final/home-390.png)
- [Desktop Home before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-home-1440.png)
  / [after](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/public-final/home-1440.png)
- [Mobile About before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-about-390.png)
  / [after](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/public-after/after-about-390.png)
- [Desktop About before](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/before-about-1440.png)
  / [after](C:/Users/PC/AppData/Local/Temp/allied-home-20261102/public-after/after-about-1440.png)

Raw baseline, final candidate, About, controlled-load, public smoke and metric
receipts remain in `%TEMP%/allied-home-20261102`. Provider-only browser state and
populated deployment specs remain private and are excluded from public artifacts.

## Release and preservation

All commits were SSH signed using the existing unlocked Windows agent and Windows
OpenSSH signer. No passphrase was requested or recorded. An earlier unsigned API
commit was left unreferenced and was not released. Runtime started from the current
published invoice-identifier baseline, preserving its functionality. Later unrelated
master work remains with its owning agent.

No migration, database data repair or grant change was needed. Read-only production
history/schema checks passed before and after release (85 migrations), as did runtime
least privilege and all eight worker heartbeats. Temporary access was removed after
each check. Existing managed backups (eight, newest 2 November 05:22 UTC) and the
successful separate populated restore rehearsal completed 1 November 17:59 UTC
were verified; the Prisma schema and protected migration machinery are unchanged
from that rehearsal. This is not a new restore or a promise of zero risk.

Only the four component digests changed in the submitted backend spec; its
predeploy remains read-only. Previous/current releases and other tasks' Docker,
source, databases and recovery resources are retained. Disk reserve checks passed
throughout; final measured space and bounded task-artifact cleanup are recorded
when completed. This is an agent preflight, not a machine-wide quota guarantee.

## Separate vehicle-access request

The owner chose full Admin operations while retaining owner-only controls.
Admin/Super Admin already pass the vehicle create/edit role checks. Price changes
also require StaffProfile for a mandatory price-history relation; this restriction
requires its own reviewed forward-compatible actor-history change. Comma-separated
price input is another source finding. No vehicle, price, staff profile or permission
was changed as a visual demonstration. Follow-up must preserve current assurance,
versioning, committed-listing safeguards, audit history and owner-only policies.
