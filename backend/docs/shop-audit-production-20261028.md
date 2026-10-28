# Shop visual-audit frontend release — 28 October 2026

Runtime **552ee418624075ca0e4c6c15a44da5e7b1affa70** is live on both alliedautotech.com and www.alliedautotech.com as **dpl_79uCiatbRsCvM2jtPJkwsx53efpP**, READY. Both aliases were independently verified after promotion and public smoke checks. This is a bounded batch within the active V01–V55 audit.

## Changes and preservation

- Search precedes optional vehicle selection. One searchable category picker replaces duplicate shortcuts; query, sort, cursor, history and deep-link contracts remain intact.
- A confirmed empty vehicle catalogue offers a context-preserving enquiry. Failed reads retain retry; existing vehicle selections remain editable. Product details do not advertise vehicle selection without available choices.
- Empty brand suggestions use a plain text field with manual-entry guidance. Product types receive readable display labels without changing API values; viscosity labels use customer language.
- Product breadcrumbs say Shop and navigation says Collection, retaining the product-delivery fragment. Enquiry is primary; WhatsApp and sign-in are secondary. Duplicate assistance is removed; collection enquiries preserve product context. Missing-photo placeholders are bounded at 180px without invented imagery.
- Concurrent production updates fbb6565a (mobile support/navigation) and 9f9311cf (enquire first, confirm collection before visiting) were merged. Promotion correctly stopped when the live alias advanced; the newer release was preserved.
- Backend **79d7a0ac-4e83-4b73-ae46-40af4731a604** remains ACTIVE, readiness 200, no pending deployment. No database, worker, provider, grant, payment or customer-record change was made.

## Verification

- [Exact-source frontend CI](https://github.com/Otto-space/allied-autotech/actions/runs/40673723280): 1,072 units, lint, types, formatting and Next 16.4.3 build passed. Twelve optional component-browser cases were skipped by this CI command. Production dependency audit: zero vulnerabilities. The full development dependency installation summary still reports three findings (two moderate, one high).
- [Secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40673723234) passed. Identical backend source passed [isolated database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40669191871). No local/shared database test ran.
- Eight final-source hosted cases passed at 390/1440px: empty brand/manual filters, product-type values, keyboard focus while hovering, Escape/focus return, category search/sort/cursor/history, available/empty/failed vehicle choices, selection preservation, enquiry links, Collection anchors/current policy, simulated favourites and role-change enforcement. Synthetic mutations were intercepted; unmatched endpoints denied. Sampled main-content Axe scans passed.
- Ten retained-navigation cases passed on the earlier e1c8cdce candidate at 320/390/768/844-landscape/1024/1440. Those shared components are unchanged in the final source; this is separate from final-source acceptance.
- Fourteen final-candidate and fourteen live public checks passed: Home, Privacy, Shop, About, Help, product detail and Allie at 390/1440, with no attempted mutations, page exceptions or document overflow. Image loading, numeric typography, stock wording, Privacy contents and three-slide navigation were checked.
- The first CI failure was a stale sign-in-label expectation. The updated ten-case account suite also checks the login return destination and secondary link treatment. A focus test initially used programmatic focus after pointer input; native Tab/Shift+Tab now checks the actual keyboard state before hover.
- Eight managed backups were verified, newest 2026-10-28T05:22:10Z. Retained separate populated restore evidence from 2026-10-26T19:53:05.533Z passed with equal original-row hashes. No fresh restore ran. Provider [features](https://docs.digitalocean.com/products/databases/postgresql/details/features/) and [recovery guidance](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/) were rechecked for encryption, automated managed backups, seven-day retention and PITR. This is not a fresh physical PITR exercise.

## Evidence and rollback

Evidence: `C:/Users/PC/AppData/Local/Temp/allied-shop-audit-20261028/`

- hosted-results.json (8), viewport-results.json (10), final-ci-summary.txt
- candidate-public-receipt.json and production-public-receipt.json (14 each)
- promotion-preflight.json, production-aliases.json, post-release.json
- production-shop-settled-390.png, production-parts-1440.png, production-product-390.png, production-product-1440.png
- hosted-results contains focused Shop-control/product screenshots; mobile/desktop renders were visually inspected.

Rollback frontend: **dpl_68bNV74wNajB9vW1Ly85nzmmdEvU**, source 9f9311cf. Preserve the current backend during rollback. Earlier staged candidates were not promoted to the custom domains.

## Disk incident and remaining work

A preflight reported 19.21 GiB free, but the PowerShell command continued into a remote Vercel upload because it lacked an exit-code guard. Further local build/test writes stopped; subsequent substantial commands explicitly stop on preflight failure. The candidate had finished remotely; custom domains were not switched then. Automatic approval review rejected bounded webpack-cache cleanup with "blocked by policy"; no files were deleted or alternate deletion method used.

Sampled browser profiles were 12–14 MB and evidence under 1 MB. Remaining checks ran sequentially without tracing under a 0.1 GiB growth allowance, preserving the 20 GiB reserve check. Free space recovered independently to approximately 21.95 GiB. No Docker resource changed through this task. Concurrent inventory changes are not claimed as our cleanup.

A later combined documentation/cookie-cleanup command was also rejected with "blocked by policy". Documentation was completed separately without deletion. The task-owned provider-browser cookie file remains in the existing ignored backend/ops/digitalocean/.private folder; it contains provider access cookies, not application customer sessions. No credentials are committed or printed.

V20 remains partial: the settled live Shop's first card starts at y=818.36 in a 390×936 viewport, with its details still low behind the fixed support dock. More compact initial orientation is needed. V23 remains partial for wider shared fitment wording. Missing actual photography, catalogue choices and authored equipment grammar remain business-data dependencies; no dummy records or unapproved delivery claims were published.

The broader audit, source-only backend session-label/homepage-help changes, actual production-role mutations, physical devices, Firefox/WebKit and complete screen-reader testing remain open. Four pre-existing dirty tracker/asset-report/inventory files and other worktrees are preserved.
