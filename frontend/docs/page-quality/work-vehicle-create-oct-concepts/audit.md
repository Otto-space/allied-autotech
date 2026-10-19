# Vehicle creation source audit

Audit started after vehicle stock milestone 68. This is preparation for a separate
creation gate, not an acceptance report. No creation UI has been changed yet.

Sources inspected: `app/admin/vehicles/new/page.tsx`,
`app/components/vehicle-record-form.tsx`, `lib/forms/vehicle-record.ts`, and the
vehicle routes/schemas/service/OpenAPI.

The page currently repeats a back link, heading, introductory text and photo
notice above one large mixed field grid. Required identity, optional specification,
identifiers and private acquisition information need clear groups, consistent
Quicksand labels, concise progression guidance and the established dashboard
surfaces. Keep all optional fields and exact money conversion. Photos belong after
record creation; a sale listing remains a later, separate operation.

Reuse the existing record validator/defaults/body serializer, account/own-profile
hooks, administrator active-branch picker, reviewed mutation pattern, stock page
theme and existing routing to the created record's photo editor. Preserve the edit
form export and its detail-route consumers while creation is redesigned.

The existing POST supports Staff/Admin/Super Admin with MFA. Staff require an active
assigned branch and cannot write acquisition cost, including null; Admin/Super
Admin select an active branch. Stock number, VIN and chassis uniqueness and
transactional CREATE auditing are enforced by the backend. Creating a record does
not create a listing or add photos. No new endpoint is needed for those actions.

Reliability issues to address in this gate:

- Confirm the current own identity/active role and branch facts before a reviewed
  write. Backend authorization remains independent. Branch assignment changes
  must not carry a draft silently to a different branch.
- Review the complete permitted submitted values, not only the current partial
  summary. Preserve exact optional/zero values and Lagos date/time behavior.
- Validate the full created record against the reviewed request and current
  actor scope; the current creation handler validates only a returned UUID.
- An uncertain creation currently locks only in component memory. Persist a
  minimal actor-scoped pending indicator through reload and provide explicit
  manual stock reconciliation without automatic POST replay. A matching stock
  record alone cannot prove this request's outcome. Durable original-request
  receipts would require an additional backend contract if selected.
- Creation errors must preserve the draft; denied identity or unavailable storage
  must not enable duplicate submissions. Keep photo/listing work separate.

Before UI edits, generate and inspect fresh desktop/mobile creation concepts and
save their concrete layout/copy/token specification. Verify only the affected
creation, shared-form and stock navigation flows; reuse unchanged stock and
database-safety evidence where applicable.
