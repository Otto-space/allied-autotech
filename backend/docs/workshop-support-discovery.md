# Workshop support discovery

Route `/admin/support` uses the existing staff enquiry/complaint list APIs. This
page is read-only; conversation detail owns replies, assignment, priority and status
mutations. Staff/Admin/Super Admin require verified MFA. Ordinary Staff are scoped
to their current active branch. Administrators may select historical inactive
branches. The frontend additionally gates reads on active own-profile identity.

Supported query fields: status, enquiry type or complaint priority, branchId,
assignedStaffId, UUID cursor and bounded limit. The UI fixes pages at25 and persists
supported category/filter/cursor/trail state through reload and Back. Category
changes clear incompatible filters and paging. There is no text search, queue-total
endpoint or live-agent availability. Invalid/duplicate URL fields stop collection
reads. Foreign Staff branch links are rejected before reads; returned foreign Staff
scope becomes a denied read and clears protected facts.

The API returns subject/body, full references/version, branch/assignment, permitted
contact/customer reference, precise lifecycle dates and complaint acknowledgement/
deadline/escalation dates. Message previews are explicitly abbreviated; subject
links lead to real conversations. Recorded acknowledgement dates do not establish a
response/delivery guarantee or a running timer. No domain action is invented here.

Complaint name/email columns are nullable when a customer profile is linked. The
frontend private complaint parser now accepts those actual nullable values and
shows Not recorded; enquiry contact fields retain their non-null contract. This is
a frontend projection correction, without changing backend responses or request
contracts. Current domain/MFA/branch checks remain server-authoritative.

Branch and staff pickers are reused. Directory outages do not make the queue
unavailable. Off-page selected assignees retain their UUID instead of silently
clearing the filter. Branch changes explicitly clear the assignee draft. StaffPicker
adds optional empty-label/required props, preserving existing form defaults; the
filter selects All staff and permits an empty value. This does not broaden ordinary
Staff assignment choices beyond the existing own-profile picker.

Temporary read failure retains labelled old records with paging blocked. Denial
removes contacts. Global API private/no-store headers apply to these routes.
Successful privileged reads create READ audits with ENQUIRY/COMPLAINT entity types,
without contact, subject, body or filter contents in the audit payload.

Three new isolated API scenarios verify25+3 paging for both kinds, complete/null
contact projections, exact timestamps, combined classification/assignment/branch
filters, current Staff reassignment, private responses, read audits and anonymous/
Customer/unverified-MFA/unsupported-query rejection. Test fixture corrections kept
existing session-MFA and complaint-contact database constraints intact. No schema
change, trigger bypass, database reset or application/shared database write is needed.

All fixture writes require actual isolated `_test` host/port/database/environment
verification and the existing restricted runtime credentials. Preserve domain
fixtures; remove only owned test sessions. Existing59-migration replay/db:check/
privilege evidence remains applicable. No migration/grant/backup/restore, push or
deployment change is required. No new backend implementation gap is identified.
Conversation detail, notification delivery, policy and deployed acceptance remain
separate. Verify actual role/branch/privacy behavior after coordinated deployment.
