# Original aftercare request recovery

The customer return/cancellation intake now supports explicit recovery of the original submission after a lost response or reload. Recovery returns the original request with its current review status, including a later rejection, independently of the latest-100 history window.

## Contract

Both `POST /customers/orders/{id}/returns` and `POST /customers/orders/{id}/aftercare` require `Idempotency-Key: aftercare-v1.<13-digit Unix milliseconds>.<lowercase UUIDv4>`. Whole-return bodies remain `{ reason }`; selected-line bodies remain `{ kind, reason, items }`. HTTP 201 adds `replayed` to the existing customer-safe projection. The history and staff response shapes remain unchanged.

The key is scoped to the authenticated customer and order. Its hash is bound to the endpoint and normalized original body; selected lines are sorted by ID and reasons trimmed. Changing the endpoint, kind, products, quantities or explanation with the same key returns 409 `IDEMPOTENCY_CONFLICT`. Missing/malformed keys return 422. Keys expire after 24 hours according to database time, including after receipt cleanup. Timestamps more than one minute in the future return 409 `IDEMPOTENCY_EXPIRED`.

Every attempt requires the current customer session, role, CSRF and ownership. Missing/foreign orders return 404 before receipt lookup. Recovery additionally binds the referenced request to the order, customer and kind; a missing or inconsistent reference cannot expose another request or create a replacement. Existing authentication, rate limits and private response protections remain active.

## Atomicity and domain behavior

A serializable transaction locks the order, checks ownership, serializes the receipt key and commits request, audit and receipt atomically. Database-aborted serialization/deadlock failures use the existing bounded retry. Audit failure rolls back both request and receipt. The existing receipt table stores scoped key/body hashes and the resource ID; no migration is added.

Fresh submissions preserve the existing same-kind non-rejected request rule: an already-active request is returned without replacing its original details. A new key can bind to that existing request, and later recovery still returns that exact request even after rejection. The receipt is distinct from this domain deduplication rule.

Recovery performs no new request/audit, stock adjustment, order transition or refund settlement. Staff review and financial execution remain separate. Existing order cancellation behavior outside these two intake routes remains unchanged.

## Browser behavior

Before POST, the page verifies the current account and fresh order/history, then saves the normalized original body, operation and random key in account/order-scoped session storage. Storage failure prevents submission. Reload, navigation, reconnect and background refresh never automatically POST.

An explicit confirmation shows the original products and explanation. Recovery reuses the retained key and body; edits to the current draft do not replace them. A successful response is validated against the owned order and displayed separately with its current status, even when history omits it. The matching draft and pending marker are cleared only after a validated response. A rejected original can be recovered without creating a replacement.

Session invalidation redacts private retained contents while preserving an uncertainty marker. Changed accounts/roles and unavailable ownership reads block recovery. Legacy, expired, corrupted and redacted markers require explicit successful order/history refresh and manual checking; absence from the latest 100 records does not establish failure. This is tab-session recovery, not indefinite or cross-device persistence.

## Release

Release matching API/frontend and generated contracts together. Older customer clients must reload to provide the required key. No migration, provider activation or policy approval is introduced. Local verification does not establish deployed acceptance.

## Verification

Database/API verification uses only `allied_preferences_20261013_test`, with synthetic fixtures and providers disabled. The replay suite covers both intake endpoints, committed recovery after rejection and beyond 100 records, concurrent identical writes, body/endpoint mismatch, foreign actors, revoked sessions, corrupted foreign receipt references, audit rollback, expiry before/after cleanup, malformed keys and role/CSRF boundaries. Assertions compare order, inventory, refund and audit/receipt state.

Browser verification uses `tests/helpers/aftercare-api-server.ts`, `aftercare-browser-control.ts` (`reject` / `verify`), and frontend `aftercare-real.spec.ts` / `aftercare-replay.spec.ts`. Helper guards require the named isolated database, loopback and disabled providers; synthetic sessions are stored outside the repository. Final local evidence is recorded below.

### Local results

- 20 unique backend API/database cases passed: 14 recovery cases and six existing aftercare/privacy cases. The full 20-case run passed; the 14 recovery cases passed again after canonical order-ID scoping was added, including an uppercase UUID path with the same original key. Expiry was checked against real database time before and after deleting the expired test receipt.
- 474 frontend unit cases passed, including six new original-request storage cases. Backend build/type, lint, changed-file formatting and secret checks passed. OpenAPI validation covered 267 paths and route coverage 316 operations. Full frontend lint, focused final lint, TypeScript and the isolated production build passed.
- 62 unique production-Edge browser cases passed: 11 new recovery cases and 51 customer/staff aftercare regressions. The main run passed 58; four assertions used outdated session-button or recovery-notice text. Their selectors were corrected, and two focused runs passed all four. No application change was required for those assertion failures.
- Four new browser cases use the real loopback API and isolated database. Both operations recover a committed response after rejection and placement beyond the latest 100 records, or complete a request interrupted before reaching the API. Original key/body equality, no automatic replay, safe cancellation, account changes, expiry, unavailable ownership and successful draft clearing are covered across the new cases.
- Post-browser database verification confirms one original intake audit and receipt per scenario. Committed scenarios contain the original request plus 101 deliberately seeded later requests; uncommitted scenarios contain one request. Refund counts remain zero, and exact order/inventory snapshots are unchanged.
- Both recovery confirmations passed WCAG 2 A/AA and 2.1 AA checks at 1440 and 390 pixels, with no horizontal overflow or page errors. Desktop return and mobile cancellation screenshots were inspected. Existing responsive/form/staff tests also passed.

The first browser attempt encountered a session network timeout while the workstation was under load and its browser teardown stalled. Direct API and frontend-proxy session reads then returned 200. Only that test process tree was stopped; the final run used fresh synthetic fixtures and a separate artifact directory. Other workspace servers were preserved.

Temporary evidence: `allied-aftercare-regression.json`, `allied-aftercare-canonical-regression.json`, `allied-aftercare-unit.json`; browser directories `allied-aftercare-browser-confirmed`, `allied-aftercare-browser-session-check` and `allied-aftercare-browser-intake-check`; captures `allied-aftercare-{returns,aftercare}-recovery-{1440,390}.png`. Seven core frontend/API files byte-matched the tested production snapshot. No application database migration, deployment or provider activation was performed.
