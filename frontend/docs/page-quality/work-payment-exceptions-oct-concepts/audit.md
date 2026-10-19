# Payment exceptions — gate 84 audit

Status: locally accepted as gate 84. See the [final report](../work-payment-exceptions.md) for implementation, visual comparison and focused verification. The audit below preserves the pre-implementation findings.

## Baseline reviewed

Production `/admin/payment-exceptions` captured and visually inspected at 430, 768, 1280 and 1440 × 1050. No horizontal overflow or page errors. Private captures: `work-payment-exceptions-baseline-{width}-viewport.png` and full-page counterparts under the local Codex evidence directory.

The first record starts below oversized filters and repeated navigation. Each record repeats a long metadata section and an action form. Raw enum headings and widely separated reference labels obscure the investigation. Selection and filters disappear on reload; pending updates have only an in-memory lock. Admin/Super Admin access is enforced, but the page does not independently confirm a current active profile before exposing protected facts or submitting.

## Verified API and permissions

- Admin/Super Admin, verified privileged session; no Staff or Customer access. Existing global workforce restrictions continue to apply.
- GET `/admin/operations/payment-anomalies`: bounded cursor pagination, status/type filters, detectedAt then ID descending, safe 14-field projection. No totals, balances, customer names or raw provider details.
- POST `/admin/operations/payment-anomalies/{anomalyId}/status`: CSRF, strict body, conditional expected-status write and atomic audit. OPEN → INVESTIGATING → RESOLVED or IGNORED. Closed records cannot reopen. Closure changes only the investigation record.
- Missing: direct private audited current read for reload/deep-link and uncertain-result recovery. Existing mutation receipt is partial. Add a safe full-record receipt and current read using the existing projection, without schema changes or weakening transitions.
- Existing queue needs an explicit private/no-store response header. Provider payloads remain excluded.

## Implementation direction

Reuse the dashboard shell, Quicksand, visible login-derived form borders, profile/resource hooks, cursor utilities, mutation review and existing operation form. Scope the new coordinator and styling to payment exceptions; preserve other operations queues.

Desktop: compact heading and two filters; narrow chronological queue beside selected investigation. Ink context header, friendly category/status, summary, detection/update facts; latest investigation note and a clearly separated action area. References in an accessible disclosure, with supported source links. No invented monetary metrics. Mobile: selected workspace before the queue, compact filters, full-width review action, wrapped references and controls.

URL carries validated status/type/cursor history and selected exception. Full current read is required before review/submission. Persistent actor/record lock stores only minimal identifiers and a body fingerprint, never note content. Unknown results require a current read and explicit acknowledgement; never replay automatically. Clear facts and proposals on authentication denial. Validate the complete receipt against the proposed record, transition and note before success.

## Acceptance still required

Fresh desktop/mobile image concepts, native inspection and correction ledger; implementation; focused helper and browser checks, role/CSRF/concurrency/API verification on isolated fixtures; responsive and accessibility checks; production build and screenshots; at least five measured visual fidelity points; backend gaps and acceptance register update.
