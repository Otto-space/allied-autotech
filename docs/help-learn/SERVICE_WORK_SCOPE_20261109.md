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
