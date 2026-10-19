# Staff account detail — historical implementation progress

Started 18 October 2026 after milestone 88. Superseded on19 October2026 by the [milestone89 acceptance report](work-staff-detail.md). The remaining-work statements below describe intermediate checkpoints, not current status.

## Completed foundation

- Audited actual account, capability and workforce endpoints, DTOs, authorization, validation, transactions and existing UI flows. See the [audit](work-staff-detail-oct-concepts/audit.md).
- Captured Admin baselines at430/768/1280/1440 and Super Admin at430/1440. Created fresh built-in ImageGen desktop/mobile concepts and inspected both natively before runtime edits. Specification, prompts and corrections are preserved in the concept directory.
- Implemented named semantic breadcrumb, compact identity/role/status/branch band, paired account facts, secondary reference disclosure and grouped access form. Existing account actions, branch picker and confirmation dialog remain integrated.
- Added current own-profile identity/role/ACTIVE checks before private account reads. Strict identity/branch projection parsing, explicit stale facts, disabled stale actions and cleared denied records are implemented.
- Frontend typecheck and focused runtime lint passed. Twelve new development browser cases passed, including seven responsive/Axe widths, three own-profile boundaries, stale-to-denied recovery and mismatched/null-profile handling. All ten legacy account-action cases now have passing evidence: nine passed initially, and the remaining case passed its focused rerun after two missing workforce/public-branch fixtures were supplied. These are development checks, not final production acceptance.
- Four-width Admin and two-width Super Admin development captures completed without overflow/page errors. Native1440/430 Admin captures were inspected. A cold development compilation exceeded the first capture's navigation timeout; only that stopped capture was restarted after the route compiled.

## Required before acceptance

### 19 October: account and permission recovery phase

Account requests now send an optional, backward-compatible server revision condition checked under target account/profile locks. Private account/capability reads and receipts are documented, and capability reads have minimal atomic READ audits. Account, permission and workforce panels share an actor/target-bound pending lock that survives reload, refuses submission when storage is unavailable, and requires fresh inspection plus independent reconciliation before local unlock. Account and capability receipts are validated; workforce receipt validation still needs completion.

Eleven affected development browser cases and two recovery-storage units passed. API evidence covers revision conflicts, one concurrent winner, session revocation, demotion and private audited capability grant/revoke. Two initial API cases passed; the third completed its mutations before a409-versus403 expectation failed. A focused continuation checked the remaining rejection assertions without replaying those mutations. Existing records and retained fixtures were hash-checked; owned temporary sessions were removed. Type/lint/format and OpenAPI/route checks passed. See the [backend evidence and limits](../../../backend/docs/staff-account-management.md).

The earlier12 new foundation cases and ten legacy cases remain scoped development evidence; eight affected legacy cases were included in the latest11-case run. Do not add overlapping counts as distinct scenarios. No final production or connected UI/API/database acceptance has been claimed.

1. Finish validating the coordinated workflow against workforce mutations, including malformed success receipts, actor changes and independent reconciliation. The shared pending lock and account/capability integration are implemented.
2. Match workforce action visibility to target eligibility and delegated Admin scope; support complete branch discovery, receipt validation, full review facts, date validation, password visibility and password clearing. Preserve shared workforce-entry/workspace flows and smoke-test them if their shared panel changes.
3. Finish workforce read/receipt/eligibility contracts identified in ADM-54. Account concurrency and private audited capability reads now have implementation and isolated API evidence. Preserve current role/session/invitation rules and all existing data.
4. Verify status/branch/demotion, capability grant/revoke and workforce enrollment/assignment/revocation/delegation, including stale, denial, conflict and lost-response recovery. Use additive isolated fixtures and preserve existing records; no application database tests.
5. Finish all concept states and native responsive comparisons, focused static checks, production build/browser tests, connected API/database workflow and preservation checks. Then write the acceptance report and update the milestone count.

Private evidence prefix: `C:/Users/PC/.codex/work-staff-detail-`. The development server uses3071 in the existing isolated build snapshot. Production3070 was stopped before development to avoid sharing `.next`. No database writes, migration/grant changes, backup/restore or deployment operation ran during this foundation pass. The overall goal remains active.
