# Financial policy workspace

Implemented locally on 18 October 2026. Deploy the compatible backend and frontend together; deployed acceptance remains open.

## Contract

`GET /staff/finance-policy/current` returns `evaluatedAt`, `current`, `nextScheduled`, `latest` and at most 100 `history` records. Current and next scheduled selection consider the entire finance history. Current orders eligible rows by effective time descending, then version descending. Next scheduled orders future effective time ascending, then version descending. Latest means highest recorded version and may be scheduled. Selection uses one server evaluation time and a Repeatable Read transaction. An approved status is a stored fact, not a claim of legal validation or operational availability beyond the existing finance gate.

`GET /staff/finance-policy` retains its array response and 100-version limit. Both reads reject unsupported query keys, send private/no-store responses and atomically record minimal READ audits with a resource name and returned count. Other policy histories remain outside this delegated read scope.

Staff and Admin require a live FINANCE_POLICY_APPROVE capability. Super Admin retains the existing read exception. Authentication continues enforcing active accounts, MFA and workforce access. Publishing through `POST /admin/policies` still requires the approval capability for every role, including Super Admin, CSRF, expectedVersion concurrency and written provenance. Existing publication locking, scheduling tolerance, immutable versions, calculation constants and transaction snapshots are preserved. The existing publication response is now documented with its actual DTO. No schema migration is required.

## Client guarantees and limits

The UI separates effective, next scheduled and latest recorded policy. Refresh keeps an unsent draft. A fresh own-profile and policy read precedes publication; stale versions stop before POST. Receipt validation checks actor, version, effective time, approval status, source question, provenance and all settings. Only a verified receipt retires the submitted draft. Cancel restores the review control; success focuses the recorded-policy confirmation.

A minimal actor/role-bound session marker contains a random token, expected version and request fingerprint. It survives reload, is redacted on account invalidation and blocks replay when storage or the response is uncertain. Recovery needs a new authorized read plus explicit independent reconciliation. This is a browser-session safeguard, not server idempotency or a cross-device receipt. The existing concurrency check remains authoritative. Optional durable request receipts are tracked as ADM-52.

## Verification and data preservation

The actual isolated target was verified as 127.0.0.1:55480 / allied_work_aftercare_20261017_test before fixture writes. Runtime credentials were restricted. Three API/database scenarios have passing evidence, including a current policy excluded from the last 100 records, role/grant boundaries, query validation, CSRF, exact future publication, stale-version rejection and unchanged prior policy/financial hashes. A fixture session timestamp and the validation-status expectation were corrected; the failed authorization case was rerun alone without repeating completed policy publications.

Connected production Edge/API/PostgreSQL recorded two future policies and two CREATE audits. A successful publication exposed a focus issue; the UI was corrected and verified with focused production tests. The connected run then resumed with the remaining lost-response case without replaying that successful publication. The resumed hash baseline includes that first future version: all 122 preexisting policy records, the effective current policy, 38 payments, 38 attempts, 31 refunds, 37 invoices, eight ledger entries and 29 disputes remained unchanged. Nine READ audits occurred during the resumed workflow; all owned temporary sessions were removed. Synthetic future policies are retained.

Frontend evidence covers 28 distinct passing production browser cases, a final six-case focused pass, five unit tests and 16 distinct new page/viewport accessibility states, plus the retained legacy review scan. Type, lint, build, OpenAPI and route coverage checks passed. Existing 60-migration evidence was reused because this change has no database schema or grant change. No application/shared database, backup/restore, off-device recoverability, external payment provider, push or deployment verification was performed for this gate.
