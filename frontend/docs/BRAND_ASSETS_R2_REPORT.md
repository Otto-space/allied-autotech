# Revision 2 brand assets and interaction verification

Implementation: `feat/brand-assets-r2-20261026`, in the existing
`allied-shop-vehicles-r2-20261025` worktree, based on `ce3121b8` / released runtime
`d6d8534d`. Both production domains were read independently and still identify
`dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD`. This revision is local, not deployed.
Other worktrees, including newer workforce work and Desktop tracker edits, are
preserved. No database or operational-policy change is part of this revision.

## Asset placement and provenance

All nine owner-supplied PNGs were read, hashed and visually inspected. Exact source
hashes, sizes, transparency, dimensions, derivative paths, descriptions, placement
and restrictions are maintained in [brand-assets-manifest.json](brand-assets-manifest.json).
Original Downloads files and the previously committed campaign PNG are unchanged.

| Surface                                   | Before                                         | Revision 2                                  | Reason                                                                                |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Home service introduction                 | Generic editorial workshop image               | Ad 2, complete portrait                     | Supplied Allied campaign replaces weaker generic brand imagery beside actual services |
| Home trust feature                        | Ad 2 repeated from About                       | Ad 1, complete trust composition            | Distinct artwork and HTML trust message; existing principles and next action retained |
| About introduction                        | Full-size Ad 2 PNG                             | Responsive Ad 2 WebP derivatives            | Same approved composition, much smaller mobile transfer, no invented identity         |
| Services workmanship                      | Generic parts still life                       | Ad 3, complete mechanical-work composition  | Relevant workmanship message after the service catalogue; no interruption to search   |
| Header/mobile/authentication              | Previous red symbol                            | Supplied transparent red variant, trimmed   | Shared sizing and original wordmark retained                                          |
| Footer/dashboard desktop and mobile shell | Red symbol on inverse surfaces                 | Supplied transparent white variant          | Clear inverse identity, no opaque square                                              |
| About principles                          | Red symbol                                     | Supplied transparent black variant          | Restrained identity on white                                                          |
| Opaque white/black and dark/red variants  | Not integrated                                 | Optimised, catalogued, available but unused | Avoid background seams; transparent counterparts suit current shells                  |
| Shop / Ad 4                               | Existing truthful products/collection guidance | Graphic withheld; no public derivative      | Nationwide-delivery claim contradicts supported fulfilment                            |

No real product/listing photograph, private media record, fitment evidence, equipment
photograph, favicon, email identity or social-preview pipeline was replaced. No tall
posters were added to dashboard tables/forms/conversations. No new marketing section
was needed: replacing four existing placements preserves the established page flow.

## Delivery decision

The approved launch guidance still specifies workshop collection, with delivery
deferred. `backend/docs/public-launch-policy-decisions.md` lists delivery zones,
fees/timing and collection of courier charges as unapproved. The executable
`backend/src/modules/orders/orders.service.ts` rejects delivery, and
`orders.schemas.ts` accepts collection only. The public policy contract explicitly
states delivery remains disabled even if historical delivery policies exist.

Ad 4 therefore has **no customer-facing derivative or placement**. No editable
layered source was supplied. Its truck composition is not proof of an owned fleet.
We did not obscure the unsupported wording, use a contradictory disclaimer, invent
delivery operations or redraw the logo. Remaining asset dependency: a clean approved
parts/enquiry/workshop-collection artwork replacing the nationwide-delivery wording.
This dependency prevents claiming all four advertisements are integrated; the other
brand integrations are implemented independently.

## Production derivatives

`node scripts/prepare-brand-assets.mjs <supplied-directory>` uses the installed
Sharp pipeline, reads originals without modifying them, and produces the manifest.
No generative editing, masking, recolouring, filters or invented layers are used.

- Five logo crops: x334/y356, 397×349. Full 361×313 symbol plus 18px clearspace on
  every side. Decoded pixels compare exactly with the same source region for all
  five variants. Each PNG is approximately 3.4–3.7 KB.
- Three posters: full 4:5 composition at 480, 800 and 1080px widths; WebP quality 88.
  Small derivatives are 28,350 / 54,604 / 58,838 bytes versus 2.95 / 3.33 / 3.53 MB
  originals. All 14 derivatives together total 2,119,539 bytes.
- Native responsive `srcset` selects the derivative without double compression.
  Explicit dimensions and aspect ratios reserve layout; all below-fold artwork is
  lazy. Only the About first-view portrait is eager/high priority.
- HTML headings, explanations and real links remain usable when an image is missing.
  The fallback also checks errors that occur before React hydration.
- Source colours #DE1F26, #06181F and #040707 are explicit brand primitives. Existing
  accessible action, focus, status and surface pairs remain unchanged; logo pixels
  are never recoloured to match a functional button token.

## Interaction coverage and observed corrections

The original [colour report](COLOUR_AND_STATE_REPORT.md) and its 106-route inventory
remain the baseline. That record contains historical 324-case browser acceptance,
not a claim that every case was rerun in this revision. The refreshed source census
has 106 routes / 142 stylesheets and 30 passing contrast pairs.

New browser acceptance covers complete artwork at 360, 390, 768, 1024 and 1440px;
real pointer hover; native keyboard Tab and Enter; mobile touch navigation to Shop;
missing images; held/slow image requests; reserved frames; accessible equivalents;
and no horizontal overflow. Shared state-gallery tests exercise pressed, disabled,
selected, checked, indeterminate, invalid+focus, hover+focus, modal keyboard,
forced-colours and reduced motion. Customer/Admin/Super Admin fixture dashboards and
authorised customer-care/workforce fixtures retain their permission boundaries.

The previously unexecuted three cart cases now have an isolated local full-mode
fixture. Initial failures identified an unavailable first fixture product and a
real Strict Mode lifecycle bug: a queued cleanup close event dismissed the reopened
dialog. The fixture now selects an available synthetic product, and the close
handler ignores cleanup events while the dialog is open. Focus restoration and
drawer accessibility are verified without real cart writes. Production commerce
configuration is unchanged.

Browser plugin is unavailable; repository Playwright with installed Microsoft Edge
is used. The fixture API is loopback-only, read-only and nonpersistent. Browser
mutations in account/cart tests are intercepted and never reach a real backend.

## Evidence and checks

Evidence folder: `%TEMP%/allied-brand-r2-20261026/`.

- `supplied-assets.png`, `source-inspection.json`: all nine originals and metadata.
- `derivatives.png`: trimmed variants on appropriate backgrounds and complete posters.
- `home-home-services-{390,1440}.png`, `home-trust-story-{390,1440}.png`,
  `about-about-hero-{390,1440}.png`, `services-services-principles-{390,1440}.png`.
- `about-focus-hover.png`, `about-artwork-failure.png`: real interaction/failure states.
- Prior-release before evidence remains in `%TEMP%/allied-colour-20261026/`, including
  `production-home-1440.png`, `production-about-390.png`, `production-trust-1440.png`.
  A fresh pre-edit dev capture timed out during first compilation and is not claimed.
- `current-production.json`: independent domain identity reads; no promotion.

## Current check results and precise limits

| Check                                          | Result                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend unit suite                            | 1,057 passed, 162 files                                                                          |
| Full lint, then targeted changed-source lint   | Passed                                                                                           |
| Type check and optimized build                 | Passed                                                                                           |
| Changed-file formatting and Git whitespace     | Passed                                                                                           |
| Contrast calculation                           | 30 / 30 passed                                                                                   |
| Nine original hashes / five decoded logo crops | Unchanged / pixel-identical                                                                      |
| Broad fixture browser run                      | 103 passed / 109 executed; six require optimized replay                                          |
| Focused image-failure/cart verification        | Five passed, including the three previously unexecuted drawer cases and Escape/focus restoration |

The six pending cases are listed in [brand-assets-r2-coverage.json](brand-assets-r2-coverage.json):
About 1024px encountered a dev chunk-loading error; mobile Shop navigation and Review
cart navigation did not finish within the assertion window; the three Allie/practice
checks ran with Help & Learn disabled. These failures are not counted as acceptance.
The final optimized build enables Help & Learn for isolated testing only. Its replay
also covers the newly added Home/Services image-fallback and 200% CSS-zoom tests.

Starting the optimized loopback preview was rejected by automatic approval review
with `blocked by policy`, without a further reason. Approval was requested to run
`npm start` at 127.0.0.1:3168 against only the read-only fictional fixture API at
127.0.0.1:5021. The start was not retried through another command or port. This is
an outstanding verification dependency, not a production deployment request.

Local dependencies were reused: Next 16.3.8, while the unchanged lockfile requests
16.4.3. A future deployment must run locked CI and reconcile any newer live release;
this local build is fixture-only and must not be promoted as a production artifact.
No new dependency audit, hosted test, database check or restore was run in this batch.

Firefox and WebKit executables are unavailable. Physical-device, complete screen
reader, native picker/autofill and privacy-restricted visited-link appearance remain
unverified. Emulated touch, reflow, forced-colours and reduced-motion checks do not
constitute complete WCAG conformance. Full route/role/state permutations are not
claimed; the source inventory and historical browser report retain their distinct
scopes. The new section screenshot capture was corrected to avoid fixed navigation
over tall element captures; final clean recaptures await the preview replay.

The supplied artwork and rendered desktop/mobile sections were inspected for logo
proportion/background, full poster message/face/mechanical composition, adjacent
HTML hierarchy, visible real actions, retained white space and preserved catalogue
priority. The original marketing layout is retained, with no invented staff identity
or logistics capability. Ad 4 remains the clean-source/policy-dependent exception.

No Docker image/container/volume was created or removed. Existing resources are
retained for active worktrees and rollback. Latest read-only inventory: 87 images,
13 containers, 14 volumes, 195 build-cache records; none was inferred disposable.
C: post-build preflight measured 27.19 GiB free (point-in-time, not a machine quota).
