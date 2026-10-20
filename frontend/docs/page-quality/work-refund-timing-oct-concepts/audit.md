# Bank refund timing — milestone 101 audit

Route: `/admin/refund-timing`. Audit 19 October 2026. Gate 100 is accepted; this is the only active route. Previous continuation supplied security advice but made no implementation progress; this continuation resumes from verified baseline artifacts.

## Baseline evidence

Native Edge captures at 430, 768, 1280 and 1440 pixels are stored externally as `C:/Users/PC/.codex/work-refund-timing-baseline-{width}-viewport.png`, with full-page counterparts and `work-refund-timing-baseline.json`. All four inspected. The original process handle is now missing; all four files and the completed JSON exist. No repeated capture needed. No overflow or page errors. The form is unnecessarily wide/tall, weekday choices have excessive gaps, and active policy facts are missing. Latest scheduled revision dominates the introduction without a clear current/scheduled distinction.

## Authoritative contracts

- Existing `POST /admin/policies`, kind `BANK_REFUND_CLOCK`: Super Admin with MFA; optimistic expectedVersion, future/immediate effectiveAt, source 10–500, approvalEvidence 20–1000, immutable version/audit, Q6 provenance.
- Settings: one of REQUESTED / APPROVED / TRANSFER_RECORDED; fixed ten banking days; EXCLUDE_START_SAME_LOCAL_TIME; one to seven weekdays 0–6; at most 366 ISO holiday dates; Africa/Lagos. No editable duration, timezone or counting convention.
- `snapshotRefundClock` selects the highest APPROVED version effective at the refund's requestedAt, for MANUAL payments only. It waits for the selected event. Existing dueAt is never recalculated. Dates count from the following day, excluding unselected weekdays/holidays, at the same Lagos time. Publication neither sends money nor confirms receipt.
- The current projection must follow that **version-first** selection, unlike reservation agreements' effective-time-first selection. A future revision only changes the selected policy if its version exceeds the current version. History is bounded to 100 but current selection must not be.
- Required compatible backend gap: private/no-store actor-locked current read, independent current/next/latest selection, minimal atomic READ audit. Extend publication's current actor/session check to this policy kind. No schema change.

## Interaction and safety repairs

Reuse the accepted policy editor's active own-profile check, fresh preflight, strict actor/Q6 receipt verification, persistent actor-bound uncertain marker, explicit read-only reconciliation and saved-draft retirement. Preserve `refund-timing-policy:1`. Calendar approval must never restore from a saved draft; reset it on review closure. Keep unsent input on refresh/conflict. Validate dates and weekday selection before review. Never replay an uncertain write.

## Visual direction

Existing dark shell and Quicksand UI; compact heading and refresh toolbar; neutral impact strip; 38/62 current-policy/editor columns at desktop, one column below laptop. Current panel explains start event, fixed rule, selected weekdays, holiday disclosure and evaluated time. Separate next scheduled and latest revision disclosures. Editor groups banking calendar, effective date, approval evidence; weekday checkboxes in compact wrap grid with red focus. Full history below. Mobile review is inline and complete, with natural scrolling and no clipped facts. No fake metrics, new imagery, invented policy decisions or automatic dates.

## Gate still open

Fresh desktop and mobile/form/review concepts, implementation, unit/API/browser/connected verification, seven-width accessibility, native fidelity, static/build checks and acceptance remain required. Existing baseline is not acceptance.
