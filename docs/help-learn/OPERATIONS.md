# Help & Learn operations

## Local scope and configuration

This milestone is local/test only. It does not authorise production publication.
There is no provider, model key, vector database, training service or new database
schema. No worker or integration is required. Existing launch restrictions apply.

API startup controls, all defaulting to false:

- `HELP_LEARN_ENABLED`: master read-service control.
- `HELP_LEARN_GUIDES_ENABLED`: optional guide definitions.
- `HELP_LEARN_PRACTICE_ENABLED`: optional simulation definitions.

`NEXT_PUBLIC_HELP_LEARN_ENABLED=true` exposes frontend entry points and learning
pages. It is a public build setting; rebuild to change it. API switches need a
normal reviewed restart/redeployment to take effect; there is no admin kill-switch
UI. All switches can be false while the original Help Centre remains available.
AI is always false and has no configuration path in this implementation.

## Isolation and privacy

Eight GET routes under `/api/v1/learning` and `/api/v1/public/learning` serve a
bounded catalogue and article/guide/scenario definitions. Public routes always
return public content, even with a staff cookie. Protected reads revalidate the
current account/session, MFA and effective assignment snapshot. Caller role, user,
branch and owner claims are not accepted. Unknown, unpublished, disabled and
ineligible items return the same unavailable response. No browser corpus contains
private instructions. All API responses are private/no-store and vary by Cookie.

Help search is documentation search, not record lookup. Context is a stable page
category; it never extracts record IDs, DOM text or form values. Search is bounded
to 120 characters and uses only already eligible content. Do not enter personal
details into documentation search. Plain React text rendering and fixed route/
target allowlists prevent content from becoming HTML, arbitrary links or selectors.

Practice loads only an eligible definition via GET. Its adapter has no fetch,
operational client, token, storage or integration. Fictional values and review
progress live in the current component instance; leave/reset clears that instance.
Progress includes definition ID/version, step/status and activity time. Example
replacement is deliberate and reversible by cancelling the confirmation. Reset
requires the current simulator nonce and rejects additional real-record IDs.
No endpoint accepts practice writes. Fictional input never uses the live form-draft
store. A completion is a reviewed exercise, not an assessment or a permission.
The only frontend fixture corpus is the public fictional part comparison in
`frontend/lib/learning/practice-fitment.ts`. Staff procedures and scenarios remain
server-filtered. Fictional searches run against those three local part records,
invalidate old results on edits, and never query live stock or fitment APIs.

Guides observe input/click events and let users acknowledge reading. They do not
click, fill, advance routes or submit operational actions. A missing/obscured target
and small layouts offer written mode; route changes pause the current guide.
Only guide ID/version/step/status/activity is kept in sessionStorage, under an opaque
server-derived access key. Version changes require restart. Identity events clear
learning metadata and mounted private views. Visible/focus/online and 30-second
visible-tab refresh recheck eligibility; stale responses cannot replace newer reads.
Previously delivered content cannot be retrospectively erased from browser memory
or screenshots. Server denial is immediate on the next request; the UI is a
bounded refresh mechanism, not a real-time revocation channel.

## Acceptance environment and commands

Use an explicitly verified, newly created loopback PostgreSQL `_ci`/`_test` database.
Follow AGENTS.md disk preflight and database-safety requirements. Keep credentials
in the local secret store, never in command output, source or chat. The native
local acceptance helper used for this run is outside the repository; it creates a
new task database and separate restricted runtime role, replays migrations with
the local migration identity, and checks the exact target before fixture writes.

The reusable test sources are `backend/tests/integration/learning.test.ts`,
`frontend/tests/unit/learning.test.ts` and `frontend/tests/e2e/learning.spec.ts`.
For browser acceptance, `backend/tests/helpers/learning-browser-server.ts` verifies
the isolated target/schema, creates synthetic workforce fixtures and binds only
127.0.0.1:5107. It stores synthetic session cookies under the owner's local
AppData database-verification directory; never commit or share that file. Start
it with the existing backend test environment preloaded and all outbound delivery/
payment providers disabled. It is a fixture harness, not an application entrypoint.

Run the frontend locally with BACKEND_ORIGIN=http://127.0.0.1:5107, learning enabled,
and the selected current launch mode. Set PLAYWRIGHT_BASE_URL to the loopback
frontend. Use installed Edge; do not download another browser. No real operational
submission is part of acceptance. Unit, API, mocked failure and rendered evidence
are distinguished in IMPLEMENTATION_STATUS.md.

## Rollback and future publication

Disable the affected API flags and restart the reviewed API; disable the frontend
build flag and rebuild for removal of entry points. The original Help Centre is
preserved. No migration/data rollback exists or is required. Do not disable the
workforce/authentication boundary or fall back to a client-bundled private corpus.

Before any separately authorised release: reconcile with current release worktrees,
run locked dependency CI and current role/launch checks, review business copy with
its policy owner, and satisfy existing backup/restore and release safeguards.
No production deployment, real customer write or future AI approval follows from
this document. Future AI must receive separate scope and retain this core.
