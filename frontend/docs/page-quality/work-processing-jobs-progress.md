# Processing jobs — design gate complete, implementation pending

Gate93 follows [accepted audit logs](work-audit.md). Accepted total remains92. The full goal remains active.

The route/components, actual query/DTO/retry/cursor rules, current authorization, navigation and reusable tests have been audited. Four baseline viewport captures430/768/1280/1440 were inspected natively. They show no overflow/page errors but excessive filter spacing, long raw-reference sections and repeated retry forms. A verified stopped preview was restarted; only1440 was resumed after a browser network suspension.

Fresh built-in ImageGen [desktop](work-processing-jobs-oct-concepts/desktop.png)/[mobile](work-processing-jobs-oct-concepts/mobile.png) concepts were generated, copied and inspected before runtime edits. The [audit](work-processing-jobs-oct-concepts/audit.md), [specification](work-processing-jobs-oct-concepts/spec.md) and [corrections](work-processing-jobs-oct-concepts/corrections.md) define a compact queue plus direct current inspection, one reviewed retry form, URL history and persistent uncertain-outcome reconciliation.

Required backend work: safe current-job read across all statuses; transaction-bound current actor/session checks; compatible null raw diagnostics; optional expectedUpdatedAt guard on retry. Preserve matching-attempt/status conditions, atomic notification-delivery reset/audit, provider idempotency and truthful queued-only outcomes. No schema change is anticipated. Do not run the old globally retargeting pagination suite on the retained fixture database; use focused owned fixtures and original-row hashes.

Next: implement the audited backend contract and generated types, then the specified frontend workspace; perform focused isolated/browser/connected checks and final native comparison. No gate93 runtime change or database write has occurred yet.
