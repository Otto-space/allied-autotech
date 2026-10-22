# Accounts and enquiry requests — release preparation

Prepared 22 October 2026. **Not evidence of production activation.**

## Scope authorised in this conversation

The owner requested expansion beyond the public catalogue. Michael then explicitly chose:

- Purchases remain enquiries for staff to confirm by phone/email. No manual-payment checkout is authorised.
- Service visits and vehicle inspections are requests requiring staff confirmation, with no payment, guaranteed appointment or vehicle hold.
- No additional purchases. Paystack is unavailable; both payment providers remain disabled.

Target runtime mode is `browse_enquiries`, not `full`. The existing backend mode permits registration, account features and public/customer support intake, while rejecting transaction writes. The matching frontend suppresses checkout, scheduled-booking and reservation pages. Do not set `full` to work around this boundary.

## Prepared changes

- Registration and support forms link to the privacy notice beside submission. Viewing it opens a separate tab to preserve the form.
- Service/vehicle enquiries can include a preferred date and time in Africa/Lagos. Invalid or past times are rejected; the complete message remains subject to the existing 4,000-character limit.
- Review shows the exact preference and the staff-confirmation requirement. Submission uses the existing support endpoint, routing, records and notification delivery; it does not create an order, booking allocation, inspection allocation or vehicle reservation.
- The accounts-and-enquiries notice adds account/profile/garage information, support intake, moderated reviews, browser drafts and the previously approved account retention rule. Catalogue mode continues to render its separate approved scope.
- The exact proposed notice is rendered in [the owner review copy](accounts-and-enquiries-privacy-review.html). Regenerate with `node frontend/scripts/render-accounts-privacy-review.cjs` from the repository root. The source hash identifies the reviewed page. Its effective date must be checked at actual publication.

## Staff handling

1. Open the enquiry from the dashboard/email alert and read the linked service or vehicle, handling branch and requested Nigeria-time preference.
2. Check workshop capacity or the actual vehicle's availability with the responsible team. A preferred time is a request, not an allocated slot.
3. Reply to the customer with the agreed arrangements, or propose alternatives. The support record does not automatically create a workshop-calendar entry or inspection booking. Record the confirmed arrangement in the company's appointment process and the support conversation.
4. A support status change is a case update, not appointment confirmation. Customer-visible replies can notify the customer; internal notes stay internal. Check visibility before confirming a reply.
5. For product/vehicle purchases, confirm price and availability through the enquiry. Do not call it a paid order, guaranteed hold or completed reservation. Website payment collection remains unavailable.
6. For Google Groups replies, use `support@alliedautotech.com` as From and verify the customer's address among recipients. Remove the notification sender where present. The owner has already verified receipt with the customer in Cc; there is no need to repeat that mailbox test.

## Release checks and remaining evidence

Before changing production settings, record the current app/deployment, preserve the current catalogue rollback target, verify the existing database backup/rehearsal evidence and run the read-only database check. There is no schema or migration change in this release.

Run the matching frontend build in `browse_enquiries` mode, keep private access disabled for the public custom domain, keep preview protection and signed proxy configuration, and preserve MFA, CSRF, branch/ownership checks and upload restrictions. Build without reused Vercel build cache so assets do not reference the old protected deployment.

Verify registration/email verification/login, support creation, review-before-submit, notification handling and rejection of transaction endpoints. Use a new isolated test database for database-backed tests; no tests against production. Synthetic browser fixtures demonstrate UI behaviour, not live email delivery.

Michael explicitly approved this expanded notice in the conversation on 22 October 2026 after receiving the review-copy path and scope. The approval does not certify the outstanding provider/overseas-processing assessment. The more detailed approved retention decisions are recorded in the policy workspace at `C:/Users/PC/.codex/worktrees/allied-launch-final-20261022/backend/docs/public-launch-policy-decisions.md`; do not re-ask settled periods or substitute the older abbreviated record.

The provider/overseas-processing assessment remains open in that workspace's `public-enquiry-privacy-review.md`. Google CDPA acceptance is user-reported; Resend supplied standard documents without resolving the scope question. Its [current DPA](https://resend.com/legal/dpa) was rechecked during this preparation: section 1.2 remains narrower than other definitions. This is not a finding of no protection or a requirement to buy Enterprise. Preserve the uncertainty for qualified assessment; do not claim owner wording approval certifies the transfer assessment. No terms were accepted or paid advice purchased by the agent.

The attempted read-only BitLocker check lacked Windows administrator access. Completion is still unverified; the previous user report was 51%. No encryption setting was changed.

## Later paid transaction release

Still needed: a configured/tested payment provider; approved invoice/finance publication; delivery zones, fees, timing and external courier collection; cancellation/returns and refund timing; assigned financial duties; and a versioned vehicle reservation agreement with deposit, hold, balance and refund rules. Request-only enquiries do not activate these policies. Customer-care hours do not define workshop capacity. Marketing remains a separate opt-in feature and is not authorised by registration.

## Validation evidence

- 25 frontend unit tests passed (launch boundary and visit preference validation).
- 53 backend launch-boundary unit tests passed, including preserved registration/support handlers and blocked transaction writes.
- Frontend TypeScript and changed-file ESLint checks passed before the final styling adjustment; final checks follow.
- Two local browser flows passed at 390px and 1440px: review contains the Nigeria-time preference; no request is sent before confirmation; exactly one support submission after confirmation; receipt appears; no page errors or horizontal overflow. Synthetic network fixtures were used, not live production customer records or email.
- The first browser run used an incorrect confirmation-button locator; corrected to the actual `Send enquiry` label and rerun successfully. The mobile screenshot revealed an oversized checkbox inherited from generic input styling; a scoped style fixed it and both flows passed again.
- A fresh deployment observed during preparation (`dpl_FoJK2QoXpXPMw1c1TAFBrgVi3xfc`) contained logo/branding updates. Its account/intake/privacy source was verified against the pre-change source. Ten branding files were retrieved through the authenticated management API, hash-verified, reviewed and preserved in commit `c8ce55af` to avoid reverting live changes.
- The managed backup dated 22 October 2026 at 05:22:09 UTC remains present among six backups. No database or deployment write has occurred during these checks.
- Isolated database-backed checks and the release build are still in progress. Failed local startup attempts were stopped and preserved; no production database was used.
