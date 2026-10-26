# Pending committed changes: production release, 26 October 2026

Runtime **3ccee21a7c1c9e5ac7d78ae690f310428cb0b29c** is live on alliedautotech.com
and www.alliedautotech.com. Release branch: release/pending-commits-20261026.

## Included changes and source reconciliation

- **3500b3a0**: compact customer table in both sidebar states; hidden table/sidebar
  scrollbar tracks with keyboard, touch, focus and navigation reachability preserved.
- **1aaa39a9**: required reviewed revisions on staff status, branch and role changes;
  missing revision 422, stale/conflicting revision 409 under existing locks.
- **38e7df62 / d0272949 / aa54fba8**: current Help/Allie, learning/search/guide and
  in-memory fictional-practice improvements. Allie remains a reviewed-content guide,
  not a generative AI service or an operational action tool.

Actual preceding production adef02f9 was verified against both providers and remains
an ancestor. Existing fitment/media, restored homepage, reviews, notification and
browse/enquiries releases are preserved. Three merges had conflicts only in append
records and the dashboard test list; both records were retained. Generated API
contracts regenerated and matched, including the staff revision requirement and
all 424 operations. No schema or dependency-lock changes. Historical branch tips
were not treated as pending redesigns: their superseded implementations were not
restored. Main-checkout QA/instruction entries already exist in newer form.
Uncommitted work in other worktrees was left untouched.

## Live identities and rollback

- DigitalOcean **e8c5297d-93f5-41e0-97bd-0c7851fa5daa**, ACTIVE, no pending rollout.
- Vercel **dpl_5hGWpdJyGqQgG69dcumqFQ2RU7HQ**, READY, apex/www aliases verified.
- Immutable API / identity / general / migrate digests respectively:
  sha256:7787b5cc943221269f70ac8e1a31b4e4f290a3c1c1d16a44fec0af46287205fe,
  sha256:b5f3aad70f848d7b4a6fe79bbaca36386df623858ab1b25fe2022d72548332bc,
  sha256:abb7909a4d293a645d816e8d5e06366a5676427565e820160ee8c528414f49e4,
  sha256:265ca79ab9a750bcc68f416d906ac04d23c52a5efd7c1355baf204a67749a48f.

Existing-app proposal passed; only the four digests changed. API-only learning flags,
permissions, secrets, component capacities, storage and launch settings were preserved.
The frontend was built with domain promotion paused until matching backend readiness.
The read-only predeploy database job passed. Guards stopped before submission on a
local receipt-name mismatch and a check that incorrectly expected API learning flags
on workers; corrected to actual component scope, without changing configuration.
A promotion attempt also stopped while the provider was still rolling out; it was
repeated only after ACTIVE/readiness and all four digest checks passed.

Retain predecessor backend **1dbceb73-075e-4f41-bd76-deb3daf71354**, frontend
**dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD**, and the preceding fitment/media rollback.
Recheck actual current releases before rollback. Preserve migration 71 and its
history-aware checker. No database downgrade, reset or restore-over-live is needed.

## Verification and precise limits

All three exact-source CI workflows passed: backend safety **40346364524**, frontend
release **40346364612**, secret guard **40346364629**. Local lint/types/OpenAPI and
optimized build/postbuild passed; **1,039 frontend units**, **nine image/runtime
contracts**, a newly created exact-loopback **71-migration replay/db:check** and
**41 integration cases** passed with a restricted DML runtime. Three provisioned
workspace cases remained skipped; they were not run against an application database.
A first test run used wrong guide/practice flag names in the local runner; correcting
those names produced the passing integration run, without application-code changes.

The installed local Next is 16.3.8. Locked CI and the actual hosted candidate built
**16.4.3**; no duplicate dependency install was made to hide the local difference.

**57 distinct browser cases passed on the hosted candidate**: 13 customer-table/
sidebar cases and 44 learning/staff cases, using installed Edge/Playwright. Browser
plugin not available. Widths cover 320-1920px, sidebar states, keyboard/focus, scoped
Axe, responsive/reflow, real isolated API role eligibility, private denial and draft
invalidation. Local preview start was rejected by automatic approval review with
"blocked by policy". No alternate local-start command was used. Instead, the protected
Vercel candidate used existing authorised test access, a host-scoped provider cookie,
page mocks and a GET-only bridge to the isolated API. Unhandled mutations were blocked.
The provider secret was not exposed, added globally to requests or changed.

Temporary test copies preserved all four source files' product assertions; only
imports, first-party hostname classification, infrastructure-cookie retention and
synthetic identity settlement were adapted. Initial localhost-only observation
classified the hosted candidate as external; logout cleared preview access; then
late anonymous responses cleared a newly injected synthetic cookie. The harness
kept only the provider cookie across app logout and awaited outstanding isolated
reads before switching test actors. One guide case passed on an unchanged rerun;
real production guide completion was separately verified with explicit step/readiness
assertions. These are fixture/timing qualifications, not real-role login acceptance.

**22 recorded live checks passed** at 390/1440px: actual health/learning reads,
Home, Help/Allie answers, Parts, completed guide, reviews, administrator sign-in
redirects, removed /demo 404, no page runtime errors or horizontal overflow and no
attempted API writes. Additional www Help rendering and guest private-article denial
passed. Desktop/mobile production screenshots were inspected. Capture/receipt folder:
%TEMP%/allied-pending-release-production-20261026/. Candidate screenshots remain in
%TEMP%/allied-customer-table-20261026/ and %TEMP%/allied-allie-20261026/.

Read-only production db:check passed before/after at 71; exact target/TLS, separate
identities and runtime least privilege were verified. Three checked identity/
notification worker heartbeats were fresh without error. Temporary exact-IP diagnostic
access was removed and original app-only firewall rules verified after both checks.
Eight managed encrypted off-device backups were present, latest 26 October 05:22:11
UTC. Existing retention/PITR evidence and the 25 October 18:03:19 separate restore
rehearsal were reviewed: 89 original tables/ledger preserved, final history 71;
retained archive SHA-256 recomputed and matched. No new restore or physical cloud
PITR exercise ran. No migration, grant change, seed, real account mutation, upload,
message, payment or production business submission was performed by these checks.

Actual authenticated production staff mutations and all operational-role journeys,
physical devices/native zoom and full screen-reader acceptance remain unverified.
Do not represent isolated roles or fictional practice as real account/business data.
Broader site-completion Item 6 and business-policy decisions remain open.

## Retention and cleanup

Reused the existing worktree, dependencies, builder and warm caches. No dependency
install, worktree/profile clone, image archive, persistent test container or volume.
Contract containers auto-removed. Five owned temporary browser source files and the
owned synthetic/preview access-cookie files removed after identity checks. Test API
stopped; shared PostgreSQL/data and other tasks retained. All 13 existing containers
and 14 volumes remain. Docker images 67/12.14 GB -> 71/12.17 GB; cache 7.574 -> 7.66 GB.
The new current images and recent reusable cache remain useful. Current, two prior
rollback, base/tool and other-worktree resources retained; no speculative pruning.
C: postflight measured **28.16 GiB free**, above the 20 GiB reserve. This is a point-in-time
preflight measurement, not an OS quota or physical-reclamation claim.

Private provider, CI, health and browser receipts use the pending- prefix in the
ignored protected operator directory. Subsequent evidence-only commits do not change
the deployed runtime source above. Main-checkout continuity is append-only.
