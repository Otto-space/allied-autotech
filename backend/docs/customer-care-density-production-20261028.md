# Compact customer care release — 28 October 2026

Runtime **73436a3184e6f589913f73bd85a117441c0d6bc1** is live on both alliedautotech.com and www.alliedautotech.com as **dpl_J3Yv5aJwRGrzwZe6fiUPyeNdd81t**, READY. Both aliases were independently verified after promotion; 14 post-promotion public checks passed.

## Customer experience

The customer overview renders current service, garage vehicle, next booking, quotation/payment, order, inspection and latest update only when those records exist. A successfully loaded empty account has one concise starting point, garage/support links and collapsed Activity history. The existing header retains the service-visit action. A vehicle without current work uses a white summary and explicitly says no service is in progress.

Populated service timelines, exact amounts, requested-time warnings, historical dates/drafts and permitted record links remain available. Missing, malformed, failed or wrong-scope responses remain errors; they cannot produce the new empty state. Account changes discard private care and late responses. No API, schema, operational policy or permissions changed.

The release preserves published Help/Learn source **072e0509**, notification-preview source **1a33815c**, favourites persistence **ef06efb7**, and earlier navbar/focus changes. Guards stopped promotion on concurrent releases; the published changes were merged and relevant checks passed before promotion. Unrelated edits and worktrees were retained; each temporary tracker stash was restored by its exact object ID.

## Evidence

- A fresh 390px live baseline failed as expected: it found three containers holding the repeated empty booking/review/update cards. Its screenshot and failure receipt are retained separately.
- **22 focused units passed**: ten new content-combination/launch cases and twelve overview/history/refresh regressions. Types, scoped lint and formatting passed.
- [Final-source frontend CI](https://github.com/Otto-space/allied-autotech/actions/runs/40715112526): **1,092 tests passed**, 12 optional component-browser cases skipped; lint/types/format and locked Next 16.4.3 build passed. Production dependency audit found zero vulnerabilities. The broader installation audit still reports three development-inclusive findings (two moderate, one high); this batch does not change dependencies.
- [Secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40715112493) and [isolated backend safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40715112523) passed. No local/shared database checks, migrations or customer-data writes ran.
- **25 final-source hosted cases passed**: compact care at 360/390/768/1440px, mixed/populated records, native keyboard/hover focus, garage navigation, history dates/drafts, Saved actions/errors, malformed/wrong-scope responses, account invalidation, unread-first notification previews, read actions/counts and precise notification destinations. Sampled Axe and overflow checks passed. Identity and mutations were synthetic, with unmatched API requests denied. Browser plugin was unavailable; existing Playwright/Edge and dependencies were reused.
- **Ten Help/Learn cases passed on the preceding combined candidate**, covering search/modes/disclosures, Allie repetition/revalidation/focus, guide progression/recovery and practice isolation/feedback. The corresponding application/learning source was confirmed unchanged in the final notification-only merge. That earlier run also passed all 19 dashboard cases, for 29 total.
- **14 final candidate and 14 production public read-only checks passed** at 390/1440px, covering Home, Privacy, Shop, About, Help, product detail and Allie without business mutations or page exceptions.
- **Two additional live homepage-help checks passed** at 390/1440px using actual public reviewed content. Explain this page displays the homepage summary and Services/Shop/Vehicles destinations; choosing its topic opens the reviewed answer, explicitly labelled no generative AI. Escape returns focus. The initial test incorrectly expected the article heading before selecting its topic; correcting that test sequence passed without changing runtime code.

Evidence folder: `C:/Users/PC/AppData/Local/Temp/allied-care-density-20261028/`.
Key receipts: `baseline-results.json`, `merged-hosted-results.json`, `merged-ci.json`, `merged-ci-summary.txt`, `candidate-public-receipt.json`, `production-public-receipt.json`, `home-explanation-public.json`, `promotion-preflight.json`, `production-aliases.json`, `post-release.json`. Intermediate runs use `before-learning-merge-` and `before-notification-merge-` prefixes. Rendered evidence includes `empty-care-390.png`, `next-care-1440.png`, `populated-care-1440.png` under `merged-hosted-results`, and `production-home-explanation-390.png`/`1440.png` in the evidence root. Mobile and desktop empty/mixed/populated screenshots were inspected.

## Deployment and recovery

Backend **8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650** stayed ACTIVE, with no pending deployment and readiness 200. This task made no backend deployment. Eight managed backups were checked, newest 2026-10-28T05:22:10Z. Retained separate restore evidence from 2026-10-26T19:53:05.533Z passed with equal original-row hashes. Existing encrypted off-device/retention/PITR evidence was retained; no fresh restore ran.

Frontend rollback: **dpl_71G8rw7VmXo7WZZCDJpvTb5eCMib**, source **1a33815c**. Preserve the current backend during any frontend rollback.

## Resource handling and remaining scope

Disk preflights repeatedly stopped browser/upload attempts below the 20 GiB reserve, before those operations started. Work resumed only after passing checks (0.1 GiB allowance for sequential browser runs, 0.3 GiB for remote uploads). Source edits and small no-cache component checks continued during the earlier blocked period. npm cache verify later verified 3,523 entries/1,939,229,827 bytes; it reported no reclaimed-blob count, so no freed-byte total is attributed to it. Available space changed independently during concurrent tasks. No local build/install, Docker build/prune, worktree deletion or application-data cleanup ran. Final Docker inventory: 65 images, 13 stopped containers, 14 volumes, 231 cache entries; retained because this task created none and other releases are active. Provider-only browser state remains ignored/private.

V41 empty-state density and V04 public homepage explanation now have released sampled evidence. This does not complete V01–V55. V48 preference versus channel-readiness clarity, broader typography/actions/layout findings and comprehensive role/device acceptance remain open. V54's formatter and call site were found in the independently published 4fbc9cbb backend image, but actual signed-in session rendering has not been verified. Historical source-only notes should not be treated as the current backend state. Authenticated dashboard acceptance in this report uses fixtures; no owner's private account was inspected. Physical devices and comprehensive screen-reader acceptance remain unverified.

Final C: postflight: **27.74 GiB free**; the 20 GiB reserve plus 0.1 GiB allowance passed. This is a measured checkpoint, not a machine-wide guarantee.
