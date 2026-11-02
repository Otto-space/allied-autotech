# Homepage photographic hero: implementation and release ledger

Package start: 2 November 2026, 11:12 UTC; target within 60 minutes.
Scope: the final hero-specific instruction. Broader audit work and the published
vehicle-permission repair remain separate. No separate audit attachment was found;
the final hero instruction is sufficient and no additional document is needed.

Design reference: C:/Users/PC/.codex/generated_images/01a19afb-f22c-7c43-8d33-351508429d13/exec-3cdca8dc-ee83-4a47-b65f-f283833e8dc3.png.
Reference only; delivery uses unchanged original workshop WebP files.

Design system: full-photo band; charcoal directional gradient; white Quicksand 700
headline; existing red primary button and 6px controls. Desktop follows the 1200px
public grid, mobile 20px gutters. One headline, sentence and existing CTA per slide.
Remove the overline. Compact 44px pause/play, small indicators with 44px targets and
an elongated selected mark, subtle 44px arrows for direct manual wraparound.
Existing 500ms crossfade; seven-second reading interval. Laptop hover continues;
focus/manual pause remains persistent until Play. Reduced motion starts stopped.

Allowed copy: three existing titles/CTAs; first support sentence becomes 'A full
vehicle health check, a PDF scan result and clear advice on what comes next.' Other
support copy, destinations, header, logo and downstream sections remain.

| Requirement                                                            | Implementation/evidence                     | Status                 |
| ---------------------------------------------------------------------- | ------------------------------------------- | ---------------------- |
| Full photograph, directional overlay, clean heading, no split panel    | HomeHero module                             | Verified               |
| Faces/equipment on phone, tablet, laptop                               | Responsive per-photo focal positions        | Verified in Edge       |
| Laptop hover continues, focus/manual pause persists                    | Hover state removed, focus guard retained   | Passed                 |
| Calm seven-second motion, stable loading, bounded fallback             | Existing reducer and updated interval       | Passed                 |
| Touch, wrap, reduced motion, visibility, offscreen, slow/failed images | Affected browser regression suite           | Passed                 |
| Long headings, larger text, contrast, CTA/support clearance            | Content-driven dimensions and 44px controls | Passed                 |
| Preserve favourites, filters, radii and destinations                   | Scoped hero patch                           | Affected checks passed |

Browser plugin unavailable; existing Edge/Playwright is the fallback. Local preview
uses loopback 3102 and read-only in-memory fixture 5023, no real database or account.

## Verification checkpoint

Six focused controller units pass. Scoped ESLint and type checking passed on reused
local dependencies (Next 16.3.8 / Vitest 4.1.11); the lockfile/hosted verification
remains separate. No dependency was installed.

The initial visual review found a clipped third-slide worker and desktop text over
the worker's head. Mobile focus moved left; desktop content/gradient on that slide
move right. Tablet contrast initially failed five conservative text-line samples
(minimum 2.39:1). Narrower tablet copy and stronger directional shading now pass all
30 normal-viewport samples (minimum 7.94:1). Twelve short-phone samples pass too
(minimum 5.01:1). These are worst-pixel contrast measurements under actual text
line boxes over original photos, not a claim of complete WCAG conformance.

The initial loading test exposed an asynchronous route teardown race. Its stalled
and all-failed states are now separate, with the pending request completed before
disposal. Both pass. A full intermediate run had 16 passing cases and that one
harness failure; the final complete hosted suite passed all 20 cases.

At 390x667 the normal full-width support bar intercepted the CTA. On short Home
viewports only, existing support actions use a 44px corner arrangement while the
hero is in view. A CSS selector uses the existing intersection state; no new
listener, permission or support workflow. The ordinary labelled bar returns when
the hero leaves view or the route changes. Both 320x667 and 390x667 hit-testing
cases pass, including every hero action and bar restoration on scroll/About.

When every photo fails, motion controls are disabled and the primary destination
remains usable. The final suite includes this state plus touch, seven-second
loops, manual wrap, focus/manual pause, visibility/offscreen, reduced motion,
text enlargement, no JavaScript and eight viewport widths.

## Final verification and publication

The final CSS-only refinement makes mobile photo-clear rows grow with enlarged
text; six affected layout tests passed afterward. The complete local intermediate
suite passed 20 cases. Exact final hosted source then passed **20/20 in 282.8 seconds**,
with zero failures, skips or flaky cases. This includes three real-time complete
loops, manual wrap/selection, seven-second timing, laptop hover, keyboard/manual
pause, touch, reduced motion, simulated document visibility, offscreen return,
route revisits, no JavaScript, bounded slow/stalled/failed recovery and terminal
all-image failure. Eight widths: 320, 360, 390, 414, 768, 1024, 1440, 1920.

Hosted Axe checks of main at 390/1440 returned zero violations for the selected
WCAG A/AA rules; this does not establish full WCAG conformance. Final hosted
background contrast passed all 30 normal samples (minimum **8.03:1**) and 12
short-phone samples (minimum **8.27:1**). Thresholds were 3:1 large headings and
4.5:1 body. Fixed support/developer chrome was excluded from background-only
measurement; independent interaction tests retain the real support controls.
The first local short measurement included a developer issue badge and was
corrected before the clean hosted measurements. No application assertion was weakened.

Final public smoke captured 12 unedited screenshots, verified all three destinations
return 200, and found no horizontal overflow or page errors. An initial short-phone
capture raced focus-induced scrolling; the final capture blurs the control and
waits for scroll position zero. Use the `public-final-*` evidence below.

### Reference comparison and safe screenshots

Concept and rendered phone/desktop screenshots were inspected together. Five
retained characteristics: full-photo composition, directional shading, rounded
headline, one red CTA and compact motion controls. Intentional differences:
authentic existing logo/header, unaltered supplied photographs, grouped dots with
adjacent arrows, and right-side desktop copy for the third slide's worker.
No generated image was shipped. All public screenshots are anonymous and contain
no private records or credentials. Refreshed before captures verified the old
public deployment immediately before promotion.

- [Phone before](C:/Users/PC/AppData/Local/Temp/hero-overlay-20261102/public-before-390.png) / [after](C:/Users/PC/AppData/Local/Temp/hero-overlay-20261102/public-final-after-390-slide-1.png)
- [Desktop before](C:/Users/PC/AppData/Local/Temp/hero-overlay-20261102/public-before-1440.png) / [after](C:/Users/PC/AppData/Local/Temp/hero-overlay-20261102/public-final-after-1440-slide-1.png)

Further final screenshots: `public-final-after-{320,390,768,1440}-slide-{1,2,3}.png`.
Evidence directory: `C:/Users/PC/AppData/Local/Temp/hero-overlay-20261102`.
Receipts: `hosted-results.json`, `hosted-contrast-final.json`,
`hosted-contrast-short-final.json`, `public-final-smoke.json`, `aliases-after.json`,
`ci-final.json`, `backend-compatibility.json`; local enlarged-text review:
`text-200-after.png`. Local captures may contain developer chrome; public ones do not.

### Exact release and remaining limits

Signed runtime source **485fb2c57140ea020f297878582b3ee2558d48bc**, signature
verified by GitHub. All exact-source required checks passed:

- [Frontend release 41441590221](https://github.com/Otto-space/allied-autotech/actions/runs/41441590221)
- [Backend database safety 41441643160](https://github.com/Otto-space/allied-autotech/actions/runs/41441643160)
- [Repository secrets 41441590148](https://github.com/Otto-space/allied-autotech/actions/runs/41441590148)

Held production deployment **dpl_8qztTisCborq3CBcEQNmvpmQfr2v** passed hosted tests
before promotion. Both apex and www identify it (www redirects to apex). Hosted
build uses locked Next 16.4.3, separate from older reused local tooling. Previous
frontend **dpl_7HctXP7eYBDvCc9i7TnQsiG9hYgP** is retained.

Backend runtime/schema/scripts have no diff from live source 6f3cf203. Read-only
provider verification found deployment **1597c138-919c-4470-b991-0add596837f9**
ACTIVE 16/16, all four digests matching the retained manifest, readiness 200.
No backend rollout, migration, database write, grant change, backup operation or
new restore rehearsal was performed for this frontend-only package. Earlier safety
receipts remain historical. No payment, booking, AI or support flag was changed.
Favourites/filter implementations and original image files are unchanged; this is
scoped regression coverage, not new real-account acceptance of every other journey.

Hero launch status: **published and verified within the methods above**. Physical
Safari/devices, screen-reader reading and physical background-tab behavior remain
unperformed. Document visibility was simulated. No owner decision remains for this
scope. Other audit work, including authenticated service-description authoring,
retains its separate status. The hour-boundary update at 12:12 UTC recorded the
verified release and remaining screenshots/receipt/cleanup; final public screenshots
completed 12:14 UTC. Do not infer whole-site launch readiness from this package.

Temporary preview and in-memory fixture stopped; ports 3102/5023 no longer listen.
Task-only provider cookie/state and access configuration removed after testing.
Final disk preflight: 24.85 GiB free; the 20 GiB reserve passed. No Docker resource
was created or deleted. Useful dependency/build caches, evidence, source and
current/rollback releases are retained. This is a preflight, not an OS quota.
