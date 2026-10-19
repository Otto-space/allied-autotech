# Vehicle stock creation

The existing `POST /staff/vehicles` creates one workshop stock record and one
transactional CREATE audit. It does not create a sale listing, photo, document or
condition report. Stock number is globally unique and normalized to uppercase;
VIN and chassis uniqueness remain enforced. Optional blank fields are null, mileage
can be zero, acquisition cost uses exact integer-kobo strings and acquiredAt is an
offset-aware instant.

Staff/Admin/Super Admin require authenticated MFA. Staff must have an active
assigned branch and cannot submit acquisition cost, including null. Acquisition
cost/currency are absent from Staff responses. Admin/Super Admin select an active
branch and may record acquisition cost. Staff may record acquisition time. Existing
CSRF and private/no-store boundaries remain independent of frontend checks.

## Validation correction

Uppercasing can expand a Unicode stock number beyond its input length, for example
repeated sharp-s characters. The request validator now checks the 40-character
bound after normalization as well as before it. An overlong canonical number
returns 422 before persistence rather than reaching the database column limit.
No existing record was rewritten, and no database schema or migration changed. Frontend validation also
checks canonical length and rejects impossible calendar dates before review.

## Frontend workflow and recovery boundary

The creation page groups identity, specifications, identifiers and acquisition.
It verifies current identity/active role and branch eligibility before review and
again before POST. All permitted submitted facts are reviewed. A successful full
record must match the request, active branch, role projection and fresh empty
record/version before navigation to the existing photo editor.

A minimal actor/role-scoped pending marker is verified in session storage before
sending. An uncertain or malformed response, 408/429, reload or account change
cannot automatically resend a creation. Account invalidation redacts metadata
while retaining a lock. A definite first 4xx rejection can release only its own
marker. A validated success stores the saved ID and clears the submitted draft.
An off-page selected branch is restored through the existing direct branch read.
Staff drafts remain scoped to the observed assignment and do not move silently
when that assignment changes.

There is **no original-request receipt** for this endpoint. Pending users can check
stock and explicitly acknowledge starting another empty draft. A matching stock
number or a missing search result does not prove the original request outcome.
The UI makes that distinction and does not claim an interrupted creation succeeded
or failed. Database uniqueness independently prevents a duplicate canonical stock
number. Optional durable receipt recovery is tracked as ADM-24.

If receipt recovery is selected, define actor-bound original request references,
payload matching, expiry/retention and same-key retry semantics. Persist
record/audit/receipt atomically and provide an authorized read-only lookup. Check
current Staff branch scope and acquisition privacy during recovery; a changed
assignment must not expose an old branch's protected record. Prove committed and
uncommitted lost responses, concurrency, changed bodies, different actors,
authorization changes, expiry and one-record/one-audit results in isolated tests,
then update OpenAPI, client types and explicit browser recovery together. Use the
safe forward-migration workflow if storage changes are needed.

## Acceptance and release

See [frontend gate 69](../../frontend/docs/page-quality/work-vehicle-create.md) and
`tests/integration/vehicle-stock-creation.test.ts`. API checks cover complete exact
creation for all three roles, duplicates, one CREATE audit, missing CSRF/MFA,
Customer/foreign/inactive/unassigned branch denial, private fields, dates and
canonical bounds. Real production browser/Express/PostgreSQL checks additionally
cover review cancellation, photo navigation, committed-response loss and locked
reload/manual reconciliation, plus a Staff reassignment before confirmation.

Only synthetic fixtures and owned sessions in the verified isolated test database
were written. No shared/application data, grants or migrations changed. Deploy
the validation correction with the dependent frontend and verify the target.
Vehicle detail remains the next separate page gate; stock queries with inherited
ignored parameters remain the separate ADM-23 follow-up.
