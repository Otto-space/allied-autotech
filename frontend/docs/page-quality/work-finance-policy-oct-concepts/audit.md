# Financial policy — gate 87 audit

Baseline captured and visually inspected at 430, 768, 1280 and 1440 pixels. The existing page gives most space to a single-column approval form. It labels the latest recorded version but does not independently identify the policy currently selected by the backend. A scheduled version can therefore dominate the page while an earlier policy remains effective. The last 100 versions cannot reliably establish the current policy. Desktop textareas are unnecessarily wide; mobile users scroll through explanatory text before reaching the approval fields.

Actual rules: Super Admin may read without a finance approval grant. Staff and Admin need FINANCE_POLICY_APPROVE to read. Every publisher, including Super Admin, needs the live grant. Publication appends an immutable version with expectedVersion concurrency and an atomic audit. Effective selection orders by effectiveAt then version, not highest version alone. Preserve the existing finance constants, scheduling rules and existing transaction snapshots.

Required gaps: authoritative current/latest/next scheduled read from the entire history; private audited reads; persistent actor-bound ambiguous-publication lock; fresh permission/version checks and complete publication receipt verification. No schema change is needed. Existing shared review, feedback, controls and dashboard shell will be reused.
