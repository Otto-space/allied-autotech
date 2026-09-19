# Dashboard overview contracts

`GET /customers/overview` and `GET /staff/overview` accept only `from` and `to` calendar dates, inclusive in Africa/Lagos. The range must contain 1–90 days, from 2000 onward. Unknown query fields are rejected with the existing 422 validation response. No caller-supplied customer or branch scope is accepted.

| Audience            | Scope                                                  | Finance                                                     |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| CUSTOMER            | Authenticated user's customer profile                  | No payment/refund aggregate queries or response field       |
| STAFF               | Assigned active branch; missing/inactive branch denied | No payment/refund aggregate queries or response field       |
| ADMIN / SUPER_ADMIN | Organization, after existing MFA enforcement           | Verified settled requests and processed refunds, separately |

| Metric                 | Date basis                                    | Included records                                                                                                                                            |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New bookings           | Booking.createdAt                             | All current statuses in the permitted scope                                                                                                                 |
| Parts orders           | Order.createdAt                               | All current statuses; an order count does not imply payment                                                                                                 |
| Quotations issued      | ServiceQuote.issuedAt                         | Non-DRAFT records attached to scoped bookings, including subsequently accepted, rejected, voided or expired issued history; unpublished drafts are excluded |
| Inspection requests    | InspectionRequest.createdAt                   | Own customer profile or permitted listing branch, all statuses                                                                                              |
| Vehicles / stock added | CustomerVehicle.createdAt / Vehicle.createdAt | Own garage or permitted branch stock; additions during the range, not total current fleet                                                                   |
| Payments collected     | Payment.succeededAt                           | SUCCEEDED payment requests with a linked SUCCESSFUL, VERIFIED settled attempt; one amount per payment request                                               |
| Refunds completed      | Refund.processedAt                            | SUCCEEDED refunds; pending/approved/requested/failed/cancelled are excluded                                                                                 |

Monetary sums use database BigInt sums and decimal-string transport. The browser formats with BigInt. Currencies are grouped separately; current database business constraints permit NGN. Payment and refund totals are not subtracted or described as net revenue. Duplicate or late captures that did not settle a payment request belong in payment-exception monitoring, not this settled-request total.

Daily activity contains every day in the requested range, including genuine zero days. Booking progress reports current statuses of bookings created during that range, not historical status transitions. Recent bookings and orders contain the latest five/four records created during the range; aggregates are independent of those preview limits. Preview projections omit customer identities, internal notes, invoices and payment relations. Links lead to full permitted record screens whose filters remain independent.

Reads run in a bounded RepeatableRead transaction. UTC timestamp-without-time-zone columns are explicitly interpreted as UTC before grouping into Lagos dates. Nine forward indexes support creation/issue/settlement/processing range predicates. No old migration is changed. Deployment requires the new index migration through the normal migration workflow; it has only been applied to a disposable test database during implementation.

The frontend reuses the session shell, shared API client and useResource hook. It refreshes once per minute while visible and online, backing off to two/four/five minutes after successive errors. Existing visibility/online events revalidate, and account invalidation aborts obsolete requests and unmounts private content. Failed responses are never rendered as zero. Administrator processing queues and reconciliation remain available on demand below the overview.

Implementation references: `backend/src/modules/overview`, `frontend/app/components/role-overview.tsx`, `overview-activity.tsx`, `frontend/lib/api/use-overview.ts`, and `frontend/app/overview.css`.

API behavior was checked against [Prisma transaction isolation documentation](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) and [PostgreSQL timezone conversion documentation](https://www.postgresql.org/docs/17/functions-datetime.html). The database/API tests cover midnight boundaries and real authorization; browser fixtures are synthetic and are not production content.
