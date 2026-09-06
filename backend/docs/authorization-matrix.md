# Authorization matrix

All authorization is default-deny. Authentication and MFA checks run before domain policy checks,
and ownership is resolved from the authenticated user rather than request data.

| Capability                              | Customer | Staff      | Admin   | Super admin |
| --------------------------------------- | -------- | ---------- | ------- | ----------- |
| Read/update own customer profile        | Allowed  | Denied     | Denied  | Denied      |
| Manage own customer vehicles            | Allowed  | Denied     | Denied  | Denied      |
| Read active public branches             | Allowed  | Allowed    | Allowed | Allowed     |
| Read own privileged profile             | Denied   | Allowed    | Allowed | Allowed     |
| Create/update branches                  | Denied   | Denied     | Allowed | Allowed     |
| List/read privileged users              | Denied   | Denied     | Allowed | Allowed     |
| Invite staff                            | Denied   | Denied     | Allowed | Allowed     |
| Invite administrators                   | Denied   | Denied     | Denied  | Allowed     |
| Assign staff branches                   | Denied   | Denied     | Allowed | Allowed     |
| Suspend/reactivate staff                | Denied   | Denied     | Allowed | Allowed     |
| Manage administrators                   | Denied   | Denied     | Denied  | Allowed     |
| Change staff/admin roles                | Denied   | Denied     | Denied  | Allowed     |
| Create another super-admin              | Denied   | Denied     | Denied  | Denied      |
| Read active catalogue                   | Allowed  | Allowed    | Allowed | Allowed     |
| Manage own favourites/cart              | Allowed  | Denied     | Denied  | Denied      |
| Manage categories/products/media        | Denied   | Denied     | Allowed | Allowed     |
| Read/mutate assigned-branch inventory   | Denied   | Allowed    | Allowed | Allowed     |
| Read/mutate another branch's inventory  | Denied   | Denied     | Allowed | Allowed     |
| Create branch inventory records         | Denied   | Denied     | Allowed | Allowed     |
| Request/read/cancel own bookings        | Allowed  | Denied     | Denied  | Denied      |
| Accept/reject own issued quotes         | Allowed  | Denied     | Denied  | Denied      |
| Read/manage own-branch bookings         | Denied   | Allowed    | Allowed | Allowed     |
| Read/manage another branch's bookings   | Denied   | Denied     | Allowed | Allowed     |
| Create quotes and work orders           | Denied   | Own branch | Allowed | Allowed     |
| Create/update service definitions       | Denied   | Denied     | Allowed | Allowed     |
| Checkout/read/cancel own pending orders | Allowed  | Denied     | Denied  | Denied      |
| Read/manage own-branch order fulfilment | Denied   | Allowed    | Allowed | Allowed     |
| Read/manage another branch's orders     | Denied   | Denied     | Allowed | Allowed     |
| Preview a promotion for own checkout    | Allowed  | Denied     | Denied  | Denied      |
| Create/update promotions                | Denied   | Denied     | Allowed | Allowed     |
| Read own issued/paid/void invoices      | Allowed  | Denied     | Denied  | Denied      |
| Create/issue/void own-branch invoices   | Denied   | Allowed    | Allowed | Allowed     |
| Discover available vehicle listings     | Allowed  | Allowed    | Allowed | Allowed     |
| Save listings/request own inspections   | Allowed  | Denied     | Denied  | Denied      |
| Negotiate/reserve own vehicle purchase  | Allowed  | Denied     | Denied  | Denied      |
| Manage own-branch vehicles/inspections  | Denied   | Allowed    | Allowed | Allowed     |
| Read another branch's private assets    | Denied   | Denied     | Allowed | Allowed     |
| Manage vehicle handover                 | Denied   | Own branch | Allowed | Allowed     |
| Run reservation-expiry operation        | Denied   | Denied     | Allowed | Allowed     |

Privileged operations require a fully MFA-assured session and CSRF protection. An administrator
cannot manage themself, another administrator, or a super-administrator. A super-administrator
cannot manage themself or another super-administrator through ordinary API routes. Role, status,
and branch authority changes revoke all target sessions.

Customer vehicle queries always include the authenticated customer's ownership relation. A missing
resource and a resource owned by another customer produce the same not-found response.

Staff inventory authorization resolves the branch from the authenticated staff profile. A request
cannot expand access by supplying a different branch ID. Administrators can operate across branches,
while catalogue writes and new branch-inventory records remain administrator-only.

Booking ownership is derived from the customer profile. Staff booking access is derived from the
staff profile's active branch; supplying a different branch filter cannot expand it. Staff can assign
only themself, while administrators can assign any active privileged profile in the booking branch.
Customer views exclude `staffNotes` and work-order `internalNotes`.

Order ownership is derived exclusively from the authenticated customer profile. Staff order and
invoice access is constrained to their active branch, including when the invoice source is a booking
or vehicle transaction. Customers cannot view draft invoices. Promotion administration is restricted
to administrators, while checkout eligibility and every financial total are recalculated from locked
server-owned records.

Vehicle-sale ownership is derived from the customer profile and staff branch scope is derived from
the staff profile. Public vehicle projections exclude internal identifiers and acquisition data.
Private vehicle documents and signed handovers require a fresh authorized access request, produce a
short-lived storage capability, and append a privileged-read audit event.
