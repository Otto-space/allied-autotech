# Customer support reply recovery

Customer replies now retain an original request key and support explicit recovery after a lost response or reload. The original message can be recovered after its conversation closes, provided it already committed and the customer still owns the conversation. New replies to closed conversations remain rejected.

## Contract and boundaries

The existing customer enquiry and complaint `POST /customers/support/{kind}/{supportId}/messages` routes require `Idempotency-Key: support-reply-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>` and the strict body `{ message }`. No ownership or visibility override is accepted. Customer role, session authentication, CSRF, rate limits, and no-store responses still apply. Staff reply and internal-note contracts are unchanged.

Keys are scoped to the authenticated customer, conversation kind and conversation ID, and bound to the normalized message. HTTP 201 returns the safe original message (`id`, `body`, `authorType`, `visibility`, `createdAt`) plus `replayed`. Recovery does not edit the message, reopen the conversation, append another audit or enqueue another notification.

Changed bodies or inconsistent receipt resources return 409 `IDEMPOTENCY_CONFLICT`. Missing or malformed keys return 422. Keys expire after 24 hours, including after receipt cleanup; timestamps over one minute in the future also return 409 `IDEMPOTENCY_EXPIRED`. Current conversation ownership is required before any receipt lookup. Missing or foreign conversations return 404. Receipt reads additionally require the original customer author, customer visibility and matching conversation; internal notes cannot be returned through replay.

## Atomic persistence

A serializable transaction locks the owned conversation row, then serializes the original request through the existing receipt helper. The first request enforces the current open/resolved conversation state and commits the reply, audit, assigned-staff notification/outbox intent and receipt together. Failed audit or enqueue work rolls back every effect. Existing bounded retry handles database-aborted serialization/deadlock failures. Replaying an existing receipt skips creation and notification enqueue while rechecking access.

The existing `IdempotencyRecord` stores scoped key/body hashes and the message ID; no migration or message text duplication is required. Recovery reads the message directly through its private authorized projection, independently of history pagination. Provider delivery remains separate: test providers are disabled and notification delivery intents remain disabled/dead-lettered.

## Browser recovery

The customer form stores the normalized original message, key and account/conversation identity in session storage before sending. New submission remains locked after an uncertain outcome. A separate confirmation shows the original message; recovery never silently substitutes draft edits or creates a replacement key. Navigation, reconnect, reload and refresh do not automatically POST. Successful recovery clears the matching reply draft and recovery marker, refreshes the conversation and confirms the original reply even when it is beyond the first history page.

Fresh session checks block a changed account or role. Session invalidation redacts retained private text but preserves uncertainty. Unavailable or revoked conversation reads hide the recovery message and block recovery. Expired, corrupted and legacy markers retain explicit history reconciliation. Browser storage failure prevents new submission. This is tab-session recovery, not cross-device or indefinite storage.

## Coordinated release

Deploy the matching API/frontend and regenerated contract together; older customer clients lacking the required key must reload. This feature adds no migration and does not activate providers or change pending business policy gates. Deployed acceptance remains separate from local verification.

## Additional shared-support verification

The current checkout passed backend and frontend type checking, OpenAPI validation for 267 paths, and 16 focused frontend recovery/overview unit tests. Seven focused Playwright reply-recovery cases passed, covering both conversation kinds, committed and uncommitted outcomes, expiry, account changes and revoked access. The two database-gated replay integration files contain 38 cases but were skipped in this run because `RUN_DATABASE_TESTS` was not enabled; deployed provider delivery was not exercised.

## Local verification

- 54 backend API/database cases passed in one focused run: 18 reply-recovery cases, 20 support-creation recovery cases and 16 existing support/worker/boundary cases. Both conversation kinds cover closure, concurrent duplicates, body mismatch, foreign actors, revoked ownership, atomic audit/notification rollback, expiry before/after cleanup, future/malformed/missing keys, strict visibility, CSRF/authentication and corrupt internal-message receipt references.
- 464 frontend unit cases passed, including six reply-storage cases covering normalized contents, account/conversation identity, strict customer payloads, legacy/corrupt state, expiry, denied storage and session redaction. Backend build, lint, type, formatting and secret checks passed. OpenAPI validation covered 267 paths and route coverage 316 operations. Frontend type, lint, changed-file formatting and the final isolated production build passed.
- The final production-Edge run passed all 90 cases: 11 new recovery cases plus 32 conversation-quality and 47 shared-support regressions. It covers public contact, staff/internal-note controls, source creation, permission and stale-read boundaries, legacy reconciliation, draft persistence and responsive/accessibility behavior.
- Eleven new production-Edge browser cases exercise committed and uncommitted recovery for both kinds, cancellation, no automatic POST after reload/reconnect, account changes, expiry, revoked access and draft clearing. Four cases use the real loopback API and isolated `allied_preferences_20261013_test`; committed replies are beyond the first 50-message page and their conversations are closed before recovery. Each synthetic scenario has exactly one customer reply, audit, receipt, notification, delivery intent and outbox event. Providers remain disabled; this is enqueue evidence, not delivery evidence.
- Reply confirmation passed WCAG 2 A/AA and 2.1 AA checks at 1440 and 390 pixels for both kinds, without horizontal overflow or page errors. Desktop enquiry and mobile complaint captures were inspected. Browser plugin not available; the repository Playwright configuration with installed Edge was used.

The first browser run hit a trace-file collision with a concurrent suite using the default artifact directory. The repeat uses its own `allied-support-reply-browser-final` temporary directory and fresh synthetic accounts. An initial build snapshot caught unfinished admin overview files; after those changes became available, the final production snapshot was synchronized from the worktree and built successfully. Seven core reply/API source files matched the final build snapshot. Shared worktree changes were preserved.

Reproduction uses `tests/helpers/support-reply-api-server.ts`, the explicitly guarded `support-reply-browser-control.ts` helper (`close`/`verify`), and frontend `support-reply-real.spec.ts` / `support-reply-replay.spec.ts`. Local reports are `allied-support-reply-regression.json` and `allied-support-reply-unit.json` in the temporary directory, with screenshots `allied-support-{enquiry,complaint}-reply-recovery-{1440,390}.png`. Synthetic session material remains outside the repository. No application database migration or production provider activation was performed.
