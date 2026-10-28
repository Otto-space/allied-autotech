# Allied colour and interaction system — 26 October 2026

Revision 2 local implementation and current verification dependencies are recorded
in [BRAND_ASSETS_R2_REPORT.md](BRAND_ASSETS_R2_REPORT.md). It adds the supplied asset
variants, preserves the original colour system, and exercises the previously open
cart-drawer cases. The records below are historical, not a claim that all tests were
rerun or that Revision 2 has been deployed.

Production update: the owner subsequently authorised deployment. Runtime `d6d8534d`
is live with the newer workforce release preserved. See the
[release record](../../backend/docs/colour-production-20261026.md) for exact CI,
hosted/live checks, harness corrections and rollback identity. The local implementation
record below remains historical evidence for the original colour batch.

## Scope and source

Branch: `feat/colour-states-20261026`, based on `3cea520f` (deployed runtime
`8c11c3a0` plus its QA record). The separate workforce W3 worktree and the owner's
Desktop checkout edits are preserved. This is a presentation change; no backend,
permission, session, draft, database, transaction or delivery behaviour is changed.
Publication is outside this brief's current execution boundary.

The owner's `allied-color.jpeg` supplies the black/red/white direction. Its hiring
copy is not website content. Instagram was throttled during read-only discovery;
no scraping, hotlinking or asset publication was used. Existing approved images,
including the exact Home/About campaign PNG and genuine workshop/equipment imagery,
remain intact. No generated staff, facilities or product imagery is shipped.

## Maintained system

`app/colour-tokens.css` is imported by the existing global stylesheet. Variables
live on `:root`, including native dialogs and body-mounted portals. Tailwind v4's
existing `@theme inline` aliases resolve to these same variables. There is no
second theme provider or new user-facing dark-mode setting.

| Family              | Values / application                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Primitive brand     | Black `#080C0F`, charcoal `#101419`, red `#D71920`, deep red `#650C12`                          |
| Primary action      | White on red; hover `#B51218`, pressed `#950E14`                                                |
| Secondary / ghost   | White or transparent; pale-red hover, stronger pale-red pressed                                 |
| Destructive         | Explicit destructive label/context plus dark error red; existing confirmations preserved        |
| Inverse             | White and light grey on black/deep-red; inverse links `#FF7378`                                 |
| Selection           | `#FFE6E8` with `#950E14`, persistent indicator/weight and existing ARIA state                   |
| Native checked      | `accent-color: var(--checked)`; native mark, keyboard and disabled semantics retained           |
| Focus               | 3px black outline, 3px offset, white separating halo; system Highlight/Canvas in forced colours |
| Disabled / readonly | Separate readable neutral pairs; readonly remains selectable                                    |
| Status              | Labelled green success, amber warning, blue information, red failure, neutral closed/unknown    |
| Data series         | Red bookings, charcoal dashed orders; labels and accessible data table retained                 |

Compatibility aliases (`--brand-red`, historical `--blue`, etc.) prevent divergent
systems. Historical `--blue` means primary action, not informational status.
Status mappings retain their original meaning: provider `SENT` is information,
not delivery success; `CLOSED` is neutral. Toast success/warning now use the same
semantic roles instead of black borders.

Gradients are limited to brand surfaces: campaign section, About/catalogue heroes,
editorial invitations, auth editorial panels, dashboard sidebars/drawers and Allie's
header. Data tables and forms stay white/light. Hero imagery retains a stable dark
scrim and its subject/crop; no red photo wash or animated gradient was introduced.

## Inventory and precedence

- `colour-state-inventory.json`: all 106 page routes, audience boundaries, imported
  components, reachable stylesheets and remaining literal-colour census. This is
  source evidence, **not** a claim of runtime acceptance for every role/state.
- `colour-state-migrations.json`: 151 existing authored focus/accent consumers
  migrated at their source, including CSS modules and portal components.
- `colour-contrast-report.json`: reproducible opaque foreground/background checks,
  including inverse gradient endpoints and meaningful control boundaries.
- `scripts/colour-state-audit.mjs`: regenerates the route/dependency census and
  contrast report; exits unsuccessfully for a failing checked pair.

Focus rules are corrected locally, not forced through global `!important` button
overrides. Hover preserves focus; selected action styling outranks primary hover;
disabled primary controls do not gain hover treatment; invalid borders coexist
with focus. Native checkbox/radio interactions and indeterminate state are retained.
Inline `.text-link` controls remain underlined. Existing copy reveal uses hover,
focus-within and coarse-pointer rules without changing clipboard behaviour.

## Verification checkpoint

The browser-only gallery in `tests/e2e/colour-states.spec.ts` renders compiled
application styles; it creates no public debug route and contains no live data.
It exercises pointer hover/down/up, Tab, radio arrows, checkbox Space,
indeterminate selection, invalid focus, readonly/disabled controls, native dialog
Escape/return focus, forced colours, reduced motion and 360/390/768/1024/1440 reflow.
The real Allie tests intercept only an explicitly public reviewed article and
verify failure/retry, a useful answer, focus and Escape with zero mutation requests.

Development checks caught and corrected a later sidebar background override and
control-border contrast on the grey canvas. Wider acceptance uses the optimized
build, avoiding development compilation timing as evidence of a release defect.
Final commands/counts and route coverage are appended after execution below.

Evidence directory: `%TEMP%/allied-colour-20261026/`. Retained screenshots and reports
contain synthetic records only. Browser automation uses the repository's Playwright
driver and installed Edge; no additional browser download is required.

## Design comparison ledger

| Check       | Reference and implementation decision                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Composition | Existing approved Home/About structure and geometry retained; no new panels or page hierarchy                    |
| Gradient    | Owner's black/red blend translated to a reusable dark gradient; bright red reserved for measured accents/actions |
| Typography  | Existing Nippo display and Quicksand interface fonts retained; no invented marketing copy                        |
| Imagery     | Original campaign PNG retained byte-for-byte; generated concept is visual guidance only, not production content  |
| White space | White header/content, operational tables and form surfaces remain prominent                                      |
| Focus       | Real keyboard screenshot shows the white separating halo and black outline on the red Allie send action          |
| Mobile      | About image remains complete; Allie uses its existing mobile sheet with readable header and controls             |

## Boundaries and exceptions

- Green, amber and blue status roles remain intentional; photography, external
  identity marks and truthful support audience distinctions are not recoloured.
- Existing decorative neutral literals remain in local stylesheets, recorded in
  the inventory. They are not independent new brand palettes.
- Browser/OS pickers, autofill and visited links have platform/privacy boundaries.
  Computed CSS is not proof of visited rendering. No physical-device, full screen
  reader or authenticated production acceptance is claimed.
- Forced-colour emulation is evidence for this installed browser only. Firefox
  and WebKit availability is checked separately; no unsupported cross-engine claim.
- Existing Allie is content based, with generative AI off. Streaming AI and live
  human takeover are absent capabilities, not states this colour patch adds.
- No production database commands, real customer messages, payments, fitment
  approvals or account suspensions are required for this change.

Contrast methodology follows [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
Flat-colour calculations do not certify image-backed compositing or complete WCAG conformance.

## Final verification and coverage

Local implementation accepted on 26 October 2026. No push or deployment was performed.
The installed frontend is Next 16.3.8; the lockfile specifies 16.4.3. Existing verified
dependencies were reused, so locked-version CI remains a separate release check.

| Check                                 | Result and qualification                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                        | Passed; subsequent test/report edits also passed scoped ESLint                                                   |
| `npm run typecheck`                   | Passed                                                                                                           |
| `npm test -- --reporter=dot`          | 1,053 tests passed in 161 files; see `unit-tests.log` for the executed script output                             |
| `npm run build`                       | Optimized build and standalone preparation passed; final build uses `browse_enquiries` and enabled Help & Learn  |
| `node scripts/colour-state-audit.mjs` | 106 routes, 141 stylesheets; 30/30 measured contrast pairs pass                                                  |
| Browser acceptance                    | 324 distinct passing cases in 118 specifications; no unresolved executed case; three explicitly skipped cases    |
| Final focused checks                  | 23 dashboard/Allie/state/audit cases, the native-control case, 18 Shop/Vehicle cases and 19 About cases accepted |
| Static review                         | Changed-file formatting and `git diff --check` pass; no remaining unreviewed blue focus/accent rule found        |

`colour-browser-coverage.json` lists every case and its attempts, including initial
failures and the accepting rerun. Regenerate with
`node scripts/colour-browser-report.mjs <retained-evidence-directory>`.
Successful cases in interrupted batches are counted individually, never as a passing
whole suite, and reruns are deduplicated. Raw reports/logs remain in the evidence directory.

The broad route sample used an isolated **full-mode** build to exercise existing
transaction surfaces; this did not change the production launch policy. The final
build and public/Allie/selected-navigation checks used **browse_enquiries**. Fixture
mutations were intercepted; no backend/database operation or real customer action ran.

| Surface / role                                     | Exercised state coverage and evidence                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public Home, About, Services, Shop, Vehicles, Help | Hero/white-content contrast, navigation/disclosures, filters, checked controls, loading, empty/no-match/error/retry, query history, draft conflicts; `brand-refresh`, `home-quality`, `about-quality`, `shop-vehicles-r2` |
| Authentication / account security                  | Form reflow, validation, focus, recovery and MFA fixtures; authentication quality/security specifications in the case ledger                                                                                              |
| Customer dashboard                                 | Actual sidebar/current focus, charts, Garage, profile, saved items, Care, notifications and source-only transaction journeys; customer specifications in the ledger                                                       |
| Admin / Super Admin                                | Actual branded navigation, customer tables/details/copy, account confirmation, finance/inventory/policy/editor forms; `colour-states`, `customer-care-quality` and `work-*` specifications                                |
| Authorised workforce                               | Scoped directory, bookings, enquiries, complaints, jobs, finance, orders and notifications; `workforce-*` specifications. Existing capability fixtures are retained; this is not every real responsibility combination    |
| Buttons and links                                  | Pointer rest/hover/down/up, focus+hover, selected and disabled precedence, inverse context, underlined inline links; `colour-states`                                                                                      |
| Native inputs / controls                           | Checkbox Space, radio arrows and checked+focus+hover, indeterminate, invalid+focus, readonly, disabled; select/filter interactions in Shop/Vehicle and admin forms                                                        |
| Tables and overlays                                | Customer table selection/copy, clipboard failure fallback, review/cancel, persistent delivery dismissal, dialogs, Escape and return focus; `customer-care-quality`, `audit-actions`, native gallery                       |
| Allie / practice                                   | Public-content answer, 503/retry, keyboard close, selected practice response, specific feedback and zero mutation requests; `colour-assistance`                                                                           |
| Accessibility preferences                          | Scoped Axe checks, forced colours, reduced motion, touch/coarse-pointer fixtures and doubled-text reflow; no complete WCAG or screen-reader certification                                                                 |

Required widths 360/390/768/1024/1440 were exercised, with additional 320 through
1920px cases. Browser: Microsoft Edge 156.0.4314.42, Chromium engine, Windows,
headless. Firefox and WebKit executables are not installed. Native OS menus,
credential autofill, visited-link paint and physical-device behaviour remain manual
acceptance items. There is no existing application switch component to invent a
new state family for; native ranges retain platform semantics and the shared accent.

The three skipped opt-in cases are `cart confirmation fits 390px`, `cart confirmation
fits 1440px` and `drawer accessibility at 390` in `cart-drawer-quality.spec.ts`.
They require its separate catalogue/full-transaction setup; that setup was not enabled
in the broad run. The final enquiry-only build does not expose a live purchase flow.
Other cart fixtures and the shared modal/state gallery passed; these do not substitute
for those three drawer cases. The inventory is source coverage, not a claim that every
route/role/state permutation or every native control was rendered.

Harness corrections preserve product expectations: current customer table/disclosures,
current vehicle-intent labels, valid notification and email-delivery contracts,
bounded duplicate public identity reads, source focus width, and actual mobile form
reflow. Equipment disclosures are opened before checking lazy images. Local populated
SSR does not get its already-open vehicle controls toggled shut; the empty-state test
now explicitly selects empty fixture data. Only the exact Next static-CSS unused-preload
warning is filtered in affected console assertions. All application errors remain checked.
The retained local server also reported a product-schema error for an unmapped
synthetic prefetch while different public fixture servers shared the preview origin.
The minimal About fixture returns a collection fallback for unknown detail IDs;
it is not a complete catalogue server. Accepted catalogue journeys use their own
contract fixtures. A globally clean server log is not claimed from these mixed runs.

## Retained visual evidence and final review

Paths are local, synthetic evidence rather than published assets:

- Before: `%TEMP%/allied-brand-release-20261026/home-campaign-1440.png`.
- After: `%TEMP%/allied-colour-20261026/home-trust-1440.png` and `home-trust-390.png`.
- Public hero/white content: `%TEMP%/allied-brand-home-1440-viewport.png`,
  `%TEMP%/allied-brand-about-390-viewport.png` and corresponding full-page captures.
- Shop/Vehicle filters: `%TEMP%/allied-shop-vehicles-r2/shop-390.png`,
  `vehicles-1440.png` and their other tested widths.
- Shared states: evidence-directory `gallery-hover-focus.png`, `gallery-invalid-focus.png`,
  `gallery-dialog.png`, `gallery-forced-colours.png` and `gallery-<width>.png`.
- Actual dashboard fixtures: `dashboard-CUSTOMER.png`, `dashboard-ADMIN.png`,
  `dashboard-SUPER_ADMIN.png`; Allie `allie-390.png` / `allie-1440.png`; practice `practice-390.png`.
- Customer tables/copy: `%TEMP%/allied-customers-care-20261025/` after-captures from the accepted suite.

The generated direction concept and final Home trust-section render were visually
compared: the approved composition, type and original photograph are retained, with
the stronger black/red blend and accessible inverse link treatment. Mobile About,
Allie, practice, gallery and dashboard evidence was also inspected. The campaign
asset SHA256 remains `3e10dfedb37573452328cf573477136f6256f400d35f00b96514d47e1fa08537`.

No assets, dependencies, Docker images or worktrees were duplicated. No Docker data,
current release or rollback resource was deleted. Local task servers are stopped
after verification. Final disk preflight measured 28.13 GiB free; this is a point-in-time
measurement, not a machine-wide quota. Separate workforce work and Desktop edits
remain preserved. Actual AI/human handoff and broader site-completion work remain
their own unfinished scopes, unaffected by this colour implementation.
