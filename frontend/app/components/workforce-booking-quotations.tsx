"use client";

import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffBooking } from "@/lib/api/staff-booking-schemas";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import { Feedback } from "./feedback";
import { StaffQuoteRecords } from "./staff-quote-records";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function WorkforceBookingQuotations({
  bookingId,
  assignedStaffId,
  access,
}: {
  bookingId: string;
  assignedStaffId: string | null;
  access: WorkforceAccess;
}) {
  const canPrepare =
    access.staffId === assignedStaffId &&
    !!access.independentCapabilities?.includes("QUOTATION_PREPARE");
  const canApprove =
    !!access.independentCapabilities?.includes("QUOTATION_APPROVE") &&
    access.staffId !== assignedStaffId;
  const allowed = canPrepare || canApprove;
  const record = useResource(
    allowed ? `/staff/workforce/bookings/${bookingId}/quotation` : null,
    parseStaffBooking,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();

  return (
    <section className="card" aria-label="Quotation workspace">
      <h2>Quotation</h2>
      <p>
        The assigned staff member prepares the quotation. A different authorised reviewer
        approves and issues it. Customers can accept an issued quotation within its
        seven-day validity. Workshop bookings are request-and-confirm; deposits are
        disabled. Payment follows acceptance of a valid quotation.
      </p>
      {!allowed ? (
        <p>
          Quotation access has not been granted. Ask the Super Admin to grant
          <strong> Prepare service quotations</strong> to the assigned technician, or
          <strong> Approve and send quotations</strong> to an independent reviewer.
        </p>
      ) : (
        <>
          {record.loading && <p role="status">Loading quotations…</p>}
          <Feedback message={record.error || record.refreshError} />
          <Feedback message={message} tone="success" />
          {record.data && (
            <StaffQuoteRecords
              booking={record.data}
              disabled={record.refreshing || !!proposal}
              canChange
              canAuthor={canPrepare}
              canIssue={canApprove}
              canClose={false}
              checkingAccess={false}
              onReview={(next) => setProposal({ ...next, retryAfterRejection: false })}
            />
          )}
          <button className="button secondary" onClick={record.refresh}>
            Refresh quotations
          </button>
          {proposal && (
            <MutationReview
              proposal={proposal}
              onClose={() => {
                setProposal(null);
                record.refresh();
              }}
              onSuccess={() => setMessage("Quotation saved. Review the updated record.")}
            />
          )}
        </>
      )}
    </section>
  );
}
