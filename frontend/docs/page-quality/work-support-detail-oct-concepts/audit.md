# Staff conversation audit, gate 77

Routes `/admin/support/enquiries/[supportId]` and
`/admin/support/complaints/[supportId]`, same conversation template. Queue gate76 is
accepted separately. Existing staff direct detail, independent paginated messages,
customer/internal replies, assignment/status/complaint-priority and first
acknowledgement APIs support the workflow. Role/MFA/current branch checks remain
server-authoritative; ordinary Staff assignment uses their eligible own profile.

Visual issues: generic duplicated header/back link, large flat fact list, sparse
contact formatting, date-only timestamps, disconnected management/messages/reply
panels and no clear compact operational hierarchy. Original and paginated messages
must remain separate; ignore embedded detail.messages as a history substitute.
Internal notes must stay visibly distinct from customer-visible content. Full
contact nulls, references, versions, lifecycle and acknowledgement facts need honest
labels. No live-agent or guaranteed notification delivery claims.

Correctness findings from current source:

- Current own-profile/branch validation should precede direct private reads. Summary
  and messages need strict scope, duplicate/date/cursor validation and independent
  honest failures. Denial must clear all private facts and drafts tied to access.
- SupportStaffActions remounts on each record version, risking draft loss/rebinding
  an old draft to a newer version. Preserve fields with an explicit affected-form
  reload before another reviewed versioned write.
- Unknown outcomes currently lock only component memory. Add minimal actor/role/
  kind/reference pending metadata across reload and explicit authorized current
  record/messages reconciliation, without replay or proof of the original outcome.
  Staff operations have no original-request receipts. Customer durable replay is
  separate and must remain unchanged.
- Staff addStaffMessage checks CLOSED before creating a message but does not lock
  the conversation row; serialize it with closure using the same per-record lock
  pattern already used by customer reply/acknowledgement.
- acknowledgeComplaint locks the row but does not reject an unacknowledged CLOSED
  complaint. Prevent a new acknowledgement/customer message after closure. Existing
  acknowledgement reads should remain idempotent without creating another message.
- Status/acknowledgement responses rely on detail.messages capped at the oldest500
  entries. A new customer-visible response can be missing from that snapshot.
  Inspect an additive explicit message receipt/current-ack outcome projection so
  the UI validates submitted text/visibility without pretending a capped history is
  complete. No schema change is expected; preserve existing atomic writes/audits.

Reuse accepted Quicksand workshop panels/review/pickers/form drafts, existing reply/
acknowledgement/action forms and message semantics. Gate77 must include focused
concurrency/closure/private/API tests, real mutations/audits, seven widths/Axe and
native concept comparisons. Any optional durable staff recovery is a separate
backend handoff; do not quietly add retry safety to current non-idempotent replies.
