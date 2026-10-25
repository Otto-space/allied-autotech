# Customers and Customer Care acceptance contract

Baseline: released `71d3f60d`, reused worktree, branch
`feat/customers-care-20261025`. Notification source `345847d5` remains separate.
The actual directory is `WorkCustomers`, not the unused `CustomerDirectory`.
Existing account enums, authentication gates, review, drafts, customer ownership,
managed workforce scopes and support email observations remain authoritative.

## Bounded batches

1. Contracts and isolated fixtures; account transition and delivery-dismiss APIs.
2. Actual customer table/detail, copy controls and shared semantic states.
3. Conversation-first legacy/managed/customer care and focused creation.
4. Permission/session/audit, migration, rendered/responsive and regression checks.

## Mutation contracts

- `POST /admin/customers/:customerId/account-status`: MFA-verified administrator,
  CSRF, `{expectedStatus: ACTIVE|SUSPENDED, status: ACTIVE|SUSPENDED, reason}`.
  Reason 10–1000 characters. Lock/revalidate actor/session and target User; current
  CUSTOMER role required. Conditional transition rejects stale/already changed
  status with 409. DEACTIVATED accounts are outside this operation. Suspension
  revokes sessions and unused reset/verification tokens transactionally with audit.
  Reactivation never restores sessions/tokens. No outbound notification policy added.
- Delivery dismissal: explicit visible `{notices:[{id,revision}]}` (1–20 unique).
  Existing case authorization before any delivery access; managed workforce uses
  its current responsibility and branch/assignment scopes inside its transaction.
  Each stable revision hashes delivery status/reason/attempt and provider observation
  identity/time, never a fetch timestamp. Only attention notices are eligible.
  Persist per operator/delivery/revision; repeat is safe; stale/foreign/not eligible
  rejects the entire bounded batch, never silently reports partial success. History,
  attempts, observations and delivery state remain unchanged. New material revision
  is independently visible. No resend/retry permission is granted.

## Isolated acceptance cases

Fixtures: long identities, missing contact/address, active/suspended accounts,
customer promoted before mutation, Admin/Super Admin, CS, foreign branch and
unrelated technician, public/internal messages, old/new failure attempts.

- Real table headers/cells, explicit View details; copy does not navigate.
- Full value intentionally copied after successful secure clipboard write; denied
  clipboard has no false success and supports manual selection. Focus/touch access.
- Directory query and cursor trail survive detail/back. No invented totals/activity.
- Admin/Super Admin transitions; denied CS/customer; current-role/stale/concurrent
  checks; audit actor/target/reason/before/after; revoked sessions stay revoked.
- Sign-in/protected/MFA and session rotation enforce suspension; no federated sign-in
  exists in the current identity module. Test without any real customer operation.
- Dismiss persists across reads/reload, operator isolation, new revision resurfaces,
  scope denial, atomic stale batch failure, retained history and failure badge.
- Public/internal separation, draft restoration and listing-less Vehicle contracts
  remain unchanged. Conversation and next action precede technical disclosures.
- Render 360/390/768/1024/1440, desktop 1366×768, keyboard/focus/zoom, readable
  contrast and no page overflow. Fixtures are not real operational acceptance.

Evidence and exact limitations will be appended after checks, not preclaimed.
