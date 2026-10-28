# Administrator payment exceptions

Gate 84, 18 October 2026. Implementation and connected local verification complete;
the frontend acceptance report records the final browser and visual gate.

## Access and safe reads

All routes below require the current authenticated Admin or Super Admin and the
existing privileged-session/MFA requirements. Global workforce access restrictions
remain authoritative. Staff, Customer and anonymous callers cannot read these records.

- `GET /admin/operations/payment-anomalies` retains its strict optional `status`,
  `type`, UUID `cursor` and bounded `limit` (1–100, default 25). Order is detection
  time then ID descending. `nextCursor` identifies the last returned item; pagination
  is live rather than a frozen snapshot. Successful reads append a minimal queue READ audit.
- `GET /admin/operations/payment-anomalies/{anomalyId}` adds direct current inspection
  independent of filters/paging. UUID validation and an empty query are mandatory.
  Missing records return 404. The safe read and its minimal `PAYMENT_ANOMALY` READ
  audit share a repeatable-read transaction. Audit failure does not return an
  unaudited successful response.

Both reads and successful update receipts explicitly use `Cache-Control: private, no-store`.
Their shared projection contains `id`, `paymentId`, `paymentAttemptId`, `refundId`,
`disputeId`, `type`, `status`, `summary`, `detectedAt`, `resolvedAt`, `resolutionNote`,
`resolvedByUserId` and `updatedAt`. Nullable source links remain nullable. Raw
provider `details`, credentials, customer contact data and financial amounts are
excluded. Summaries and investigation notes remain protected operational content.

## Existing controlled transition

`POST /admin/operations/payment-anomalies/{anomalyId}/status` retains strict UUID,
empty-query, CSRF and body validation. Body:

```json
{
  "expectedStatus": "OPEN",
  "status": "INVESTIGATING",
  "resolutionNote": "Compared the recorded source with the provider observation."
}
```

The note is trimmed and must contain 3–2000 characters. OPEN must first become
INVESTIGATING. Only INVESTIGATING may become RESOLVED or IGNORED. Closed records
cannot reopen. The conditional expected-status update and STATUS_CHANGE audit are
atomic; stale/invalid transitions return 409. The terminal actor and time are set
by the server. The response now includes the complete shared safe projection rather
than the older partial receipt. The write also locks and rechecks the current
administrator account and session inside its transaction. A revoked, expired,
inactive, demoted or no-longer-MFA-verified actor cannot change the investigation
after the earlier request-level authorization check.

This operation changes the exception investigation only. It does not verify,
capture, refund, settle, reprice or update any linked financial record. No database
schema, migration, grant expansion or external-provider operation is introduced.

## Local evidence and limits

Three isolated API/database scenarios verify safe/current/queue reads, minimal read
auditing, exact receipts, strict validation, role/MFA/CSRF boundaries, conditional
transitions, concurrent closure and unchanged existing financial rows. A connected
production Edge/API/PostgreSQL run verifies one Admin start with committed-response
loss, reload/current-read/manual reconciliation without replay, and one Super Admin
closure. Exactly two UI mutation requests and two transition audits were recorded,
with six current READ audits and zero temporary sessions remaining. All 38 payments,
38 attempts, 31 refunds, 37 invoices and eight ledger rows were compared and unchanged;
other exceptions were unchanged. Synthetic investigation fixtures are retained.

Writes used only the confirmed restricted local test target `127.0.0.1:55480`,
`allied_work_aftercare_20261017_test`. Existing 60-migration compatibility evidence was
reused; no migration, backup/restore, shared-database or deployment operation ran.
No off-device backup or restore-rehearsal claim is made.

The browser's pending marker is a local recovery aid. A current read cannot prove
the final outcome of an earlier in-flight request or cancel it. No durable
request-specific decision receipt is added. Independent reconciliation is still
required before clearing an uncertain lock; requests are never replayed automatically.
