# Processing-job suppression checkpoint

The existing care-triage article is version 4. Its care eligibility and destination
remain unchanged: this content grants no administrator/job-retry permission.
Explains that Not sent can be intentional suppression, directs users to authorised
case history, and forbids consent changes or retries to bypass the restriction.
No learning, AI, delivery or destructive-processing flag is enabled.

Job inspection returns only an optional allowlisted support-email suppression code.
Raw errors, encrypted payloads and recipient fields stay excluded. Unknown reasons,
other event types and completed/pending states are not classified as suppression.
The retry update atomically excludes recorded suppression; the UI removes the
ordinary retry action for those inspected records. Queue list shape is unchanged.

Compatibility: current-job GET adds the field only for the explicit
`diagnostics=safe_delivery` query. Requests without it retain the exact legacy
response shape. Other query values and repeated parameters are rejected. Publish
the compatible backend before promoting the new frontend, following the normal
release workflow. This supersedes the earlier frontend-first proposal. No schema
migration is required. The retry restriction also applies to legacy callers.

Acceptance: backend allowlist/privacy unit tests and frontend legacy/scope tests;
isolated integration test for every restriction preserving status/error/revision;
rendered consent-suppression case with no retry control or real submission.
Database and rendered results must be recorded after execution, not inferred from
the presence of tests. Existing Admin/MFA checks and Customer/Staff denial remain.
