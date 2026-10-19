# Branch administration contract and verification

Implemented and locally accepted for the dedicated `/admin/branches` workspace on 19 October 2026. See the [milestone91 report](../../frontend/docs/page-quality/work-branches.md).

## Compatible contract changes

`GET /admin/branches` accepts optional `q` (2–100 characters) and exact `code`, combined with the existing active-status filter and ascending UUID cursor pagination. Search is case-insensitive across name, code, city and state. SQL wildcard characters are escaped, so `%`, `_` and backslash are searched literally. Code normalization uses the existing uppercase branch-code contract. There is no inferred total count.

`PATCH /admin/branches/:branchId` accepts optional `expectedRevision`, equal to the inspected branch `updatedAt`. The service checks it under the existing branch advisory lock and rejects stale edits with409. The saved timestamp advances by at least one millisecond. Legacy clients that omit the revision remain compatible; the new frontend always includes it. Revision-only bodies are rejected with422. The revision condition is not a persisted field or an audited business change.

All four administrative branch operations recheck the current actor/session under the existing organization access lock. Their responses explicitly use `Cache-Control: private, no-store`. Existing safe DTOs, atomic READ/mutation audits, Admin/Super Admin authorization, verified-session/MFA/CSRF requirements and workforce boundaries remain authoritative. The actual response shapes are documented in OpenAPI and generated frontend declarations.

Deactivation still rejects active Staff accounts assigned to the branch. Branch assignment/deactivation locking is preserved. Public `/public/branches` reads remain active-only. No opening-hours, maps, staff-count, deletion, schema or migration capability was added.

## Focused isolated verification

Four API scenarios have passing evidence:

- Combined name/code/city/state search, literal wildcard characters, exact code, status, two-page UUID traversal, private headers and exact safe response keys.
- Changed fields with an advancing revision, nullable contact clearing, stale rejection, one winner from concurrent writes sharing a revision, legacy unguarded compatibility and exact mutation audit counts.
- Active assigned Staff preventing deactivation, then deactivation/reactivation of a newly created synthetic branch and the real active-only public route.
- Invalid query/body validation, unique codes, Staff denial, missing CSRF, incomplete MFA and stale service actors for all four branch operations.

The first run passed search and revision/concurrency. Two test assumptions were corrected: the public URL includes `/public`, and validation returns422. A focused continuation reused the retained synthetic fixtures and ran only the two affected cases. It did not recreate fixtures or repeat successful creation/search/concurrency work. The public visibility transition was checked again because the earlier assertion used the wrong route.

Before each write phase, the actual target was confirmed as `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, with `NODE_ENV=test` and a runtime role without elevated PostgreSQL flags. The database was created in isolation and replayed/checked at milestone89. No new schema change required another migration replay. Existing runtime ownership, schema CREATE and TRUNCATE restrictions are retained.

Whole-row hashes confirmed unchanged original55 users and33 branches, their customer/staff profiles, all prior invitations, outbox events, capability grants, workforce access and assignments. Four new synthetic branches and two synthetic accounts were retained. The continuation changed only its owned synthetic account/branch fixtures. All owned temporary sessions were removed. No application/shared database or existing grant was changed.

## Recovery and remaining backend gap

The frontend persists a minimal actor/role-bound marker before submission: random token plus update target UUID, or the public code for creation. It stores no address, contact details or full request body in this marker. Unavailable storage prevents submission. A lost or invalid receipt locks further writes across reload; exact-code/direct-record inspection and independent audit/administrator reconciliation are required before unlocking. Requests are never replayed automatically.

Durable original-request receipts remain an optional backend improvement. A future request key and safe receipt should be committed atomically with the authorized mutation/audit, distinguish original success from current state, reject changed payloads and recheck current access. Test concurrent retries, actor revocation and lost responses on isolated databases. Any persistence change must follow the forward-migration and data-preservation workflow. Current matching records alone do not prove the original request outcome or provide cross-device idempotency.

## Connected production evidence

Production Next.js, Edge, the real Express API and isolated PostgreSQL completed five writes on one new synthetic branch: creation, reviewed name/contact update, deactivation, reactivation and a committed update with a deliberately lost response. Public inspection returned404 while inactive and200 after reactivation. The database contained the exact expected fields and five mutation audits.

The uncertain update stayed locked across mobile reload. Current branch inspection and independent audit reconciliation unlocked the editor without sending the request again. There were exactly five domain requests, no page errors and no mobile overflow. All20 production browser scenarios, six units, production build and eight runtime/generated source-hash comparisons also pass.

Whole-row hashes preserved57 existing users,7 customer profiles,52 staff profiles,37 branches,18 invitations,13 outbox events,1 capability grant,14 workforce-access rows and16 assignments. The one owned temporary session was removed, with zero remaining verified. The synthetic branch is retained. Evidence is under `C:/Users/PC/.codex/work-branches-{real,api-tests,api-continuation}*`.

ADM-57 records the implemented contract; ADM-58 retains the optional durable-receipt improvement. No backup/restore, off-device recovery verification, external delivery, push or deployment has run for this milestone. Shared/production rollout still requires the database-safety checks documented in [database-safety.md](database-safety.md).
