# Retention policy — local acceptance, milestone 96

Accepted locally for `/admin/retention-policy` on 19 October 2026. The application-wide goal remains active. Next separate route: staff notifications `/admin/notifications`.

## Result

Effective policy, next scheduled version, latest recorded version and history have distinct meanings. The private current-policy endpoint selects effective and scheduled records across all versions independently of the latest 100 history entries. Current rules expose complete period, start event, disposition and legal basis through compact disclosures. History renders rule bodies when opened.

The editor supports 1–20 independently editable rules with explicit add/remove controls and persistent row structure. Category/months and start/disposition pairs use the existing contract; approved legal basis remains full width. Written provenance and optional future Lagos effective time follow the rules. Publication always sends destructiveExecutionEnabled:false. It does not delete/anonymize records, release holds or approve privacy requests.

Fresh identity/version checks precede review and publication. Exact nested settings, effective time, Q13 provenance and approver validate the receipt. Background refresh and reload preserve the original draft base. A newer version requires explicit field reload. An uncertain outcome keeps a minimal actor-bound persistent lock; fresh current inspection and independent reconciliation never replay publication or prove its original outcome.

## Design evidence

Four native baselines at 430/768/1280/1440 were inspected before implementation. Fresh built-in ImageGen concepts and contract corrections precede runtime changes: [audit](work-retention-policy-oct-concepts/audit.md), [specification](work-retention-policy-oct-concepts/spec.md), [desktop](work-retention-policy-oct-concepts/desktop.png), [mobile](work-retention-policy-oct-concepts/mobile.png), [rule editor](work-retention-policy-oct-concepts/rule-editor.png), [prompts](work-retention-policy-oct-concepts/prompts.md). Browser-plugin access was unavailable; the established sequential Playwright/Edge fallback is used.

## Shared draft correction

The shared structure listener could observe a removed button after React detached it, losing its form reference. A microtask scheduled in capture could also run before React's click handler updated the rows. Capture now retains the form/group and schedules the snapshot after the click, checking that the form remains connected. The unsuccessful microtask/flushSync attempts were removed. Eight draft unit cases pass; the repeatable-row case explicitly waits for persisted structure before unmounting. Retention browser checks cover add/remove/reindex/reload, structure-only edits retaining the original version, and minimum/maximum rule limits. Related quotation, work-order and vehicle-condition flows receive focused regression checks.

## Completed checks

Five policy/recovery unit cases and eight shared draft unit cases pass. Exact-receipt negatives include changed retention periods and unexpected nested settings. Six isolated API scenarios cover effective selection outside bounded history, concurrent authorized audited reads, role/MFA/query/CSRF boundaries, revoked sessions in current/publication transactions, stale and invalid/destructive requests, and exactly one Q13 publication with duplicate-base rejection.

The production build and standalone packaging pass, with 16 matching runtime source hashes. Backend typecheck, changed-file lint/format, OpenAPI validation (309 paths), mounted coverage (363 operations plus four infrastructure routes) and generated declarations/inventory pass.

Before isolated writes, the harness verified `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment and restricted runtime. Original 62 users, 55 staff profiles, 223 policy versions, 482 audits, 38 branches and existing complaint/financial/privacy/hold rows remained hash-unchanged. Zero temporary sessions remain. Synthetic fixtures are retained.

No schema/migration, existing-grant, application/shared database, worker/provider, backup/restore, push or deployment operation ran. Unchanged migration replay/db:check evidence is reused. Synthetic test approvals are not business approval. Deployed verification remains open. See [backend contract](../../../backend/docs/retention-policy-workspace.md); optional durable original-request receipts remain ADM-63.

## Production and connected acceptance

All 55 production browser scenarios pass: 23 dedicated retention cases, 29 operational-policy regressions and three affected quotation/work-order/vehicle-condition flows. Seven widths (320/375/430/768/1280/1440/1920) cover current/history/form and review, with 14 responsive Axe scans, three empty/error/denied scans and one additional narrow long-rule review scan. Add/remove/reindex/reload and structure-only version conflicts pass on the production build.

Connected production Edge/Express/PostgreSQL verified exactly two future approvals and two publication CREATE audits. The first validated the receipt, cleared approval metadata and restored success focus. The second response was deliberately lost after commit; reload retained the lock, and current inspection plus independent reconciliation and explicit field reload restored the form without another POST. All 326 original policy versions, 63 users, 56 staff profiles and existing financial/support/privacy/hold snapshots remained unchanged. Current effective policy remained unchanged, no page errors occurred and zero temporary sessions remain. The run recorded 12 privileged READ audits across supporting reads; this is not solely a count of current-policy requests.

Evidence: `C:/Users/PC/.codex/work-retention-policy-production-tests`, `work-retention-policy-shared-tests`, `work-retention-policy-api-tests.log`, `work-retention-policy-api-preservation.json`, `work-retention-policy-build.log`, `work-retention-policy-source-hashes.json`, `work-retention-policy-final*.png/json`, `work-retention-policy-approval-430-approval-viewport.png` and `work-retention-policy-real.json`. Successful API/connected mutations were not rerun. An extra mobile continuation capture used instant scrolling after the first capture caught the page before smooth scrolling finished; no product change was needed.

## Final visual comparison

All three generated concepts and native production screenshots were viewed directly in final QA. Native 430/768/1280/1440 viewports, the full desktop page, mobile rule editor and bottom approval continuation pass without overflow or page errors. Contract-corrected differences are deliberate and recorded in the specification.

| Comparison point         | Concept and implemented result                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hierarchy and navigation | Compact title/Refresh, real ordered-list breadcrumb with ChevronRight, current-page semantics and the established Allied shell.                                                   |
| Desktop composition      | Unequal 38/62 current/editor columns; paired category/months and start/disposition fields, with full-width legal text.                                                            |
| Current facts            | Complete expanded first rule, compact remaining disclosures, independently selected scheduled/latest facts and version history. Actual records replace generated sample versions. |
| Rule editor              | Readable 48px inputs, 16px field text, explicit limits, minimum-one removal protection and separate Add action. Start event remains free text; no automatic period is invented.   |
| Approval                 | Required source/evidence, optional future Lagos time and exact Review policy action replace generated dropdown/optional-field errors.                                             |
| Mobile                   | Current facts precede the editor; paired fields stack, long legal text wraps and the review action spans the available width.                                                     |
| Visual system            | Quicksand, 30/24px page headings, 20px sections, 6px surfaces, visible borders, neutral impact treatment and restrained brand red follow the written specification.               |

No unresolved visual or interaction mismatch remains against the contract-corrected specification. Optional original-request receipts and deployed verification remain separate backend/release work.
