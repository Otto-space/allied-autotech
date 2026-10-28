# W12: scoped booking confirmation

Branch `feat/workforce-scoped-booking-20261027`, based on W11 `8503f4f7`, in the
same authoritative checkout. No new worktree, migration or publication.

The independently granted BOOKING_CONFIRM duty had no managed-workforce journey.
The legacy booking API remained intentionally blocked, and the scoped detail was
read-only. Initial isolated acceptance cases failed on the missing endpoint.

The scoped confirmation requires current BOOKINGS_READ scope plus the explicit
confirmation grant. It uses a whitelist receipt and reuses the existing locked
transition core for calendar/capacity, assigned staff/duration, schedule conflict,
version, audit and reminder handling. Scope is rechecked after waits before commit.
Enrolled Admin cannot turn the grant into broad branch access; Staff with a valid
other-branch responsibility can use that explicit scope. The legacy path retains
its existing guards. No role, title or availability supplies the duty.

The form adds explicit review, fresh scope/record preflight, strict receipt binding
and minimal session-local pending references without the typed review note. It
never retries an uncertain submission automatically. Current-state inspection and
an explicit acknowledgement are separate from attributing an earlier request.
Protected-read cancellation and pending redaction follow existing access/session
invalidation. Source-only UI and actual rendered evidence must remain distinct.

New scoped failures use reviewed recovery codes for missing capacity policy, full
capacity, closed calendar and missing assignment. Unknown codes remain generic;
raw server text is not rendered. Missing business configuration is not invented.
Existing legacy error codes and responses are preserved.

Eleven final native HTTP/DB cases pass on the verified W7 synthetic CI database
with its restricted non-owning runtime. They cover actual capacity/calendar, stale
rollback, independent-grant revocation, branch scope, same-record concurrency and
mixed legacy/scoped concurrency with one audit/reminder. Missing-policy/calendar
codes are asserted; the legacy Admin path still succeeds. Fifty-seven workforce,
session, learning and conversation regressions and eleven legacy booking policy/
response cases also passed. An additional historical provisioned bookings suite
stopped on its exact-target guard (it requires another fixture/database); its guard
was preserved, and its four cases are not claimed as run.

The full frontend run passed 1,121 tests in 168 files before the final focused
recovery-code/layout corrections. Thereafter 34 booking/registry/invalidation and
35 API-client/review checks pass; 59 backend guidance/provider-core units pass.
Source/script/frontend type checks and changed lint pass, including a dedicated
strict compile of the native test/harness with Express augmentation.

An initial browser pass had 18/19 passes: the API client intentionally strips
arbitrary validation text, so a capacity-policy field hint became generic. The
new scoped API now uses four BOOKING_* codes with static reviewed error messages;
the validation filter and legacy responses remain unchanged. The corrected 19/19
run passed at 320/390/768/1440 with Staff/Admin, keyboard review, Axe WCAG 2.2 tags,
revocation, refresh failure, missing metadata, lost/malformed replies, unavailable
local recovery storage and long evidence.

One actual browser-to-CSRF-to-API-to-CI-DB confirmation passed without interception:
status CONFIRMED/version 1, one audit, one ONE_HOUR reminder and a recorded approved
capacity policy. No worker delivered that reminder. Its screenshot exposed a narrow
read-detail label column with a long staff name, which overflow checks alone did
not catch. A detail-only stacked mobile definition layout and regression case were
added; final 20/20 fixture cases and the actual native-browser case pass on the
corrected build. Inspected 320px long-name detail and 390/1440px review screenshots.

OpenAPI validates 376 paths/440 operations plus four infrastructure routes; frontend
types were regenerated. Optimized cached builds passed, with justified incremental
rebuilds for the reproduced recovery and mobile layout defects; no dependency install.
The existing Next 16.3.8 cache is not exact-lock 16.4.3 release acceptance. Known
not-found fallback CSS preload warnings remain narrowly verified/reported rather
than hidden as repaired operational styles. All other console/page errors fail.
No external model, email/SMS delivery or production data write is involved.

The new written-help topic is eligible only with both booking access and the
independent grant. No guide/practice mode or paid provider re-evaluation is claimed.
W9's conservative provider reservation ledger remains exhausted and preserved.

Financial-aftercare adapter, granular Care authority, persisted reviewed handoff,
shared staffed/gated transport and all 106 exact route completion decisions remain
open. Exact-lock/hosted/device acceptance and production backup/restore gates remain
required. Full Revision 4 stays active.

Final local artifacts: `%TEMP%/allied-booking-confirmation-review-390.png`,
`...-1440.png`, `allied-booking-detail-long-name-320.png`,
`allied-booking-native-review-390.png` and `allied-booking-native-confirmed-390.png`.
These show synthetic data only. Native evidence receipt is retained under the W7 CI
verification output, without session cookies or customer data. The scoped API was
stopped gracefully, its synthetic browser session revoked and its cookie file removed.
The frontend preview remains available for the next bounded batch.

C: approximately 25.56 GiB free after the final rebuild; the 20 GiB reserve is intact
at that measured checkpoint. No new Docker resources, worktree, dependency install,
archive or editor profile; existing current/rollback/base/other-task resources remain
retained. Previously denied dev-folder cleanup was not retried.
