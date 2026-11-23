# Staging booking deposit release gates

This document records release boundaries for PR #131.

- Collect 20% of the latest staff-approved, customer-accepted quotation through Paystack test mode only after the appointment slot is confirmed. The remaining 80% is payable at the workshop and recorded in Zoho Books.
- One ordinary free reschedule requires at least 24 hours notice. A cancellation at least 48 hours ahead qualifies for full deposit refund review. Later cancellations, no-shows, emergencies, and disputes require staff review; no automatic fee or refund transfer.
- The booking-deposit capability defaults off and requires staging, full public launch mode, Paystack test mode, and disabled payment reconciliation. Production must remain unchanged.
- Isolated PostgreSQL 17 historical migration replay, focused SQL, booking-policy, and checkout tests passed locally. Hosted provider acceptance and refund/concurrency integration remain pending.
- Require GitHub Verified commit status, exact-head CI, reviewed migrations, and backups before deploying to staging. Never deploy an unsigned commit.
- Keep PR #131 draft and do not merge to master until staging booking, Paystack 20% charge, invoice-credit, cancellation/refund review, and customer UI acceptance pass.
