# Support email delivery evidence

Item 5 working record, 23 October 2026. Staff should use the Support case's
**Customer email delivery** section and the staff procedure in the main checkout's
`backend/docs/staff-support-email-guide.md`.

The application commits a customer-visible update and one encrypted outbox intent
together. The worker sends with a stable provider idempotency key and records
provider acceptance as `SENT`. This establishes acceptance for processing only. It
does not establish recipient-server delivery, inbox placement or reading. A
customer's report of non-receipt remains a real support issue even when `SENT`.

The case view now includes attempt count and, while retrying, the next scheduled
attempt in Nigeria time. It distinguishes permanent provider rejection from
exhausted transient retries without exposing recipient addresses, provider
responses or message content. Staff must check the provider dashboard and Support
mailbox before any manual follow-up. They should record the check and outcome as
an internal case note and avoid repeating the original customer-visible reply.
Operational email opt-out must still be honoured. A manually requested retry is
an audited administrator action; it does not prove delivery and must not be used
blindly after uncertain provider acceptance.

Resend exposes `email.delivered`, `email.delivery_delayed`, `email.bounced` and
`email.complained` events. To display recipient-server delivery in the site, a
separate reviewed integration must verify signed webhooks, correlate the provider
message ID to exactly one outbox intent, handle replays and events arriving out of
order, store minimal event facts, and keep provider acceptance distinct from
recipient-server acceptance. No signing secret or webhook endpoint has been
configured for this item. Provider records still require staff review for a
reported missing message. Relevant provider documentation:
[webhook event visibility](https://www.resend.com/changelog/webhook-event-visibility),
[event types](https://resend.com/migrate/mailgun).

This change has no Prisma schema or migration. It does not change the sending
provider, retry budget, message content or customer preferences. No production
messages or database writes were made to prepare this record.
