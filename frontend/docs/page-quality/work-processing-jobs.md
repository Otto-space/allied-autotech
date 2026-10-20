# Processing jobs — local acceptance

Accepted locally on 19 October 2026. Route `/admin/processing-jobs`, milestone 93, following [audit logs](work-audit.md). Complaint policy `/admin/complaint-policy` is the next separate gate. Application-wide and deployed acceptance remain open.

## Result

A compact source/status toolbar and ruled queue replace oversized filters and repeated retry panels. Each row shows its real event, status, attempts and full Lagos timestamp. Desktop selection opens a direct current-job inspection beside the queue; mobile selection opens a dedicated view with Back to job list. Source, status, signed cursor history and selected physical source/UUID survive reload and navigation.

The direct inspection preserves all safe lifecycle timestamps, zero attempts and null distinctions, even after a job leaves the filtered queue. Full references are disclosed separately. Known notification events receive a readable label; other event keys remain literal. Raw diagnostic errors and payloads are excluded by the backend projection.

One reviewed retry uses existing form and dialog components. It checks fresh account access and current record state, sends the exact attempts/revision/reason, and validates the receipt. Refresh keeps the form mounted and disabled so a changed revision preserves the reason and requires explicit review. Processing and completed/queued states cannot be retried through this form. Queue acceptance does not claim delivery or settlement.

A minimal actor/role-bound session marker is written and verified before submission. Storage failure prevents submission; uncertain or malformed outcomes remain locked across reload. Recovery reads the current job and requires an explicit independent-reconciliation acknowledgement. It never automatically repeats the mutation. Revocation clears protected details and redacts recovery references. Current state alone cannot prove the original request outcome; optional durable receipts remain ADM-61.

## Design comparison

Four baseline widths and fresh built-in ImageGen [desktop](work-processing-jobs-oct-concepts/desktop.png)/[mobile](work-processing-jobs-oct-concepts/mobile.png) concepts preceded runtime edits. The [audit](work-processing-jobs-oct-concepts/audit.md), [specification](work-processing-jobs-oct-concepts/spec.md), [prompts](work-processing-jobs-oct-concepts/prompts.md) and [corrections](work-processing-jobs-oct-concepts/corrections.md) retain the design evidence.

| Area                | Rendered comparison                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and hierarchy | Actual Allied branding, role navigation, Quicksand and one semantic breadcrumb replace generated branding/account controls. Compact heading and Refresh sit together where space permits.                                     |
| Filters             | The two supported filters and Clear form a short toolbar. A native review caught inherited field margins; scoped spacing corrects the excess height. No unsupported search or global totals are invented.                     |
| Queue               | Ruled records, subdued status labels, a selected red edge, readable attempts and complete timestamps follow the concept. Unknown event names stay literal; the generated booking-reminder label was not adopted.              |
| Inspection          | Desktop uses approximately 40/60 queue/detail columns. Safe facts pair, while complete references open on demand. Actual published/processed/failed fields and null values replace abbreviated concept data.                  |
| Mobile/tablet       | Below 1100px the selected inspection replaces filters/queue and offers Back to job list. At phone widths, source/attempts share a row and full dates stack. Filters and controls fit 320px without horizontal page scrolling. |
| Retry treatment     | A pale inset form, visible field border and restrained red review action follow the visual direction. The reason starts empty. Existing review-dialog, focus, validation and draft behavior are reused.                       |
| Truthful pagination | Loaded-page count, Previous/Next and bounded opaque history replace the invented total-page count. Direct inspection remains available outside the filtered collection.                                                       |

Final production captures at 430/768/1280/1440 were inspected natively against both concepts after the spacing correction. Desktop filters are aligned and compact; mobile facts and the lower retry form remain legible. No overflow or page errors occurred. Evidence: `C:/Users/PC/.codex/work-processing-jobs-final-*.png` and `work-processing-jobs-final.json`.

## Verification

All 22 production browser scenarios pass: 15 new and seven adapted existing job flows. Development and production repeats are counted once. Seven focused frontend unit cases pass across three files. The backend's five isolated API scenarios have passing evidence, alongside two signed-cursor unit cases. Frontend/backend type checks, focused lint, formatting, OpenAPI export/validation and route coverage pass; generated declarations contain 306 paths, 360 operations and four infrastructure routes. Final build, standalone preparation and 14 matching runtime/dependency source hashes pass.

The browser coverage includes seven widths 320/375/430/768/1280/1440/1920 and 14 directory/expanded-inspection Axe states; exact signed paging/history; both administrator roles; Staff denial; both physical sources; zero attempts; stale revisions/attempts; preserved draft/reload; processing without retries; unavailable storage; lost/malformed receipts; reload/reconciliation without replay; and revoked current access. The final production run passed all cases in 1.5 minutes.

Only affected checks were repeated. Initial cold/slow preview timeouts at 320/375 passed focused reruns. The stale-preflight test was corrected to use Go back after a definitive rejection. The legacy refresh regression exposed an actual form-remount issue, which was fixed and passed its focused rerun. One nine-case development runner stalled after reporting eight passes and the refresh failure; its verified owned runner was stopped during teardown. Other processes were untouched.

## Backend and database safety

The additive private current-job endpoint supports all actual source lifecycle states. List/current reads and retries recheck the actor/session under the existing transaction lock. Reads append minimal audit events atomically. Optional expectedUpdatedAt strengthens retry's existing attempts/status condition. Atomic notification-delivery reset, provider idempotency, CSRF/MFA and source-specific queued states are preserved. There is no schema or migration change. See [contract, isolated tests and preservation evidence](../../../backend/docs/processing-jobs-workspace.md).

The actual isolated target and non-elevated runtime flags were verified before test writes. Original-row hashes passed, owned temporary sessions were removed, and synthetic domain fixtures were retained. No application/shared database, existing grant, backup/restore, external provider, push or deployment operation ran. Existing isolated migration/privilege evidence is reused; production rollout still requires the documented backup and restore safeguards.

## Connected verification

Production Next.js, Edge, the real Express API and isolated PostgreSQL verified direct inspection after queue exit, one zero-attempt outbox retry and one zero-attempt webhook retry whose successful response was deliberately lost. Reload retained the recovery lock; current inspection and explicit independent reconciliation cleared it without resubmission. Exactly two STATUS_CHANGE audits exist for the two owned jobs. Queue states remain PENDING/RECEIVED, with zero attempts; no provider worker ran.

The harness first counted a CSRF-token POST as an extra job retry, so it stopped after the successful outbox action. The continuation inspected that saved result and used only the still-unretried webhook. Its final refresh audit was queried before completion; after settling, all ten started reads had ten READ audits. A separate read-only confirmation matched four successful requests to exactly four audit events by request ID. Successful mutations were never replayed to fix harness assertions.

Whole-row hashes from the continuation boundary through final verification preserve 59 users, seven customer profiles, 52 staff profiles, 38 branches, 18 invitations, all 44 existing outbox records (including the already-queued synthetic outbox), 29 other webhooks, one notification/delivery, one capability grant, 14 workforce-access records, 16 assignments and all 353 original audit rows. Only the owned webhook changed during this interval. The first connected attempt stopped before its original-hash assertion; its outbox result and single audit were subsequently verified without replay. Each phase removed its owned temporary session and verified zero remaining.

Evidence: `C:/Users/PC/.codex/work-processing-jobs-real.json`, `work-processing-jobs-real-continuation-before.json`, retained fixture metadata and the build/source-hash/final-capture artifacts.

## Remaining scope

This page's local gate is complete. Optional durable original-request retry receipts remain ADM-61. Complaint policy, remaining Super Admin policies, broader role regression and deployed verification retain separate gates. No push or deployment was performed.
