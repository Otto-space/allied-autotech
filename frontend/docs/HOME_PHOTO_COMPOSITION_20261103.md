# Home photographs, typography and copy — 3 November 2026

Scope: latest owner brief sections 6.4–6.6. This explicitly replaces the earlier
whole-hero photograph/overlay direction. Commerce activation and other agents'
guest-purchase/aftercare work are excluded.

## Source and historical comparison

Isolated branch `codex/home-photo-composition-20261103` starts at master
`57d58e0d12c334c023fa1307b7f44013c4008de7`. Desktop's dirty hero and the active
master worktree's unrelated edits were preserved. Existing dependencies are reused
through a junction; no dependency installation or duplicate production build.

Inspected historical hero `3b0c353cb263008f6521229d8f965802d9942f1c` and targeted
hero revisions `2e1bb97e`, `fee9d908`, `67b8cc3a`, `a1b8ce45`, `037853ba`,
`80a967e3`, `b9162cc4`. The older AI-image composition also used backgrounds;
it does not prove an exact remembered split-layout design. Retained its direct
hierarchy and restrained brand accents, not obsolete actions, AI workshop imagery,
four-slide campaign structure or repeated slogans. Current genuine photographs,
header/logo, permissions, catalogue identities and enquiries remain authoritative.

## Composition and fidelity decisions

- Laptop: copy and photograph share a 1200px container, with a generous 57.5%
  media column after the gap. Mobile/tablet below 880px stack copy, CTA, image,
  then controls. No full-screen minimum height or text overlay.
- Natural 3:2 media keeps technicians, vehicle and equipment visible. A 1px
  border, modest radius and restrained shadow frame the photograph. The small
  black/red rule is outside the photo; no tint or filter.
- Intrinsic overlapping text grids reserve the longest copy without a fixed
  height and reflow with enlarged text. Inactive groups are hidden and inert.
  Only the active slide has an H1. A scoped title selector prevents late public
  H1 rules from changing its metrics relative to hidden slide titles.
- Existing reducer, atomic decoded-image transitions, timeout/skip recovery,
  focus pause, persistent explicit pause, hover rotation, offscreen/background
  suspension, swipe direction discrimination and reduced motion are preserved.
- Compact visual indicators retain 44px targets, explicit slide labels, visible
  focus, play/pause and previous/next actions.
- The generated concept was a composition reference only. Its invented logo,
  navigation and booking action were intentionally excluded. Actual local fonts,
  existing header, capability-aware destinations and genuine photos take priority.
  Comparison points: text/image separation, image prominence, mobile reading order,
  restrained brand accent and compact accessible controls match the concept.

## Copy before / after

| Area              | Before                                                                                                                                                   | After / reason                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnostics hero  | Comprehensive diagnostics. Clear next steps. / A full vehicle health check, a PDF scan result and clear advice on what comes next. / Explore diagnostics | Understand your vehicle’s condition. / Comprehensive diagnostics, with scan results explained by our team. / View diagnostics             |
| Wheel hero        | Wheel care. A considered approach. / Explore four-wheel alignment and discuss the tyre care your vehicle needs. / Explore wheel care                     | Keep your wheels in line. / Four-wheel alignment and tyre maintenance for your vehicle. / View wheel care                                 |
| Team hero         | Careful work. People you can meet. / See the people, tools and working approach behind your vehicle care.                                                | See where the work happens. / Meet our technicians and see the equipment at our Port Harcourt workshop.                                   |
| Task entry        | How can we help?                                                                                                                                         | Choose what you need                                                                                                                      |
| Services          | Explore our services, repeated introductory advice                                                                                                       | Featured services; View all services; redundant introduction removed                                                                      |
| Equipment         | Inside the workshop, generic introduction                                                                                                                | Our workshop equipment; View all equipment; individual captions retained                                                                  |
| Lift              | Our vehicle service bay, kicker and three reassurance rows                                                                                               | Underneath the vehicle. Our two-post lift gives the team access beneath your vehicle for checks and maintenance. Principles link retained |
| Team section      | The people behind your vehicle care, repeated introduction                                                                                               | Meet the Allied team; Meet the team; all seven people remain visible                                                                      |
| Shop              | Parts, oils and automotive essentials, repeated Shop introduction                                                                                        | Parts, oils & essentials; Browse the Shop; redundant introduction removed                                                                 |
| Oil discovery     | Browse engine oils and ask about suitability.                                                                                                            | Check oil grades and specifications.                                                                                                      |
| Vehicle discovery | Explore our vehicle listings / Compare vehicle details or share your requirements with our team.                                                         | Find your next vehicle / Compare vehicle details or tell us what you are looking for. / View vehicles                                     |
| No vehicles       | Internal publication wording                                                                                                                             | No vehicles are currently listed online. Tell us what you are looking for.                                                                |
| Reviews           | Publication terminology                                                                                                                                  | Experiences shared by customers of Allied AutoTech. Genuine empty/error/retry behaviour preserved                                         |
| Oil illustration  | Illustrative oil-service photograph.                                                                                                                     | Illustrative oil-service image. Matches the actual illustrative source                                                                    |

Necessary repetition is retained: canonical service names, diagnostics identification,
consistent destination labels and the business name. The diagnostics card retains
its distinct PDF-result detail; its sentence is not copied into the hero. Equipment
captions explain tools. FAQ answers, contact details, prices, collection conditions,
vehicle faults and privacy conditions remain intact. The motto remains in the footer.

## Typography

Reuses the registered local fonts through `--font-heading` (Nippo) and
`--font-body` (Quicksand). Concrete conflicting heading selectors and shorthands
are corrected across public, auth, Help/Learn and dashboard styles, including late
brand rules and dialogs. Heading weight is generally 500. Tables, record values,
navigation, forms and controls retain Quicksand. Codes use tabular numeric styling
within the body family. Logo lettering and icons remain unchanged. No universal
font override, extra font download or `!important` chain was added.

## Image pipeline investigation

Existing provenance manifest `workshop-asset-manifest.json` records the approved
5616×3744 originals `IMG_3267.jpg.jpeg`, `IMG_3532.jpg.jpeg`,
`IMG_3412.jpg.jpeg` and original hashes. All three existing WebP derivatives were
inspected: 1600×1067, approximately 125/127/179 KB. Original files were not rewritten;
original hash provenance is manifest evidence, not a fresh original-file verification.

The old full-background cover crop and overlay discarded visible context. The new
frame follows the source ratio and removes that overlay. Responsive `sizes` now
matches the actual grid (667px maximum media width). The first image is prioritised;
later images prepare after hydration. No indiscriminate quality increase.

Actual local optimizer response bodies were decoded with Sharp, beyond browser
naturalWidth: all slides deliver 750×500 at 390px/DPR2 and 1366px/DPR1 (46,610 /
41,366 / 48,160 bytes). At 1366px/DPR2, requests select 1920w but the optimizer
correctly avoids enlargement: actual bitmaps are 1600×1067 (138,491 / 130,531 /
163,547 bytes). Display areas are approximately 356×237 and 665×443 inside the
frame border. Default quality 75 is retained. A hosted optimizer may differ.

## Verification checkpoint

Final local results: **21/21** carousel cases and **14/14** semantic-font cases
pass. Carousel coverage includes every slide across 320/360/390/430/768/1024/
1280/1366/1440px, two short phones, 200% text reflow, three real-time autoplay
loops, arrows/dots, keyboard/touch, persistent pause, hover, offscreen/background
suspension, revisits, delayed/failing images and no JavaScript. Scoped WCAG
2.2 AA Axe checks pass on `main` at 390/1440px. Font cases use actual public,
sign-in and role-dashboard components, table data, inputs, buttons and Help's
Allie dialog at 390/1366px. These are mocked-role acceptance, not real credentials.

After final formatting and removal of the two remaining internal Shop phrases,
390/1366px layout regressions pass again (2/2). A separate read-only local
fixture harness verifies empty, populated and 503 states, including product retry
recovery, real fault-disclosure rendering and no false inventory in error states.
All eight focused units, final compiler, scoped lint and formatting pass.

All three final mobile and laptop hero screenshots and full-page screenshots
were visually inspected against the live background-hero baseline and the design
concept. Equipment and team images were scrolled into view and decoded before
full-page capture, avoiding misleading lazy-load blanks. Evidence is in local
TEMP: `allied-home-final-{390,1366}-slide-{1,2,3}.png`,
`allied-home-final-{390,1366}-full.png`,
`allied-home-baseline-live-{390,1366}.png`,
`allied-home-photo-delivery-20261103.json`; test artifacts are under
`allied-home-carousel-full-20261103`, `allied-home-font-verified-20261103` and
`allied-home-final-style-20261103`. Images in catalogue/review fixtures are
explicitly synthetic test data. No such data is shipped by these source changes.

The last Shop copy cleanup also removes the entire redundant “Find published
products and their available details in the Shop” note and replaces “No products
are published yet” with “No products are currently listed online. Tell the team
what you need.” The category-image/availability disclosure remains.

Local environment: Windows, installed Edge via Playwright 1.63.0, local Next
16.3.8 / React 19.2.8; repository lock specifies Next 16.4.3. Read-only loopback
fixture backend on 5194, isolated frontend on 3184. Synthetic inventory and review
data never enter a database, public deployment or production availability.

Passed: eight focused hero/review units; TypeScript; scoped component/test lint;
format checks for the core hero. Initial targeted mobile/no-JS rendered checks
passed. Three complete real-time autoplay loops passed. The corrected enlarged-text,
laptop hover/manual/focus pause and 430px stable-height checks pass together (3/3).
The subsequent final matrices pass as recorded above.

Initial-run test harness corrections: review and hero both have carousel semantics,
so enlarged-text scrolling now names Workshop highlights; authentication deliberately
has no Allie widget, so dialog font checks use Help. One hydration warning came from
editing `sizes` during a dev run; final acceptance uses frozen source. A 1px media
border requires a ratio tolerance below 0.01, not an exact bitmap aspect assertion.

Remaining: exact-lock CI, compatible integration and hosted candidate/release gates.
Physical phones, true browser-chrome 200% zoom and a full
screen-reader pass are not claimed. The 200% text-reflow test is separate evidence.
