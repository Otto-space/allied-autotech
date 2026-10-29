# W16F: native coverage composition

29 October 2026. Continues the W16E implementation integrated at `f9a7b7ce`.
That commit passed all three exact-source GitHub gates. Its held frontend candidate
is READY (`dpl_2MZ9NkWixm5hkGWk8TUm1XriLm59`), without the public domains.
Docker's failed-update notice and protected-candidate test access remain separate
publication dependencies. No new provider call or feature enablement is authorized.

## Acceptance contract

The owner opens the existing Customer Care coverage disclosure and prepares explicit
Lagos windows. No write occurs before review/confirmation. Real browser requests
cross the existing Next proxy, session/MFA, CSRF and coverage API into a restricted
isolated database. Branch drafts remain independent. A committed response lost in
transport recovers after navigation with one opaque browser reference and no resend.
An unsaved interrupted request remains UNKNOWN until reviewed durable cancellation;
the next explicit change gets a new key. Save count, revisions, reference-only
receipts and audit count must agree. A policy save must not enable live support,
opt in a representative, create a support message or change inventory/bookings.

Actual Admin and Staff sessions must not see the owner editor and their direct
coverage reads must receive 403. Owner coverage authority remains distinct from
Care queue duties: the synthetic owner has no Care assignment, so the two actual
queue reads deny access with explicit feedback. This is not an empty-queue claim
or a reason to grant the owner additional operational responsibilities.

## Isolation and harness

`backend/tests/helpers/support-coverage-browser-server.ts` is a test-only entrypoint,
not imported by application startup. It requires an explicit browser-test flag,
loopback port 63888 and a uniquely named `coverage_browser_<hex>_ci` database. It
checks actual target identity, schema and non-owning/non-TRUNCATE runtime privileges
before making synthetic fixtures. Its HTTP mutation boundary allows only CSRF and
the selected fixture branch's coverage/recovery operations. No worker is started;
delivery, provider and live flags are off. Only the loopback Next proxy is trusted.

Two one-shot socket failures model transport, without mocking the application API
or database: the second PUT loses its successful committed response; the third is
dropped before application handling. Recovery and cancellation use the actual API.
The evidence route returns counts/reference field names, never cookies, reasons or
customer records. Synthetic cookies stay in an owned temporary file and browser
tracing is disabled. Graceful shutdown revokes only the harness's sessions and
removes that temporary cookie file. Isolated database evidence is retained.

The frontend native suite additionally verifies the preview returns both exact
fixture branch identifiers before any operational test action. It refuses other preview URLs.
The already running local 3171 preview was verified against these exact identifiers
and reused. Its API origin is the loopback harness on 5021.

## Evidence checkpoint

Initial run: the complete owner persistence/recovery/cancellation assertions reached
their expected final state, but the final console assertion rejected the two valid
403 queue responses and an existing not-found CSS preload warning. Admin exclusion
passed. The Staff fixture had no branch and could not enter the branch-dependent
legacy workspace. These are harness/fixture findings, not three application defects.
The first standalone helper typecheck omitted Express declaration augmentation and
was corrected to include `src/types/express.d.ts`.

The corrected suite verifies each expected queue denial and its visible feedback;
all other errors fail. Existing shared console verification validates the same-origin
fallback CSS response/selector before annotating its preload warning. The Staff
fixture has a real synthetic active branch. A new empty isolated replay is used for
the corrected canonical run. An intermediate run exposed a test timing error: the
opaque reminder appears while PUT is still in flight. The test now waits for the
review dialog to close before inspecting the final database revision. A subsequent
read confirmed the earlier save had committed; no application repair was needed.

Final three native browser cases pass (56.2 seconds): full owner transport recovery/
cancellation, actual Admin exclusion and actual Staff exclusion. Four explicit PUTs
produce three saves/audit entries, one cancelled reference and two explicit outcome
reads. There are three saved references and one cancellation, each containing only
reference field names. Inventory, bookings, support messages, the other branch's
revision and live enablement remain unchanged. No representative is opted in.
The corrected run reuses its isolated database with new fixture branches; receipt
evidence is bound to the selected branch. Both isolated targets replayed all 78
migrations from empty and passed schema verification. No shared database was used.

Frontend types/lint and strict helper typechecking with Express augmentation pass.
An additional read-only transaction assumed the actual isolated runtime role and
passed the strengthened startup guard: no schema/database CREATE, migration-ledger
write, TRUNCATE, ownership, replication, superuser or role-creation rights. The
harness stopped cleanly, revoked its own sessions and removed its cookie file.
Scoped formatting and the 3,465-file secret guard pass. Existing Next 16.3.8 is
reused; exact-lock evidence remains the separate GitHub gate. The final 390/1440px
coverage checks report no horizontal overflow or scoped Axe violations. Viewport
screenshots were inspected. A tall element screenshot included a fixed-link capture
artifact: a separate DOM check proved the unfocused skip link was above the viewport
(bottom -17.43px). Fresh normal viewport screenshots avoid that artifact. No shared
CSS change or accessibility-control removal was needed. The existing verified
not-found stylesheet preload warning remains a local performance limitation.

No actual-role production, hosted, physical-device, full screen-reader or multi-instance
transport/load acceptance is established here. The 106 exact-route completion
decisions and full Revision 4 goal remain open. Temporary results live under
`%TEMP%/allied-w16f-*`; no database, cookie, screenshot or trace is committed.
