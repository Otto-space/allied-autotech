# Workshop vehicle sale detail source audit

Preparation after milestone 72; not an acceptance report. Route
`/admin/vehicle-sales/[transactionId]` already rejects invalid UUIDs server-side.
Sources read: StaffVehicleSaleDetail, negotiation/progress forms, VehicleHandover,
staff sale schemas and the transaction/negotiation/handover repository/service/
schema contracts. Preserve all existing supported actions and the linked stock
record, temporary signed-document access and separate history.

The current page has a generic header, partial facts and repeated nested panels.
Reads do not wait for its own verified profile or match the requested identity.
Refresh failures are omitted from mutation disabling. Negotiation review omits
customer-visible notes. Version-keyed form remounts can restore old field drafts
under a newer version without explicit acknowledgement; use stable forms with
observed-version guards, complete review and explicit reload instead.

Negotiation updates the sale version and returns a full transaction projection.
Its returned history may precede the newly appended history entry; a refreshed
read supplies that entry. Ordinary progress also has a dedicated backend version
check. Handover creation has no request expectedVersion: it locks/checks PAID and
the unique handover, then increments sale version and returns the full sale.
READY/CANCELLED increment the handover version only. COMPLETED also increments
sale version, completes purchase and marks the listing sold. Do not merge these
independent revisions or treat completion as payment collection.

An optional handover PDF is verified using an actor/vehicle/kind-bound ticket
before persistence. Existing creation locks only in memory. No new same-key
retry guarantee exists for negotiation/progress/handover creation/status.
Introduce minimal actor/role/transaction recovery locks and explicit read/draft
reconciliation through reload, with strict full-response matching and fresh
current actor/relevant-domain preflight. Reads do not prove original outcomes.
Keep valid private document access independent of pending mutation locking.

Confirmed backend recovery gap: cancelled handovers remain attached uniquely to
HANDOVER_PENDING purchases. Creation accepts only PAID; cancelled handovers have
no outgoing lifecycle transition. No supported API reopens/replaces them. Record
this delivery-recovery gap in the handoff; do not invent an admin action or alter
historical records through ad hoc data writes.

BG-11 approval/publication/deployed verification remains independent. Replace any
unverified assertion that terms are absent with factual customer-acceptance
requirements; do not invent agreement wording, activate finance providers or
guarantee current payment balance from status/paidAt. The supplied sale projection
has no current ledger totals.

Generate/inspect fresh desktop/mobile concepts and save the concrete specification
before UI edits. Verify exact money/time, every permitted action/version domain,
role/branch changes, draft/conflict/reload recovery and existing PDF flows. Reuse
the accepted build/database/privilege setup; no schema change is assumed for the
frontend guard. Add backend gaps only from confirmed contract limitations.
