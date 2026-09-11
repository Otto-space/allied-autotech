# Allied AutoTech owner decision checklist

These are business decisions, not developer preferences. Suggested answers are recommendations only
and are **proposed—not approved**. “Before staging” means the feature cannot be meaningfully tested
without the answer; “before live” means synthetic testing may proceed but customers must not rely on
the feature yet.

## Decisions needed before staging the affected feature

### 1. Where may product orders be delivered and what is the charge?

- Why it matters: accepting an address without a confirmed area or fee creates a financial promise.
- Current behavior: collection checkout works; delivery checkout fails clearly with a conflict.
- **Proposed—not approved:** start with collection only, then approve a short Lagos delivery-zone
  table with a fixed fee per zone and an explicit out-of-zone rejection.
- Needed: before delivery checkout is enabled in staging; collection/public discovery are not blocked.

### 2. How long is an order held while payment is pending?

- Why it matters: stock cannot remain unavailable forever, but a payment may arrive late.
- Current behavior: checkout holds stock for 30 minutes; expiry releases it. A later verified capture
  is recorded and flagged for manual resolution without reviving the order.
- **Proposed—not approved:** retain 30 minutes, display a countdown, and have support contact the
  customer when a late capture anomaly occurs.
- Needed: before transactional staging sign-off and before live.

### 3. How long is a vehicle reservation, and is its deposit refundable?

- Why it matters: a vehicle cannot be promised to two buyers and refund expectations must be clear.
- Current behavior: the technical reservation window is 30 minutes; the listing supplies the exact
  reservation amount. Expiry does not override an in-flight/reviewed payment. No unapproved refund
  promise is automated.
- **Proposed—not approved:** approve a clearly displayed reservation period and make the deposit
  refundable only where required by law or when Allied AutoTech cannot complete the sale.
- Needed: before vehicle-payment staging and before live vehicle reservations.

### 4. Who completes an approved manual/offline refund, and what proof is required?

- Why it matters: approval is not proof that money left the business account.
- Current behavior: a different person must approve; an offline refund then remains
  `NEEDS_ATTENTION` and is never marked paid automatically.
- **Proposed—not approved:** the approver authorizes, a separate operator sends the transfer, records
  the bank reference/date, and a reconciliation result completes it.
- Needed: before offline-refund staging and live payments.

## Decisions needed before live launch

### 5. Approved: workshop booking capacity and confirmation

- **Owner decision recorded:** customers select a published staff-bound slot for a fixed-price
  service exactly 7–14 days ahead. The service duration determines the appointment interval.
- A 30% non-refundable deposit holds the selected slot for 30 minutes and a verified exact payment
  confirms the booking. Quote-required services remain enquiry/quotation workflows.
- Database and application locks prevent overlapping staff slots and multiple active bookings for
  one slot. Bay/lift/equipment capacity is not modeled and must be revisited if operations require it.
- Reminders are scheduled for 7 days, 72 hours, 48 hours, and 24 hours before the appointment.

### 6. Approved booking terms; order cancellation still needed

- **Owner decision recorded for bookings:** the deposit is non-refundable for customer cancellation
  or no-show. One customer reschedule is allowed at least 24 hours ahead and transfers the deposit.
  A business-caused disruption permits a transfer without consuming that reschedule or a full
  deposit-refund request through four-eyes approval.
- **Still unresolved for orders:** cancellation windows, restocking/delivery costs, and refund rules.
  No unapproved order fee is invented or charged.
- Needed: the booking portion is implemented and ready for staging; the order portion is required
  before live order cancellation is offered.

### 7. How long are quotations valid, and who supplies tax?

- Why it matters: prices, parts, and taxes change.
- Current behavior: quotations have explicit issue/expiry/version states and immutable issued
  versions; authorized staff currently supplies monetary inputs.
- **Proposed—not approved:** 7-day validity for ordinary service quotes, shorter validity for volatile
  parts, and finance-approved tax configuration rather than staff guessing.
- Needed: before live quotation acceptance.

### 8. What taxes, invoice terms, and price wording apply?

- Why it matters: incorrect VAT/tax statements create legal and accounting risk.
- Current behavior: kobo totals and immutable invoice snapshots are enforced, but the business tax
  rule and due-date wording are not inferred.
- **Proposed—not approved:** have the accountant approve whether displayed prices include VAT, the
  invoice tax line, legal business details, and payment terms.
- Needed: before live invoices or checkout.

### 9. Who owns Paystack disputes and what is the response deadline?

- Why it matters: missed evidence deadlines can turn a valid sale into a loss.
- Current behavior: disputes and evidence metadata are stored; administrators can inspect status;
  provider events do not expose raw payloads.
- **Proposed—not approved:** name a primary and backup operator, require same-day acknowledgement,
  and use a checklist of invoice, delivery/handover, and customer communication evidence.
- Needed: before live Paystack payments.

### 10. What qualifies for an overall business review?

- Why it matters: overall experience feedback is useful but is more open to spam than purchase
  reviews.
- Current behavior: any verified authenticated customer may submit a rated overall review; it is
  private until an administrator approves it. Product/service/order/vehicle reviews require verified
  completed sources.
- **Proposed—not approved:** keep this rule, show only approved reviews, and let moderation reject
  abuse without editing customer words.
- Needed: before public live review display; staging moderation can proceed.

### 11. What response targets and escalation apply to complaints?

- Why it matters: priority labels alone do not tell a small team when to act.
- Current behavior: complaints have branch ownership, assignee, priority, deliberate states,
  customer-visible/internal chat, notifications, and audit history; no invented deadline runs.
- **Proposed—not approved:** acknowledge urgent complaints within 1 business hour and others within
  1 business day; escalate overdue urgent items to the owner/manager.
- Needed: before advertising support response times or live operations.

### 12. Which messages may be optional or promotional?

- Why it matters: customers must receive security/transaction notices, while marketing needs consent.
- Current behavior: security and transactional notices cannot be disabled; operational notices may
  be opted out; marketing delivery requires explicit opt-in and recorded consent.
- **Proposed—not approved:** keep those categories, send no marketing until copy, consent wording,
  sender identity, and unsubscribe process are approved.
- Needed: before live marketing; transactional staging is not blocked.

### 13. How long is personal/support/payment data kept, and how are deletion requests handled?

- Why it matters: deleting too early harms audit/accounting; keeping forever increases privacy risk.
- Current behavior: no destructive retention worker runs. Financial and audit records are protected
  as history; no automatic account deletion policy is claimed.
- **Proposed—not approved:** obtain legal/accounting advice, define periods by record type, anonymize
  where possible, and require reviewed exceptions for disputes/legal holds.
- Needed: before live launch.

## Decisions already enforced technically

- Only customers self-register; privileged accounts require controlled provisioning.
- Staff/admin access requires MFA.
- Manual payments and refunds retain four-eyes separation; the requester cannot approve the same
  action.
- Browser authentication uses opaque `HttpOnly` cookies plus CSRF, not browser-stored bearer tokens.
- Staging can use Paystack test mode only; live mode requires explicit production-only enablement.
