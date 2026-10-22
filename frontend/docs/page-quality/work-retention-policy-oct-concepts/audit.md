# Retention policy audit — before runtime edits

Current route `/admin/retention-policy` renders the generic OperationalPolicy RETENTION form. Production baselines at 430/768/1280/1440 were captured and inspected with no overflow/page errors. All fields span the full desktop width and push history below the entire form. There is no independently selected effective policy, the breadcrumb uses plain separators, version refresh remounts the form, and uncertainty is memory-only. Current dynamic retention rows do not use the existing FormDrafts structure hooks.

## Contracts

GET `/admin/policies?key=retention&limit=100` is Super Admin/MFA history, not an authoritative effective-policy selection. Add the same private current workspace envelope as the accepted complaint/dispute pages: evaluatedAt/current/latest/nextScheduled/history, independently selected across all versions under current actor/session validation, consistent snapshot and minimal atomic RETENTION_POLICY_CURRENT READ audit. Reuse bounded retries only for database-aborted reads.

POST `/admin/policies` kind RETENTION requires Super Admin/MFA/CSRF, nonnegative expectedVersion, trimmed source 10–500, approvalEvidence 20–1000 and ISO effective time with existing backdating tolerance. It atomically creates immutable APPROVED/Q13 provenance and CREATE audit after the policy advisory lock and expected-version check. Add the current transaction actor/session lock for RETENTION; no contacts/capability or schema change is needed.

Settings are strict: destructiveExecutionEnabled is literally false; records contain 1–20 rules. Each rule has recordType ACCOUNT/PAYMENT/INVOICE/AUDIT/SUPPORT, whole retentionMonths 1–1200, trimmed startEvent 5–200, disposition REVIEW_ANONYMIZATION/REVIEW_DELETION/RETAIN, trimmed legalBasis 20–1000. No uniqueness constraint forbids repeated categories, no defaults imply business-approved periods, and no API toggles destructive execution. Preserve this exact contract.

The retention worker is an unimplemented declaration; publishing does not delete/anonymize records, release holds or approve privacy requests. Existing privacy-review protections and expiration/identity cleanup remain separate. Do not add destructive actions or legal advice. Own-profile/current actor gates and exact Q13 receipt/recovery use the accepted policy patterns.

## Implementation and acceptance

Fresh complete desktop/mobile/rule-editor concepts precede runtime edits. State/history sits beside a grouped editor on desktop and above it on mobile. Each editable rule groups category/months, start/disposition and full-width legal basis; deliberate Add/Remove operates on the draft. Current/history rule disclosures preserve complete legal text and bound initial rendering. Written approval remains separate and empty for each new version.

Use existing FormDrafts data-draft-row/add/remove hooks with indexed `retention.*` names and hidden recordKey values compatible with operationalFormSettings. Stable React row keys preserve unsent row values while indexed draft names restore add/remove structure. Capture the base-version context when adding/removing even if no field was typed. Test add/remove/reindex/reload and newer-version conflicts. Preserve the literal false flag, required limits, full long text and minimum one/maximum20 rows. Unknown publication outcomes remain locked after reload; no automatic replay.

Acceptance: seven widths and Axe, real review/focus/row/draft interactions, role/validation/receipt/recovery checks, affected policy regressions, isolated authenticated API/concurrency/preservation, production build, two intended connected future publications including committed-lost-response reconciliation without replay, four native concept comparisons and source hashes. Browser plugin absent: use existing Playwright/Edge fallback with sequential browser processes. No shared/application database, schema/migration, worker/provider, backup/restore or deployment work is authorized by this page change.
