# Dispute work queue — gate 86 audit

Status: locally accepted as gate 86. See the [final report](../work-dispute-handling.md). The findings below preserve the pre-implementation audit.

Route: `/admin/payment-disputes/work`. Production baseline at 430, 768, 1280 and 1440 × 1050 was captured and inspected before implementation. Private screenshots: `C:/Users/PC/.codex/work-dispute-handling-baseline-{width}-viewport.png` and full-page companions. No page overflow, page error or write occurred.

## Findings

The first record begins below 500px on desktop and 600px on mobile. Oversized filters and repeated facts make the work queue difficult to scan. Disputed amounts inherit retail strikethrough styling. Raw enum labels and distant label/value columns weaken hierarchy. Mobile actions fall many screens below their record heading. The breadcrumb ends in generic “Details”. Local filters and selection disappear on reload. Selection changes unmount forms; uncertain outcomes are locked only in memory and become replayable after reload.

## Verified contract

- GET `/staff/disputes` requires authenticated privileged staff with a live `DISPUTE_MANAGE` capability, including Admin and Super Admin. Staff only sees primary/backup assignments. Query: strict openOnly true/false, UUID cursor, limit 1–100/default 25. Order is createdAt then ID descending; createdAt is not exposed, so the UI must not claim opened-date ordering. Response includes safe provider facts, exact integer-string money, deadlines, operator labels, acknowledgement, immutable evidence checklist and provider submission receipt. It excludes raw evidence object keys.
- No current-record endpoint exists. Add a capability- and assignment-scoped current read with a minimal READ audit for preflight and recovery. Successful queue reads currently have no READ audit or explicit private no-store response policy.
- Assignment is restricted to Admin/Super Admin with the capability. Two distinct targets must be active, email verified, non-customer accounts with live DISPUTE_MANAGE grants. The existing `/admin/staff` picker cannot filter by verification or capability; a bounded eligible-operator lookup is needed. Preserve server-side revalidation under the existing write transaction.
- Existing acknowledgement, evidence and submission actions lock the dispute row, enforce optional expectedUpdatedAt, preserve closed history, and audit the write. UI always sends the expected version. Acknowledgement does not submit evidence. Evidence upload verifies actor-bound ticket, expiry, actual object size/type/hash and preserves the original bundle. Evidence access is separately audited and returns a short-lived private URL. Submission requires evidence and a valid time, records the actual provider receipt, and does not settle money or prove provider acceptance.
- Acknowledgement/submission notes are audit-only; the current DTO cannot prove those notes. Do not invent note history or claim that a recovery read proves the original request completed. Preserve existing repeated-acknowledgement and identical-receipt backend semantics.

## Scope and reuse

Reuse Allied shell, Quicksand, finance typography, exact money/date formatters, provider facts, assignment/progress/evidence forms, upload primitive, draft support and review dialog. Add only the private read/eligible lookup needed for this page, with contract tests. No financial calculations, provider settlement semantics, schema migration or existing grants are changed.

Baseline synthetic fixtures live in `tests/fixtures/work-dispute-handling.ts`; they never access an application database. Continue on this route until visual, functional, role, responsive, accessibility and connected backend checks pass.
