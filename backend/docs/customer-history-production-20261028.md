# Customer history and Saved items release — 28 October 2026

Runtime **0b5a9b76dedf962e215e666feed7a646923693a8** is live on both alliedautotech.com and www.alliedautotech.com as **dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno**, READY. Both aliases were independently verified after promotion and 14 live public checks.

## Changes

- Customer Activity history now uses a native disclosure below current care. Closing it preserves date drafts. An authoritative all-zero period has one message instead of repeated metrics, a flat chart and empty record panels. Populated history, period filtering and staff analytics remain available.
- The launch restriction is concise and accompanies historical records. Existing summaries remain readable; restricted transaction links remain unavailable.
- Empty saved collections have one browse action. Favourite products and Browse Shop describe the actual scope. Loading, error recovery, pagination, session invalidation and mutations retain their existing contracts.
- Promotion of the first candidate correctly stopped when production advanced. The published Help/Allie/navigation source **0d4dd992** was merged intact with the earlier Shop source **552ee418**. Other worktrees and four existing dirty tracker/asset files were preserved. The exact tracker stash was restored successfully and retained as a small local recovery reference.

## Evidence

- [Exact-source frontend CI](https://github.com/Otto-space/allied-autotech/actions/runs/40680419648): **1,074 tests passed**, 12 optional component-browser tests skipped; lint, types, formatting and locked Next 16.4.3 build passed. Production dependency audit found zero vulnerabilities.
- [Secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40680419233) and [isolated backend safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40680419675) passed. No local/shared database test, migration or customer-data write ran.
- **18 merged-source hosted cases passed**: customer history, existing records, empty/error distinction, date drafts, current-care independence, saved tabs/cursors/error recovery/session invalidation, Help/Allie, guide transitions and login/MFA focus. Identity and mutations were synthetic; unmatched API requests were denied.
- **Two additional native keyboard/focus/hover cases passed** at 320/1440px. Main-content Axe scans and overflow checks passed in the sampled customer journeys. Desktop and mobile screenshots were inspected.
- **14 candidate and 14 post-promotion public read-only checks passed** at 390/1440px, with no attempted business mutations or page exceptions. Authenticated customer acceptance remains fixture-based.
- One merged browser run used the repository root instead of the required frontend working directory. Five fixture-image reads failed with ENOENT. Its receipt is retained; correcting the invocation produced the complete 18-pass run. No runtime change was needed to resolve this harness error.

Evidence folder: `C:/Users/PC/AppData/Local/Temp/allied-customer-history-20261028/`

- `merged-hosted-results.json`, `merged-focus-results.json`, `merged-ci-summary.txt`
- `candidate-public-receipt.json`, `production-public-receipt.json`
- `promotion-preflight.json`, `production-aliases.json`, `post-release.json`
- `merged-hosted-results` includes customer-history, customer-empty and saved-empty screenshots at 390/1440px; `merged-focus-results` retains keyboard/hover captures.
- `wrong-cwd-hosted-results.json` records the failed harness invocation separately.

## Recovery and limits

Backend **79d7a0ac-4e83-4b73-ae46-40af4731a604** remains ACTIVE with no pending deployment; readiness returned 200. Eight managed backups were checked, newest 2026-10-28T05:22:10Z. Retained separate populated restore evidence from 2026-10-26T19:53:05.533Z passed with equal original-row hashes. Existing encrypted off-device backup, retention and PITR evidence was retained; no fresh restore or production migration ran.

Frontend rollback: **dpl_DAgy9emEabtd3H58kWjoBw35EUUc**, source **0d4dd992**. Keep the current backend during a frontend rollback.

V42 and V52 have released sampled acceptance. V41 remains partial: current-care quotation/payment/booking empty cards still need a separate content-aware pass. Full V01–V55 completion, source-only backend session labels/homepage help, actual-role mutations, physical devices and comprehensive screen-reader testing remain open.

Disk preflights explicitly stopped on failure and allowed 0.3 GiB for remote uploads or 0.1 GiB for sequential existing-browser checks. No local build, install, Docker build or cleanup was performed. Other processes changed free space independently. Final Docker inventory was 53 images, 13 stopped containers, 14 volumes and 217 cache entries; all retained because this task created none. Provider-only browser state remains in the ignored private operations directory; no credentials are committed. These checks are not a machine-wide disk guarantee.

Final C: postflight: 20.63 GiB free (20 GiB reserve plus 0.1 GiB allowance passed).
