# Visual audit frontend batch - production release, 27 October 2026

Runtime a1b8ce45eecabb3e88d2e25ab69cd5f6264d59ce is published on both alliedautotech.com and www.alliedautotech.com as Vercel dpl_GKfQv1k4cD5qTKZj3c6LaP8Y4iqz (READY). The production-configured candidate was built with automatic custom-domain promotion disabled, inspected, then promoted after all release gates. Both aliases were independently rechecked after public smoke acceptance.

## Scope and preservation

This is one bounded visual-audit batch, not completion of V01-V55. It releases the overview/Care CSS collision fix, consistent unknown stock wording, focused reply shortcut with preserved drafts, compact references/messages, authoritative bulk unread state, practice/control instructions, numeric and Privacy typography, footer destinations, customer wording and compact homepage composition.

Concurrent live frontend 42855c0d was merged before publishing: workshop address/contact-channel changes and Contact visit-validation fixes remain present. The existing backend deployment 79d7a0ac-4e83-4b73-ae46-40af4731a604 remains ACTIVE, with no pending rollout and read-only readiness 200. No backend image, schema, grant, worker, provider or application record was changed.

The backend session-client labels and reviewed homepage help article are committed but NOT deployed. They must be integrated with the current backend and pass its guarded release process. Frontend compatibility with the older help catalogue is tested: an unavailable contextual explanation is not advertised. Concurrent workforce/Allie implementation in another worktree is preserved and not published by this batch.

## Verification

- Exact-source [frontend release CI](https://github.com/Otto-space/allied-autotech/actions/runs/40478325501): lint, types, Next 16.4.3 production build, formatting, 1,072 passing units; 12 optional isolated browser tests skipped in this CI command. The 12 browser cases were executed separately locally (8 overview, 4 Home). Production-only dependency audit: 0 vulnerabilities. The npm-ci full dependency summary reported 3 development-tree findings; this release does not claim the entire development dependency tree is vulnerability-free.
- Exact-source [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40478325469): passed.
- Same backend source at e925ecec passed [isolated database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40476605252), including migration replay/schema verification and learning eligibility. Final runtime differs only in frontend hero-count code and associated tests/docs. No local/shared database test was run.
- Protected preview: 7 new full-route fixture cases plus 35 adjacent regressions passed. Covers reply keyboard focus/unsent draft/copy, Care-to-overview CSS navigation, Privacy/contents/footer, whole-inbox unread totals, customer tables, Admin/Super Admin/managed Care controls, clipboard failure, disclosure/draft preservation, notice history, notification permission/session/uncertain-response cases, Allie and practice isolation. Browser API calls were confined to synthetic fixtures with unmatched endpoints denied.
- Production-configured candidate: 14 public read-only checks passed at 390/1440px. Post-promotion: the same 14 checks passed on the actual apex domain. Covers Home, Privacy, Shop, About, Help, published product detail and Allie; actual loaded imagery, three-slide keyboard wraparound, bounded campaign, readable numeric/Privacy fonts, availability consistency, contents anchors, zero document overflow, zero page errors and zero attempted mutations.
- Eight current managed backups were listed, newest 27 October 05:22:11 UTC. Retained separate populated restore receipt from 26 October 19:53:05 UTC passed with equal original-row hashes. No new restore was performed. [Provider features](https://docs.digitalocean.com/products/databases/postgresql/details/features/) and [recovery documentation](https://docs.digitalocean.com/products/databases/postgresql/how-to/restore-from-backups/) were rechecked for encryption, automated daily backup, seven-day retention and PITR support. This is retained logical-restore evidence, not a fresh physical PITR exercise.

## Evidence and rollback

Evidence folder: C:/Users/PC/AppData/Local/Temp/allied-visual-audit-20261027/

- audit-journeys-results.json, hosted-results.json, final-ci.json
- production-candidate-public-receipt.json, production-public-receipt.json
- promotion-preflight.json, production-aliases.json, post-release.json
- production-home-390.png, production-privacy-390.png, production-product-390.png, production-trust-1440.png and corresponding desktop/mobile captures

Previous production dpl_JDtwMW41Nk8fxMDP7ak2U6WTwo5h (42855c0d) is the frontend rollback candidate. Preserve the current backend and schema during rollback. Older release dpl_6wmkNSL8eWDvHKKmqafU6rkb9C5k is also retained; do not use it without accounting for the newer Contact/address changes.

Temporary task-owned provider-browser cookie files were removed after acceptance. No Docker resources were created or deleted: 95 images, 13 containers, 14 volumes and 205 cache entries were retained for current/rollback/other work. Latest C: disk preflight was 22.67 GiB free; this is a point-in-time reading, not a machine-wide guarantee.

## Remaining audit work

All 55 findings and precise partial statuses remain in frontend/docs/VISUAL_IDENTITY_AUDIT_CHECKPOINT.md. Next: Shop controls/facets/detail actions and Collection terminology (V20-V26), content-aware customer overview (V41-V43), and the remaining services/About/Contact/Help/profile/garage/privacy findings. Actual product photography and authored equipment wording are unresolved business data, not replaced with invented content. The nationwide-delivery artwork remains withheld. Physical devices, native pickers, Firefox/WebKit, complete screen-reader coverage and production-role mutations are not claimed.
