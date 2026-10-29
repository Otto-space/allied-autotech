# W16E: owner support coverage and durable recovery

29 October 2026, continuing from integrated master `427202e7`. This is a local
implementation checkpoint, not a production configuration or live-chat release.

## Behaviour and authority

The existing owner-only coverage API remains the authority. The new disclosure in
Customer Care opens only for the current Super Admin session. Active branch selection,
Lagos support windows (including an explicit 24:00 end), policy state, one-to-five
conversation limits and a private audit reason are reviewed before saving. Workshop
hours are never copied into support hours. Empty coverage stays disabled and empty.

Drafts for different branches remain in page memory. A changed configuration retains
the draft and requires explicit adoption of the current revision. Session or duty
invalidation discards protected work. Denied current access removes the private
editor. Saving policy does not enable the live-release flag or opt in a representative.

Coverage PUT optionally accepts the existing non-bearer support operation-key format.
Its established response shape is unchanged. New owner-only GET/DELETE operation
routes reauthorize the current session, MFA and active branch; DELETE requires CSRF.
They use existing transaction locks, a 24-hour database-clock window and existing
IdempotencyRecord storage. Receipts contain only a branch reference and saved
revision, or a cancellation reference. Private reasons and schedule commands are
hashed, not retained in receipts or browser storage. The original save and audit
are atomic. Cancellation blocks an unsaved delayed command and preserves a save
already committed. A recovered saved revision is distinct from a newer configuration.

Browser reminders contain only an opaque operation key, under a hashed identity and
branch slot. Corrupt/unavailable storage fails closed. Lost or malformed responses
keep saving locked until checked or durably cancelled; no command is automatically
resent. Expired recovery references remain explicit failures. Identity invalidation
redacts this feature's reminders alongside the existing account recovery state.

No schema, migration or application-role grants change. OpenAPI, endpoint handbook
and generated frontend contracts include the new routes and optional header.
The CI availability/channel step now includes the new native recovery suite.
Owner-only Help/Learn article `support-coverage` is version 1, reviewed 29 October.

## Actual evidence

- New restricted-runtime native recovery suite: 11 pass. Replay, changed commands,
  cross-branch references, cancel/save races, concurrency, original versus current
  revision, expiry/future references, roles/CSRF, reference privacy and flag safety.
- Existing native regressions: 60 Care/session/handoff and 20 availability pass.
  The fresh isolated target replayed all 78 migrations and passed db:check. Target:
  `allied_w16e_coverage_20261029_d72d5494cab8_ci`, loopback 127.0.0.1:63888.
  Runtime credentials do not own tables or have schema/TRUNCATE/ledger-write rights.
- Backend availability/help units: 28 pass. Final combined frontend contracts,
  creation/reply recovery and managed-channel checks: 52 pass, including 15 new
  coverage contracts. Final backend/frontend types and scoped lint pass; the secret
  guard passes over 3,454 non-ignored files. API artifacts retain generator output;
  generated frontend types are checked by TypeScript (formatting-excluded by policy).
- Eight final intercepted browser cases passed: empty mobile editing/review/save,
  lost saved response/reload, unknown unsaved operation/cancellation, populated
  midnight windows and retained branch drafts/stale revision, Staff/Admin exclusion.
  Mobile 390px and desktop 1440px overflow/Axe checks passed; screenshots were
  visually inspected. Keyboard Add/Remove focus and denied-access removal also
  pass. Each final case checks uncaught page errors and the development error overlay.
- Baseline failures are retained: missing recovery endpoints returned 404; the new
  audit-count fixture initially used actorUserId instead of AuditLog.userId. Its
  ten failures are not ten proven defects. An existing native Care article-version
  assertion was updated from two to the implemented three. The first browser run
  used an unsuitable exact-label select locator; accessible combobox locators pass.

The installed local Next is 16.3.8; the lock requires 16.4.3. Browser plugin absent,
so existing Edge/Playwright is used. No real role, physical-device, full screen-reader,
hosted or actual browser/API composition acceptance is implied. Logs and screenshots
remain outside Git under `%TEMP%/allied-w16e-*`. Only isolated fixtures were written.

## Remaining goal and release gates

Approved business support hours/staffing and operational live-readiness evidence
remain dependencies; they are not filled with demonstration data. Shared connection,
multi-instance/reconnect/load acceptance, the 106 exact-route completion decisions,
and final bounded provider re-evaluation remain unfinished. Provider call allowance
is exhausted and unchanged; no paid provider calls ran. AI/live flags stay off.

The preceding W16D source is committed/integrated and its three exact-source checks
passed. Its backend-only packaging checkout remains pinned and clean. Docker's
engine is unavailable; the owner's startup-screen response is pending. This is the
reviewed W16E implementation checkpoint; exact integration/check/publication status
must be established from release receipts. No W16E production change is claimed.
