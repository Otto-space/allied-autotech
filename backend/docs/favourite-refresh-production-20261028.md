# Product favourites refresh release — 28 October 2026

Runtime **ef06efb7eac0db15661d3c274d05b8758ed3f9e0** is live on both alliedautotech.com and www.alliedautotech.com as **dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv**, READY. Both aliases were independently verified after promotion. Fourteen post-promotion public checks passed.

## Defect and repair

On the owner's Engine Oil Filter URL, ProductActions initialized a local false flag without reading persisted favourites. A successful save therefore lost its Saved to favourites label on reload. This was reproduced against the former live frontend using an isolated customer/collection fixture; no owner's private saved record was inspected.

The product action now reads the existing authenticated owned favourites collection on entry and after session changes. It follows pagination, shows Checking favourites during the read, and offers an explicit retry if the read fails. Failed or incomplete reads cannot assert that a product is unsaved. Changing product resets the action instance; account changes abort late reads. Save still requires the existing role/session/CSRF checks and matching server receipt. No API, schema or browser-storage substitute was added.

## Verification

- 35 focused unit tests passed, including later-page matching, save/remount, external removal, error/retry, product/account changes, malformed/repeated cursors and existing account/launch gates. TypeScript and scoped lint passed. An initial lint invocation from the repository root could not find the frontend configuration; the corrected frontend invocation passed.
- [Final-source frontend CI](https://github.com/Otto-space/allied-autotech/actions/runs/40704788016): **1,080 tests passed**, 12 optional browser-component tests skipped; lint, types, formatting and locked Next 16.4.3 build passed. Production dependency audit found zero vulnerabilities. The broader installation audit reported three development-inclusive findings (two moderate, one high); this release did not change dependencies or resolve those findings.
- [Secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40704788037) and [isolated backend database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40704788003) passed. No local/shared database tests or writes ran.
- **16 final-source hosted browser cases passed**: save then refresh, later-page lookup, removal then refresh, failure then retry, product enquiry/account controls, keyboard focus, Allie/article transitions and navbar geometry across 390–1440px. The favourites journey ran at 390/1440px; identity, saved collections and mutations were synthetic, with unmatched API requests denied. It performed exactly one intercepted save per persistence journey. Final mobile and desktop saved-state screenshots were inspected.
- **14 candidate and 14 production public read-only checks passed** for Home, Privacy, Shop, About, Help, product detail and Allie at 390/1440px. No business mutation or page exception was observed. These public checks do not establish real-account acceptance.

Evidence folder: `C:/Users/PC/AppData/Local/Temp/allied-favourite-refresh-20261028/`.
Receipts include `baseline-results.json`, `merged-hosted-results.json`, `merged-ci.json`, `merged-ci-summary.txt`, `candidate-public-receipt.json`, `production-public-receipt.json`, `promotion-preflight.json`, `production-aliases.json` and `post-release.json`. Screenshots are under `merged-hosted-results`, including `saved-after-refresh-390.png` and `saved-after-refresh-1440.png`. Intermediate receipts are retained with `before-focus-merge-` and `before-navbar-merge-` prefixes.

## Release preservation and recovery

Promotion of the original candidate stopped when another frontend reached production. Published focus source **09efa694** was merged, then published navbar source **4aafaebb** was also merged after a second concurrent release. Each combined candidate was built and verified; no older candidate replaced those changes. One read-only provider preflight failed with fetch failed before promotion; bounded provider reads passed on the successful attempt. The local tracker was temporarily stashed by exact object ID and restored after each merge. Other worktrees and the four pre-existing dirty tracker/asset files remain preserved.

A separate task advanced backend production to **8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650**, image revision **4fbc9cbb**. Its favourites routes/schema/service match this frontend's contract. It remained ACTIVE without a pending deployment and returned readiness 200. This task did not deploy or change the backend. Eight managed backups were verified, newest 2026-10-28T05:22:10Z; retained separate restore evidence from 2026-10-26T19:53:05.533Z passed with equal original-row hashes. Existing off-device encryption/retention/PITR evidence was retained; no fresh restore or migration ran.

Frontend rollback is **dpl_F5XnU2aiSxhtK78P8dnbvrffYCR5**, source **4aafaebb**. Preserve the current backend during any frontend rollback.

## Limits and next work

The owner's private saved item was not inspected or modified. Authenticated acceptance uses isolated fixtures; physical-device and comprehensive screen-reader acceptance remain open. The current API exposes a paginated collection, so more than 100 pages or a repeated cursor yields an explicit incomplete/error state rather than a false unsaved claim. A dedicated per-product read could improve exceptionally large collections in a later backend batch.

The full V01–V55 visual audit remains active. Current-care empty cards (V41), notification preference versus channel-availability clarity (V48), wider vocabulary/layout work and backend audit acceptance are not completed by this repair. Revalidate earlier source-only backend findings against the independently updated 4fbc9cbb runtime before treating those historical restrictions as current. See the visual audit checkpoint for the full ledger and business-data dependencies.

Disk preflights passed before remote uploads and browser checks, using 0.3 GiB and 0.1 GiB growth allowances respectively. No local install/build, Docker build or cleanup ran. Docker inventory: 61 images, 13 stopped containers, 14 volumes and 229 cache entries; all retained because this task created none and concurrent tasks own the resources. Provider-only browser state remains ignored/private. These checks do not guarantee machine-wide free space.

Final C: postflight: **26.73 GiB free**; the 20 GiB reserve plus 0.1 GiB allowance passed.
