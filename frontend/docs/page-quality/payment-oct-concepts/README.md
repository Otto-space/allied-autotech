# Customer payment detail concepts

Created 8 October 2026 for `/dashboard/payments/[paymentId]`, before implementing its dedicated layout. These are design references, not screenshots of live transactions.

- [Desktop payment](01-desktop-payment.webp): navy amount/status panel, related records, provider checkout and compact manual-report form.
- [Mobile payment](02-mobile-payment.webp): amount-first hierarchy and sequential checkout, reporting and attempts. The narrow implementation uses one form column; the generated reference is wider than a phone.
- [Status and review](03-status-and-review.webp): focused processing, confirmed and manual-review presentations.

Use the existing Allied brand assets, Nippo and Quicksand. Preserve real server totals, references, dates, provider availability and customer permissions. Do not adopt generated account details, bank instructions, provider endorsements, receipt-email promises, confirmation times, staff navigation, logos or taglines. The actual evidence limit is 10 MiB, regardless of generated labels.

Production behavior and verification belong in the [payment-detail report](../payment-detail.md). No external provider payment or deployed storage acceptance is established by these concepts.
