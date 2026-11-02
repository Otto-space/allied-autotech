# Homepage photographic hero ? implementation ledger

Package start: 2 November 2026, 11:12 UTC; target within 60 minutes.
Scope: the final hero-specific instruction. Broader audit work and the published
vehicle-permission repair remain separate. No separate audit attachment was found;
its path was requested while hero work proceeds.

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

| Requirement                                                            | Implementation/evidence                     | Status                     |
| ---------------------------------------------------------------------- | ------------------------------------------- | -------------------------- |
| Full photograph, directional overlay, clean heading, no split panel    | HomeHero module                             | Implementing               |
| Faces/equipment on phone, tablet, laptop                               | Responsive per-photo focal positions        | Awaiting rendered review   |
| Laptop hover continues, focus/manual pause persists                    | Hover state removed, focus guard retained   | Awaiting checks            |
| Calm seven-second motion, stable loading, bounded fallback             | Existing reducer and updated interval       | Awaiting checks            |
| Touch, wrap, reduced motion, visibility, offscreen, slow/failed images | Affected browser regression suite           | Awaiting checks            |
| Long headings, larger text, contrast, CTA/support clearance            | Content-driven dimensions and 44px controls | Awaiting checks            |
| Preserve favourites, filters, radii and destinations                   | Scoped hero patch                           | Awaiting regression review |

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
harness failure; final complete-suite verification is in progress.

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
