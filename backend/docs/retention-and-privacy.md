# Retention and privacy decisions

Updated 22 October 2026. Authority and the remaining business decisions are in
[the public launch decision record](public-launch-policy-decisions.md).

## Approved ordinary enquiry rule

| Item           | Approved instruction                                               |
| -------------- | ------------------------------------------------------------------ |
| Records        | Ordinary enquiries that close without a sale, booking or complaint |
| Personal data  | Name, contact details and messages                                 |
| Period         | 12 months after closure                                            |
| Starting event | Closure of the enquiry, not submission or first response           |
| Approval scope | Draft retention schedule; automatic deletion is not authorised     |

Do not apply this rule to an account, complaint, sale, booking, payment, invoice,
financial audit record or record subject to a legal hold. Links to a product or
vehicle alone do not establish whether an enquiry resulted in a transaction;
eligibility needs an explicit reviewed implementation.

The existing `Enquiry` model has `status`, `resolvedAt` and `closedAt`. Resolution
and closure are distinct events. Any future enforcement must use the approved
closure event, account for related messages and conversions, and stop on missing
or ambiguous classification rather than deleting a record by age alone.

## Current implementation boundary

The customer-data retention worker is a documented disabled placeholder. The
policy schema restricts `destructiveRetention.enabled` to `false`. This approval
does not change either behavior or publish a policy into an application database.
Security/session/token expiry cleanup has a different purpose and is not a
12-month enquiry deletion job.

Before enforcement, review calendar-month calculation, holds and release of
holds, linked-record handling, deletion versus anonymisation, provider/mailbox
copies, backup expiry and protection against reintroducing erased data on a
restore. Prove eligibility in a read-only review first. Data changes require the
repository's database safeguards and an explicit approved preservation plan.

Remaining record types need their own lawful purpose, retention duration,
starting event and exceptions. Do not derive a blanket retention period from
this ordinary-enquiry decision.
