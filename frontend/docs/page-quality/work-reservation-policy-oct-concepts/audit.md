# Reservation agreements audit — milestone 100 in progress

Route: `/admin/reservation-terms`. Audit date: 19 October 2026. Delivery milestone 99 is locally accepted before starting this separate route. No reservation runtime changes have been made at this stage.

## Existing surface and baseline

The page uses `ReservationTermsPolicy`, shared dashboard/session/resource/review/draft infrastructure and `reservation-terms.css`, which is also relevant to customer agreement presentation. The existing editor precedes history, has a large uninterrupted single column and exposes publication title/body and withdrawal reason simultaneously. Its breadcrumb comes from the generic shell. Four native baseline widths (430/768/1280/1440) are saved as `C:/Users/PC/.codex/work-reservation-policy-baseline-*`; all report no page overflow or page errors. The sequential Edge/Playwright fallback is used because the Browser plugin is unavailable. Fixtures are synthetic browser-only responses; no database writes occurred.

## Authoritative contracts

- Existing `GET /admin/policies?key=vehicle_reservation_terms&limit=100` returns latest-version history, not an authoritative current/next projection. The general route has no explicit private/no-store response or minimal READ audit. Current applicability cannot safely be inferred from the bounded history.
- Existing `POST /admin/policies` accepts kind `VEHICLE_RESERVATION_TERMS`, expectedVersion, effectiveAt, approval source (10–500), evidence (20–1000) and strict discriminated settings. Enabled requires plain-text title (1–200) and body (1–50,000); withdrawn requires plain-text reason (1–1,000). Control characters other than tab/newline/carriage return are rejected. Publishing requires Super Admin/MFA and creates immutable Q3 policy plus CREATE audit under the existing policy advisory lock/version check.
- Publication currently does not include this kind in the transaction-bound `lockAccessActor` group used by accepted neighboring policy pages. Extend that current actor/session check without changing permissions or the existing policy lock.
- `currentReservationTerms` selects the effective record by descending effective time/version; withdrawn/unapproved records yield no available document. `requireReservationTerms` shares the publication lock and rejects missing/superseded acceptance. Customer acceptance stores the immutable document association and timestamp; older acceptance remains untouched. A later scheduled enabled version can restore availability after withdrawal, so the owner must see upcoming revisions.
- Agreement publication does not activate reservation deposits or establish payment readiness. Do not invent contractual text, cancel existing reservations, overwrite historic acceptance or introduce arbitrary deletion.

## Required improvements

Add a private Super Admin/MFA current workspace with independently selected current, next scheduled, latest and bounded history, a repeatable snapshot/current actor check and minimal atomic READ audit. Reuse accepted policy response shapes and transaction retry rather than introduce storage. No schema change is expected.

Use current agreement facts beside a focused publication/withdrawal editor; keep exact text accessible in a readable scrollable disclosure. Provide an explicit action selector and only relevant action fields, while safely retaining unsent action drafts. Show the recorded base, scheduling consequences and preservation of existing acceptance. Required confirmation remains fresh after reload. Use persistent actor-bound uncertainty locks, original draft base, exact Q3/actor/settings receipt checks, fresh profile/version preflight and explicit reconciliation with no automatic POST replay. Durable original-request receipts remain separate ADM-63 work.

Reuse established breadcrumb, status, form, draft and review patterns. Scope new CSS to this administrator route so customer agreement presentation is preserved. Build fresh complete desktop plus mobile/action/review concepts and a specification before runtime edits.

## Verification plan

Seven responsive widths with page/review accessibility; native concept comparisons; publish/withdraw/scheduled states; empty history; exact long text and safe literal HTML-like text; draft base/action/refresh/reload; fresh identity/version; invalid metadata/plain text/date; lost or wrong receipts through reload; denied/read-error/role states. Add focused parser/recovery units and isolated API current/history/authorization/CSRF/concurrent publication/audit/preservation checks. Exercise connected approved publication and uncertain recovery using verified isolated runtime; preserve existing acceptance records and disclose fixture limits. Reuse unchanged migration safety evidence. Deployment remains a separate gate.
