# Authorization matrix

All authorization is default-deny. Authentication and MFA checks run before domain policy checks,
and ownership is resolved from the authenticated user rather than request data.

| Capability | Customer | Staff | Admin | Super admin |
| --- | --- | --- | --- | --- |
| Read/update own customer profile | Allowed | Denied | Denied | Denied |
| Manage own customer vehicles | Allowed | Denied | Denied | Denied |
| Read active public branches | Allowed | Allowed | Allowed | Allowed |
| Read own privileged profile | Denied | Allowed | Allowed | Allowed |
| Create/update branches | Denied | Denied | Allowed | Allowed |
| List/read privileged users | Denied | Denied | Allowed | Allowed |
| Invite staff | Denied | Denied | Allowed | Allowed |
| Invite administrators | Denied | Denied | Denied | Allowed |
| Assign staff branches | Denied | Denied | Allowed | Allowed |
| Suspend/reactivate staff | Denied | Denied | Allowed | Allowed |
| Manage administrators | Denied | Denied | Denied | Allowed |
| Change staff/admin roles | Denied | Denied | Denied | Allowed |
| Create another super-admin | Denied | Denied | Denied | Denied |

Privileged operations require a fully MFA-assured session and CSRF protection. An administrator
cannot manage themself, another administrator, or a super-administrator. A super-administrator
cannot manage themself or another super-administrator through ordinary API routes. Role, status,
and branch authority changes revoke all target sessions.

Customer vehicle queries always include the authenticated customer's ownership relation. A missing
resource and a resource owned by another customer produce the same not-found response.
