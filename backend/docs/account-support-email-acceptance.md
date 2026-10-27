# Account and support email acceptance

Item 3 of the site-completion tracker. Prepared 23 October 2026, Africa/Lagos.

## Scope and safety

Verify account verification, password recovery, guest/registered support updates,
recipient preferences and failure handling. Separate isolated automated evidence
from actual hosted delivery and mailbox receipt. Provider acceptance alone is not
proof of inbox arrival or reading.

Do not reset the owner's or any staff member's password. Use a separately approved
customer test address and one clearly labelled customer account, with two clearly
labelled support enquiries (guest and registered). Test records remain subject to
company-controlled retention; do not delete production data after testing.

The user approved the controlled production actions and email delivery on
23 October 2026 and supplied a customer test address, kept in the private run record.
The live run is capped at ten automated emails total across the approved
customer test address and support@alliedautotech.com, including department alerts.
Count potential sends before each action; stop before exceeding the cap. No
marketing, SMS, purchases, paid orders, refunds or financial permissions are in scope.
Existing recipients of the Support group may receive its normal notifications.

The user retains account passwords and verification/reset links. Do not paste those
into chat or save them in this document. A normal staff MFA session is required for
staff actions; do not bypass it or make direct database edits to simulate a reply.
The user may perform private-link and MFA steps while the agent handles safe
configuration checks, preparation and evidence recording.

## Automated checks in an isolated environment

| Check | Expected result |
| --- | --- |
| Registration and resend | Token protected at rest; new verification invalidates the old link; generic public responses avoid disclosing account existence |
| Verification | Current link verifies once; replay, revoked and expired links are rejected |
| Password recovery | Generic request response; current token resets once; old password/session cannot continue as before; replay and expiry are rejected |
| Expiry regression | Expired verification does not verify an account; expired reset does not change its password; fresh links still work |
| Guest support reply | Email contains the response/reference and uses the Support Reply-To address |
| Registered support update | Account notification and appropriate signed-in conversation link; operational opt-out respected |
| Internal note and assignment | No customer email |
| Combined resolution | One update rather than duplicate status/reply emails |
| Complaint acknowledgement | One recorded acknowledgement/update; repeat does not duplicate it |
| Failure and retry | Failed attempts and terminal failure distinguishable; stable send identity; no sensitive payload in ordinary staff metadata |
| Department alert | Correct department destination and customer's Reply-To, with escaped content and environment restrictions |

Only create and write to a new local `_test` database after confirming its host,
port, database name and environment. Use captured/fake email providers. Do not run
failure injection, expiry changes or database-backed tests against production.

## Proposed hosted sequence after authorisation

1. Recheck live deployment, frontend/backend link URLs, sender, Reply-To, delivery
   flags and intended environment. Record only nonsecret values.
2. Register the approved customer test address. Expect a verification email from
   notifications@notify.alliedautotech.com. Record inbox/spam arrival and header
   results without copying the link or full headers.
3. Request one verification resend before verification. Verify that the earlier
   link is rejected and the newest link works once. Open links directly on the
   main domain; no Vercel or private-access login should be required.
4. Sign in, then request one password reset for this test account only. Complete
   it privately, confirm the new password works and replay is rejected. Use the
   isolated result for true expiry rather than altering production clocks/tokens.
5. Create one labelled guest enquiry using the approved address and the real
   Port Harcourt branch. Verify its department alert in Support and Reply-To.
6. Through normal authorised staff access, add an internal note (no customer
   email), then one customer-visible response. Check the delivery list and the
   actual guest inbox, reference, body and Support reply address.
7. Create one labelled registered-customer enquiry. Send one staff-visible-to-
   customer response and confirm the alert opens only that customer's signed-in
   conversation. Verify the account notification separately from email arrival.
8. Turn off operational email for this test customer using their normal settings,
   then perform one agreed support update. Verify the account update remains and
   email is recorded as not sent. Restore the test customer's preference afterward.
   Do not deliberately send duplicates to test provider behaviour in production.
9. If a customer replies by email, check it in Support and record it manually in
   the case as an internal note. This optional exchange needs to stay within the
   authorised recipients and any agreed message count; it does not create an
   automatic mailbox-to-dashboard integration.

Do not promise browser push, SMS, an automatic initial customer receipt for every
enquiry, or inbox delivery merely because a record was saved. Account/support
templates and department alerts are distinct messages.

## Evidence and outstanding decisions

Record date, environment/deployment, check, pass/fail, and a minimal observation.
Do not store customer bodies, passwords, tokens or complete headers here.

- Initial isolated run: all 61 migrations replayed and schema diff passed; 34
  existing checks passed. Two new expiry checks failed because the fixtures did
  not give expired tokens an earlier creation time. Fixtures corrected without
  changing application/database safeguards. Both expiry checks passed on a fresh
  isolated database after correcting the fixture creation dates: 36 selected
  checks passed across the two runs. Both test containers were stopped. Backend
  TypeScript, changed-test lint and formatting checks passed.
- Live-send authorisation and customer test address: received, 23 October 2026.
- Initial hosted registration: one POST, HTTP 202, no browser page errors. Public
  response is generic; it does not prove account creation or email arrival.
- User reported no new email. Narrow read-only inspection confirmed the approved
  address already belongs to an active, verified CUSTOMER created on 22 October.
  Its earlier verification was provider-accepted; no new email was queued by this
  registration. Existing password unchanged. This does not show a delivery failure.
  Temporary operator-IP database access was removed and original app rules
  preserved afterward; strict TLS and read-only transaction were verified.
- User approved the proposed Gmail test alias on 23 October. One alias registration
  POST was accepted with HTTP 202 and no browser page errors. The user confirmed
  inbox arrival and SPF, DKIM and DMARC PASS on 23 October.
- One approved alias verification resend returned HTTP 202 after exactly one POST.
  The hosted browser displayed "Check your email" with no page errors. Screenshot:
  `%TEMP%/allied-email-acceptance-alias-resend.png`. On 23 October the user
  confirmed resend receipt, older-link rejection, newest-link verification on
  first use and rejection on reuse. Hosted verification acceptance passed.
- Hosted test-alias sign-in passed with the expected CUSTOMER identity. One
  password-recovery request returned HTTP 202 and displayed "Check your email"
  without browser page errors. The user confirmed receipt, reset completion,
  new-password login and replay rejection. The preserved pre-reset session was
  subsequently rejected with HTTP 401 by the normal hosted session endpoint.
  Hosted account recovery acceptance passed; actual expiry was tested only in
  the isolated environment. No additional email was sent for the session check.
  Screenshot: `%TEMP%/allied-email-acceptance-alias-recovery.png`.
- One guest enquiry was submitted via the normal public form with subject
  "Email acceptance check - guest - 23 October 2026". Exactly one POST returned
  HTTP 202, which matches the controller contract. The temporary test script
  incorrectly expected 201 and stopped before capturing the displayed reference;
  the request was not repeated. On 23 October the user reported that all requested
  steps worked: Support alert received, internal note saved without customer email,
  customer-visible reply received, and dashboard delivery status Sent. These are
  recipient/staff-reported results; no independent live staff session was used.
  Guest acceptance passed. The reference was not supplied; locate by the exact
  labelled subject if needed. Do not repeat either guest submission or reply.
- Registered-customer acceptance: the user confirmed the Support alert, customer
  email, conversation link, reply in the account and account notification all
  worked, with Customer email delivery marked Sent. Recorded as user-reported
  acceptance. Existing subject: "Email acceptance check - registered - 23 October
  2026". Do not repeat the enquiry or reply.
- Operational-email opt-out and restoration passed: the user confirmed that all
  requested steps worked, including persisted Disabled preference, the status
  update marked Not sent with the opt-out explanation, retained account update,
  no customer email for the change, and restored Enabled preference after refresh.
  Recorded as user-reported acceptance. No live provider failure was injected.
- Budget ledger: 9 of 10 possible automated emails conservatively reserved (the
  original-address registration queued none). Read the private
  `email-acceptance-20261023/send-ledger.json` before further sending.
- Fresh verification mailbox and link acceptance: passed, user confirmed.
- Fresh password-reset mailbox and link acceptance: passed, user confirmed;
  old-session rejection independently confirmed through the hosted API.
- Fresh guest support alert/internal note/reply acceptance: passed, user reported.
- Registered support receipt, conversation link and account notification: passed,
  user reported. Operational-email opt-out and restoration: passed, user reported.
- Previous successful Support mailbox and SPF/DKIM/DMARC checks are historical
  evidence; they do not replace this complete hosted acceptance run.
- Item 2 dependencies remain open: Newworld group access, backup and walkthrough.

Completion requires passing relevant isolated checks plus recorded hosted-flow
and recipient acceptance. If anything fails, retain the failure and fix/retest that
path; do not mark this item complete because sending is configured.

## Acceptance outcome — 23 October 2026

Item 3 passed for the controlled scope above: 36 selected isolated checks plus
hosted account, guest/registered support and preference acceptance. True token
expiry and provider failure/retry handling were tested in isolation, not by
altering production clocks or deliberately disrupting live email. Staff mailbox
handover, backup coverage and improved provider delivery evidence remain separate
items. Preserve the labelled test records; no deletion or additional sends are
required to close this item.
