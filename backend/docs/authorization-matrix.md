# Authorization matrix

All authorization is default-deny. Authentication and MFA checks run before domain policy checks,
and ownership is resolved from the authenticated user rather than request data.

| Capability                               | Customer | Staff      | Admin   | Super admin |
| ---------------------------------------- | -------- | ---------- | ------- | ----------- |
| Read/update own customer profile         | Allowed  | Denied     | Denied  | Denied      |
| Manage own customer vehicles             | Allowed  | Denied     | Denied  | Denied      |
| Read active public branches              | Allowed  | Allowed    | Allowed | Allowed     |
| Read own privileged profile              | Denied   | Allowed    | Allowed | Allowed     |
| Create/update branches                   | Denied   | Denied     | Allowed | Allowed     |
| List/read privileged users               | Denied   | Denied     | Allowed | Allowed     |
| Search eligible accounts by exact email   | Denied   | Denied     | Allowed | Allowed     |
| Promote verified customer to branch staff | Denied   | Denied     | Allowed | Allowed     |
| Invite existing staff to ADMIN            | Denied   | Denied     | Allowed | Allowed     |
| Accept own bound ADMIN invitation         | Denied   | Allowed    | Denied  | Denied      |
| List/revoke administrator invitations     | Denied   | Denied     | Own     | All         |
| Assign staff branches                    | Denied   | Denied     | Allowed | Allowed     |
| Suspend/reactivate staff                 | Denied   | Denied     | Allowed | Allowed     |
| Manage administrators                    | Denied   | Denied     | Denied  | Allowed     |
| Demote ADMIN to branch STAFF              | Denied   | Denied     | Denied  | Allowed     |
| Assign ADMIN through generic role edit    | Denied   | Denied     | Denied  | Denied      |
| Create another super-admin               | Denied   | Denied     | Denied  | Denied      |
| Read active catalogue                    | Allowed  | Allowed    | Allowed | Allowed     |
| Manage own favourites/cart               | Allowed  | Denied     | Denied  | Denied      |
| Manage categories/products/media         | Denied   | Denied     | Allowed | Allowed     |
| Read/mutate assigned-branch inventory    | Denied   | Allowed    | Allowed | Allowed     |
| Read/mutate another branch's inventory   | Denied   | Denied     | Allowed | Allowed     |
| Create branch inventory records          | Denied   | Denied     | Allowed | Allowed     |
| Request/read/cancel own bookings         | Allowed  | Denied     | Denied  | Denied      |
| Accept/reject own issued quotes          | Allowed  | Denied     | Denied  | Denied      |
| Read/manage own-branch bookings          | Denied   | Allowed    | Allowed | Allowed     |
| Read/manage another branch's bookings    | Denied   | Denied     | Allowed | Allowed     |
| Create quotes and work orders            | Denied   | Own branch | Allowed | Allowed     |
| Create/update service definitions        | Denied   | Denied     | Allowed | Allowed     |
| Checkout/read/cancel own pending orders  | Allowed  | Denied     | Denied  | Denied      |
| Read/manage own-branch order fulfilment  | Denied   | Allowed    | Allowed | Allowed     |
| Read/manage another branch's orders      | Denied   | Denied     | Allowed | Allowed     |
| Preview a promotion for own checkout     | Allowed  | Denied     | Denied  | Denied      |
| Create/update promotions                 | Denied   | Denied     | Allowed | Allowed     |
| Read own issued/paid/void invoices       | Allowed  | Denied     | Denied  | Denied      |
| Read/create/issue/void business invoices | Denied   | Denied     | Allowed | Allowed     |
| Read business payments/private evidence  | Denied   | Denied     | Allowed | Allowed     |
| Request/review financial refunds         | Denied   | Denied     | Allowed | Allowed     |
| Discover available vehicle listings      | Allowed  | Allowed    | Allowed | Allowed     |
| Save listings/request own inspections    | Allowed  | Denied     | Denied  | Denied      |
| Negotiate/reserve own vehicle purchase   | Allowed  | Denied     | Denied  | Denied      |
| Manage own-branch vehicles/inspections   | Denied   | Allowed    | Allowed | Allowed     |
| Read another branch's private assets     | Denied   | Denied     | Allowed | Allowed     |
| Manage vehicle handover                  | Denied   | Own branch | Allowed | Allowed     |
| Run reservation-expiry operation         | Denied   | Denied     | Allowed | Allowed     |

Privileged operations require a fully MFA-assured session and CSRF protection. An administrator
cannot manage themself, another administrator, or a super-administrator. A super-administrator
cannot manage themself or another super-administrator through ordinary API routes. Role, status,
and branch authority changes revoke all target sessions and pending invitations issued to or by
the target. Promotion, invitation, acceptance and revocation additionally require current-password
proof. Acceptance rechecks the intended recipient and inviter inside the access-change transaction.

Customer vehicle queries always include the authenticated customer's ownership relation. A missing
resource and a resource owned by another customer produce the same not-found response.

Staff inventory authorization resolves the branch from the authenticated staff profile. A request
cannot expand access by supplying a different branch ID. Administrators can operate across branches,
while catalogue writes and new branch-inventory records remain administrator-only.

Booking ownership is derived from the customer profile. Staff booking access is derived from the
staff profile's active branch; supplying a different branch filter cannot expand it. Staff can assign
only themself, while administrators can assign any active privileged profile in the booking branch.
Customer views exclude `staffNotes` and work-order `internalNotes`.
Staff booking lists, details and operational update responses omit the `depositPayment`
relation at query time. Deposit policy snapshots and clearance dates remain operational
context; payment identifiers, references and settled-attempt identifiers are not disclosed.

Order ownership is derived exclusively from the authenticated customer profile. Staff order
fulfilment access is constrained to their active branch. The retained `/staff/invoices` and
`/staff/payments` paths require ADMIN or SUPER_ADMIN with MFA at both the router and service layers;
ordinary STAFF cannot read or mutate invoices, payments, payment evidence or refunds.
Staff order lists, details and fulfilment update responses also omit the `invoice` relation
at query time. Order values and clearance dates remain available for branch fulfilment.
Customers retain their own issued/paid/void invoice and payment access and cannot view draft invoices. Promotion administration is restricted
to administrators, while checkout eligibility and every financial total are recalculated from locked
server-owned records.

Vehicle-sale ownership is derived from the customer profile and staff branch scope is derived from
the staff profile. Public vehicle projections exclude internal identifiers and acquisition data.
Private vehicle documents and signed handovers require a fresh authorized access request, produce a
short-lived storage capability, and append a privileged-read audit event.
Vehicle acquisition cost/currency are selected only for ADMIN/SUPER_ADMIN responses. STAFF list,
detail, creation and edit responses omit both fields. STAFF creation/edits reject any submitted
acquisitionCostKobo, including null, while specification edits preserve the stored internal cost.
Acquisition date and public asking prices remain operational context.

Customer booking quotation responses include only records with a non-null issuedAt and non-DRAFT status. Replaced or voided unpublished drafts remain internal. The same projection applies to customer list/detail, mutation and replay responses; authorized staff retain draft access.

Dashboard overview GETs reuse these boundaries. `/customers/overview` derives ownership from
the signed-in customer; `/staff/overview` requires MFA and derives STAFF scope from an active
assigned branch. ADMIN/SUPER_ADMIN receive organization aggregates. Dates are inclusive Lagos
calendar dates, limited to 1–90 days; callers cannot submit customer or branch scope overrides.
Only organization reads query payment/refund tables or return the finance property. Recent
records expose bounded operational fields, excluding customer identity, internal notes,
invoice relations and payment identifiers. Responses are private and non-cacheable.

Manual-payment reviewers must claim a still-pending review inside the transaction; a concurrent
loser receives a conflict before changing the attempt, ledger or audit. The database's terminal
review protection and different-operator requirement remain in force. Payment-intent replay
uses an actor-bound key plus a customer-scoped database query and exact purpose/target comparison.
It returns the existing record even after the payable advances; new requests still resolve
current ownership, amount, eligibility and expiry on the server.
