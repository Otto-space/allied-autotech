# Managed workforce enquiry workspace

Locally verified on 19 October 2026. The frontend route is `/admin/workforce/enquiries`.

## Contract

- `GET /staff/workforce/enquiries` combines bounded literal multi-term `q`, actual `type` and `status` filters with existing responsibility scope and UUID paging. Search includes subject, original message and customer-visible message bodies; internal messages cannot produce a match. Responses add minimal named branch/assignee references, current access and generation time. Customer contact information and administrative relationship identifiers remain excluded.
- `GET /staff/workforce/enquiries/:id` returns the scoped current record and paginated customer-visible history. Messages sort by creation time and ID descending. A cursor must belong to that enquiry and be customer-visible. Author identity is reduced to author category and an `isOwn` flag. The original enquiry is distinct from replies.
- Enquiry assignee options preserve the unparameterized response and add opt-in name search, bounded pagination and enquiry/version/branch/access metadata. Existing technical-job candidate behavior is preserved.
- Existing reply POSTs retain `{expectedVersion, body}` compatibility and accept optional nullable `expectedLatestMessageId`. New clients send it to reject a changed conversation even when another support writer did not increment the enquiry version. Assignment retains its existing payload. Both operations lock the parent enquiry before checking scope, version and state, and return additive exact action receipts with actor and access metadata.
- Current actor/MFA checks, responsibility serialization, CSRF, private no-store responses and atomic audit events remain authoritative. Customer Service reads its branches; Sales Supervisor reads product/vehicle enquiries in its branches; Sales Cashier reads assigned sales enquiries. Only eligible Sales Supervisors can reassign. No schema, migration, permission or grant expansion.

## Evidence

Seven isolated API scenarios pass. They verify all three eligible responsibilities, foreign branch/type/assignee denial, private projection, discovery and history pagination, literal search and internal-message exclusion, cursor ownership, legacy and paged candidate options, exact reply/assignment receipts, older reply compatibility, concurrent reply/version protection, stale latest-message protection, closed states, CSRF and unauthorised/unauthenticated denial. Nineteen successful reads and four successful mutations correspond to 23 audit entries.

The first fixture setup failed atomically because a closed enquiry also requires `resolvedAt`. Its evidence records zero successful reads/writes/audit changes, unchanged originals and zero temporary sessions. A guarded resume verified that all checkpointed enquiry/message IDs were absent and the original hash still matched before adding the corrected fixtures. No successful mutation was repeated. Thirty-four dedicated enquiries and their test messages are retained in the isolated database.

Connected production-browser/API/PostgreSQL verification covers Customer Service history paging at 430px, a Sales Cashier reply, a Sales Supervisor assignment and a committed reply whose response is deliberately lost. Database and audit inspection precede explicit reconciliation; the original reply is not replayed. Three writes plus 28 audited reads produce 31 audit entries. All other original rows across 19 queried tables remain unchanged, including the earlier API fixtures. All temporary sessions are removed.

Before writes, both runners verify `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, test environment and credentials without elevated privileges, database/table ownership or TRUNCATE. Financial fixture tables are empty, so these checks do not establish populated financial behavior. Prior unchanged-schema migration replay and database-check evidence is reused. No application/shared database, schema/grant change, backup/restore, external provider, deployment or push operation ran.

## Limits

Receipts verify a received response; they are not durable original-request lookup or idempotency records. Browser-session recovery markers contain IDs, versions and fingerprints, not reply text. A missing/malformed receipt keeps changes locked through refresh/reload until fresh inspection and independent reconciliation; matching current state alone is not proof of the original request. Closing/clearing browser storage does not provide durable cross-device recovery. Add server-side operation receipts/idempotency for stronger recovery guarantees.

Replies are recorded in the customer-visible conversation. No email/SMS delivery is claimed. Public/customer notification delivery, physical devices, other browser engines, large-directory performance and deployed acceptance remain separate. Deploy the compatible backend before the new frontend.

See [page acceptance](../../frontend/docs/page-quality/workforce-enquiries.md) and ADM-75 in the root backend gap handoff. External evidence is under `C:/Users/PC/.codex/workforce-enquiries-*`.
