# Customer vehicle-payment history filter — 27 October 2026

## Result

The vehicle-purchase detail previously fetched up to 100 pages of every payment in the customer's account to find payments for one transaction. A customer with a large unrelated history could not reliably review or request a vehicle payment, even if that purchase had few payments.

The compatible candidate adds optional `vehicleTransactionId` to `GET /customers/payments`. The database query always includes the authenticated customer profile and applies the target and existing status filters before its ordered cursor page. A cursor supplied for another customer, target or selected status returns the existing generic payment-not-found error. An unknown or differently owned target returns an empty page, without identifying its owner. The staff payment-list contract is unchanged.

The purchase panel requests the target-filtered pages and rejects any returned row with a different target, repeated record or cursor, failed request or history exceeding its existing 100-page bound. These failures continue to block a new payment request. Server-side source eligibility and target-wide payment locks remain authoritative; the filtered read does not grant payment creation or change amounts, providers, policy or payment mode.

## Verification and release boundary

- Combined the last recorded production frontend source `8fa386cb` and inventory-hotfix backend source `3bb51d21` in merge `939a2982`. The merge's only conflict was the append-only completion tracker; both release-note sequences were retained. No unrelated worktree was reset or deleted.
- A new loopback-only PostgreSQL 18 `_ci` database on `127.0.0.1:55437` replayed all 72 migrations with no Prisma schema difference, then passed `db:check`. The focused real-service integration passed for ownership, target filtering, cursor pagination and rejected foreign/wrong-target cursors. The task-created container used temporary storage and was stopped/removed. No application or production database was written.
- Backend and frontend TypeScript, scoped backend oxlint/frontend ESLint and generated OpenAPI validation passed. The private OpenAPI artifact, handbook and frontend API types were regenerated from this source.
- Six focused Edge/Playwright cases passed on the locally compiled purchase detail at `localhost:3145`: three later-page unresolved states, mismatched-target failure, request failure and repeated-cursor failure. The initial `127.0.0.1` attempt hit Next development-origin blocking and was stopped; it is not counted as acceptance. The local installed Next version is 16.3.8; the lockfile requests 16.4.3, so exact-lock CI and a compatible hosted check remain release requirements.

This checkpoint is local only. Before production, run exact-source locked CI, release the compatible API before the frontend, verify both custom-domain deployment identities and backend readiness, and sample a genuine authorized customer journey without creating a financial transaction. Paystack and Monnify remain disabled. Full payment/provider reconciliation, device and all-role acceptance remain separate site-completion work.
