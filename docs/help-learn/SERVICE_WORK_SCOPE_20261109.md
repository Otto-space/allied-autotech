# D03 accepted work and materials verification

Source checkpoint, 9 November 2026. This does not publish the full D03 journey or
approve a financial policy, new booking deposit or real payment.

The owner approved materials separately first and workmanship after completion,
before vehicle collection. The brief's before-procurement/use timing was a
recommendation. The implementation now chooses verified materials settlement
before authorising a work order containing those quoted materials. This is a
documented engineering timing choice, not an invented owner procurement approval.
Agreed labour-only work can proceed separately, and diagnosis-only updates remain
available within the existing permissions. Draft preparation is not payment.

`agreed-service-work.ts` checks the immutable invoice plan against the accepted
quotation and saved invoice lines. Work-order inputs use the accepted material
price/description even if the catalogue later changes. Identical rows share an
aggregate quantity limit; changed prices, identities and unaccepted extras are
refused. Completion requires all agreed work rather than just a subset. There is
no silent change to an issued invoice or duplicate sale.

The shared check covers direct booking start/completion, legacy work-order
start/progress/completion and managed technical/independent-quality actions.
Existing branch, assignment, MFA, independent-review, version and resource checks
remain. Private payment records are used only server-side; no financial access is
granted to technicians. Cancellation is not converted into a financial operation.
Historical invoices without a staged plan retain their existing treatment.

Materials proof requires the selected settled attempt, verified matching currency
and amount, recorded paid/verified timestamps and a valid saved stage binding. An
unverified report, prepared request or partial stage does not satisfy it. Refunds,
disputes and open anomalies hold the affected new obligation for financial review.
Existing genuine legacy credit is counted once and must still have a verified net
deposit behind it; forfeited/missing credit cannot fund the work. A completed
historical deposit refund can already be reflected in that saved net credit;
pending adjustments still hold it. No refund authorises another automatic charge.

Booking is locked before Invoice. Verification/refund code may already hold an
Attempt, so the operational guard never waits on that attempt while holding
Booking: it uses `FOR SHARE SKIP LOCKED`, then requires every selected settled
proof to be in the locked set. A busy proof gets a retry response. It does not
treat a partial lock set as authorization or depend on driver-specific exceptions.

## Guidance and acceptance boundaries

Service-request v31, financial-policy-work v7, assigned-findings v6 and
job-assignment v3 retain their existing public/restricted eligibility and semantic
destinations. The public guide stays within twelve steps. No practice or tutorial
performs real work, grants a permission or activates a live feature.

The first isolated run passed 141/143 and exposed a raw busy-lock error mapping
and an inaccurate guide-word assertion. The guard was changed to the explicit
locked-set check and the guide clarified; refusal and scope assertions were not
relaxed. The subsequent combined run passed 156/156 across ten files, including
managed technical refusal, independent quality completion, exact stage eligibility
and actual authenticated Help/Learn access. All 99 migrations replayed on a fresh
owned tmpfs `_test` database, schema diff/db:check passed and tests used a restricted
runtime role. Its container was removed. These are synthetic database/HTTP checks,
not production role or provider acceptance. Evidence is under
`%TEMP%/aat-d03-service-payments-20261109/native-agreed-work-final.log`.

The later legacy-credit refinement passed 33/33 in two files on another fresh
99-migration restricted-runtime target, including a genuine synthetic historical
credit counted once and refusal after forfeiture. Its initial fixture was refused
for an unconfigured service duration, then missing online-success references;
the fixture was completed and both database guards retained. The final log is
`native-agreed-credit-final.log`; every owned tmpfs container was removed.
Do not count this refinement as part of the earlier 156-case source.
Source types, full backend lint, scoped formatting, 450-path OpenAPI validation,
530-operation mounted-route coverage, ten existing security/HTTP-boundary checks
and the 3,894-file secret guard passed. Contracts and client types regenerated.
UI components were unchanged in this
phase, so no new screenshots or browser acceptance are claimed. Earlier invoice
presentation evidence remains in SERVICE_PAYMENT_STAGES_20261109.md.

## Still required for full D03

- A complete reviewed amendment/supplement journey with actual customer acceptance,
  preserving the original issued invoice and every payment, credit and tax total.
  Refusing an unaccepted extra is a safeguard, not a replacement for that journey.
- Actual material issue/use and inventory checkpoints where applicable. Work-order
  authorization does not prove physical procurement or installation occurred.
- An authorised, durable actual vehicle-release record, distinct from work
  completion, with cleared balance/adjustments and concurrency/recovery checks.
- Full HTTP/role/rendered acceptance, exact-source required CI, financial/provider
  prerequisites and release/backup/recovery safeguards before publication.

Verified invoice identifiers, actual financial-policy publication and provider
acceptance remain separately gated. General returns/warranty policy is still
deferred. No price, permission, real customer record or production flag changed.

## Newer D11 integration

Checkpoint 02679ffd preserves this work. Merge 9e7ad91b then incorporates master
885010a6's available-alternative workflow and append-only visit continuation.
The migration, alternative/attendance implementation and four affected booking UI
components match master exactly. Only the new continuation migration was added;
the earlier 99 migration files were not edited. Both evidence histories and both
service imports were retained. The attendance guide assertions combine current
booking-confirmation v15 with D03's assigned-findings v6 and service-request v31.

The generated Prisma client now includes schema 100. Integrated scope/learning
units pass 66/66; canonical OpenAPI validates 452 paths and 532 mounted operations.
Generated client types reconcile without a semantic diff. Browser discovery collects
448 cases in 31 files, not execution evidence. The overlapping frontend unit run
passed 13 cases but one worker failed to start, so that run is not a passing gate;
serial verification is recorded separately. No assertion or timeout was relaxed.

The serial frontend rerun passes 19/19 across the same three invoice files with
unchanged assertions/timeouts (`frontend-invoice-serial-integrated.log`, 66.52
seconds). No passing gate is inferred from the earlier worker-startup error.
Final integrated frontend nonincremental and backend source type checks, full
backend lint, scoped formatting, diff whitespace and the 3,897-file secret guard
pass. The final C: preflight is 21.93 GiB with a 0.1 GiB allowance.

Final integrated database acceptance on 9e7ad91b passes 208/208 in fourteen files,
including the credited service stages, work-scope/lock checks, attendance,
reschedule approval, managed rescheduling, complete concern-booking HTTP journey
and actual learning HTTP eligibility. The fresh target replayed all 100 migrations,
passed schema diff/db:check and used the restricted runtime role. The selected
test container was removed after the terminal result. Final log:
`native-integrated-d03-d11.log` (598.74 seconds). This is isolated synthetic
acceptance, not live-role, physical-device, provider or production-migration proof.

Completion resource inspection retains all fourteen original containers and a new
885010a6 Linux candidate owned by the other release. No image/cache/volume was
removed. Docker reports 143 images/13.78 GB, 446 build-cache records/13.94 GB and
15 existing volumes/2.892 GB; compared with the earlier inspection, the four new
images and seven cache records accompany that other active release. These logical
totals are not physical Windows space reclaimed. C: preflight passed at 21.94 GiB.
Useful current caches, all other worktrees, database volumes and recovery images
remain intact. No claim of a machine-wide disk quota or immutable external state.
