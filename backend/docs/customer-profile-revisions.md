# Customer profile revisions and draft recovery

Profile text updates now require the revision the customer read. Two sessions editing the same profile can no longer silently overwrite each other. Photo `mediaVersion` remains independent.

## Contract and persistence

`GET /customers/profile` and successful `PATCH /customers/profile` return `profileVersion`, initially zero. PATCH requires numeric `expectedVersion` (0 through 2,147,483,646) and at least one supported contact field. Missing/invalid revisions and unknown writable fields return 422. The customer identity always comes from the authenticated session.

The database update compares the owned profile's revision and increments it in the same statement. A competing/stale update returns 409 `STALE_VERSION`, leaves contact data unchanged and creates no update audit. The profile write, reread and changed-field audit share a transaction. Failed auditing rolls back the contact values and revision. Accepted requests advance once even if a submitted field already has that value. Audit metadata contains field names and the resulting revision, not their personal values or the request control field.

Migration `20261013100000_customer_profile_revision` adds the nonnegative revision and a trigger. Other database writers changing contact fields also advance it, while photo-only updates leave it unchanged. Arbitrary jumps and rewinds are rejected. A changed phone number loses its previous `phoneVerifiedAt`; changing an address or resubmitting the same phone retains existing verification. Existing profiles are initialized without rewriting their contact values or verification timestamps.

Authentication, customer-only access, CSRF, strict validation, owner scoping, no-store responses and optional-field clearing remain enforced. Staff, Admin and Super Admin cannot edit customer text through this route. No role or media permission was widened.

## Frontend behavior

The profile editor saves its values, original contact baseline, revision and uncertain-save state in the existing account/route-scoped session draft storage. It owns that draft explicitly so a general form-restoration pass cannot replace its revision with a fresh server read. Data remains available on tab changes and reloads in that browser tab. Another account or role cannot read/write this draft. Browsers that deny session storage cannot provide reload persistence.

A newer profile revision or 409 locks saving while retaining the entered values. **Reload saved details** fetches the owned profile and shows its saved values alongside the preserved draft. **Keep my changes** carries forward only fields edited against the original baseline, retaining unrelated server edits. It does not submit; the customer reviews and saves explicitly. **Use saved details** discards the draft after that review. Another change after review still fails the backend revision check.

Before sending PATCH, the editor persists an uncertain-outcome marker. A dropped response followed by reload therefore cannot silently repeat the update. The customer fetches and reviews the saved record; if the original change committed, keeping the draft produces no new change or second PATCH. Durable server-side idempotent replay is not part of this contract. Legacy or damaged draft context requires explicit review while preserving readable entered fields. Successful saves and explicit discards clear the draft.

## Verification

All 73 selected backend cases across nine files passed. A final 21-case profile revision run also passed after adding an explicit repository guard against omitted or invalid revisions, bringing the verified total to 74 unique backend cases. Coverage includes competing requests, stale/lost-response retry rejection, refreshed revision acceptance, independent media versioning, phone verification, other database writers, revision guard constraints, audit rollback, malformed/missing revision, field injection, owner/role boundaries and CSRF. Existing customer-directory, profile-media, confirmation-concurrency, private-storage and Phase 3 regressions also passed.

All 430 frontend unit tests passed. Across the focused browser runs, 48 unique cases passed: 39 existing profile-quality cases, three revision/recovery cases, four form tab/reload persistence cases and two real API/database scenarios. The real scenarios verify competing authenticated sessions and a committed PATCH whose response is deliberately dropped. Explicit review preserves unrelated saved fields and avoids a duplicate PATCH after a lost response. Desktop/mobile conflict views were inspected; responsive and accessibility checks passed.

All 56 migrations replayed on fresh `allied_profile_revision_20261013_test`, followed by a clean Prisma schema comparison. An additive upgrade of `allied_backend_release_20261013_test` preserved a canonical digest of every prior column across 5,347 synthetic profiles; all received revision zero. Application database migration/reset was not performed.

Backend and frontend type checks, lint and production builds passed, including frontend standalone packaging. OpenAPI/route checks, changed-file formatting, the secret guard and `git diff --check` passed. The final real-browser fixture had revision seven and exactly seven profile-update audit entries, with media revision zero. The isolated API and development server were stopped after verification.

The first new test fixture used inconsistent session timestamps and the wrong audit-column name. Both fixtures were corrected without changing production constraints or assertions. Browser verification also caught and repaired a form reset that retained its original default values after a successful save. Local evidence retains the initial failures alongside final results.

Backend JSON evidence: OS temporary files `allied-profile-revision-regression.json` (73 passing) and `allied-profile-revision-final-guard.json` (21 focused passing). Frontend unit evidence: `allied-profile-revision-frontend-units.json`. Final focused browser artifacts: `allied-profile-revision-final-playwright` (11 passing; two real scenarios interrupted by machine sleep and a repeat-fixture issue) and `allied-profile-revision-real-final-playwright` (both real scenarios passed after the fixture was made repeatable). These are aggregate results, not a claim of one clean 48-case run. Migration/upgrade evidence: `allied-profile-revision-migrations.log`, `allied-profile-upgrade.log` and `allied-profile-upgrade-before.json`. The full 857-case baseline in [the preceding audit](backend-completion-audit.md) predates this change and is not relabeled as a rerun.

## Rollout

Drain older API instances that accept unversioned profile writes, apply the additive migration through normal migration deployment, regenerate Prisma and release the matching backend and frontend/generated contract. A rolling fleet retaining old write handlers would not enforce this request precondition consistently. Existing browser clients must reload; missing revisions are intentionally rejected rather than silently accepted. Worker clients should be regenerated with the same release. Do not remove the trigger or provide an unversioned fallback.

Deployed role/session behavior and real provider/storage acceptance remain open. No Spaces credentials, external deliveries, payment activation, Monnify enablement or booking deposit change is included.
