"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  inspectionStatuses,
  parseStaffInspections,
} from "@/lib/api/staff-inspection-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { InspectionStatusForm } from "./inspection-status-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffInspections() {
  const session = useAccountSession();
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const inspections = useResource(
    `/staff/vehicle-inspections?limit=25${status ? `&status=${status}` : ""}${branch ? `&branchId=${branch}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffInspections,
  );
  const disabled = inspections.loading || !!inspections.error || !!proposal;
  return (
    <>
      <h1>Vehicle inspections</h1>
      <p className="lead">
        Schedule requested inspections and record their progress. Times are shown in Lagos
        time.
      </p>
      <fieldset className="handover-fields catalogue-filters" disabled={!!proposal}>
        <div className="field">
          <label htmlFor="staff-inspection-status">Inspection status filter</label>
          <select
            id="staff-inspection-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.reset();
            }}
          >
            <option value="">All statuses</option>
            {inspectionStatuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {session?.user.role !== "STAFF" && (
          <div className="field">
            <label htmlFor="staff-inspection-branch">Active branch filter</label>
            <SlotCatalogPicker
              kind="branch"
              id="staff-inspection-branch"
              value={branch}
              onChange={(value) => {
                setBranch(value);
                pagination.reset();
              }}
            />
          </div>
        )}
      </fieldset>
      <Feedback message={inspections.error} />
      <Feedback message={message} tone="success" />
      <div className="actions">
        <button
          className="button secondary"
          disabled={inspections.loading || !!proposal}
          onClick={inspections.refresh}
        >
          Refresh inspection records
        </button>
        {(status || branch) && (
          <button
            className="button secondary"
            disabled={!!proposal}
            onClick={() => {
              setStatus("");
              setBranch("");
              pagination.reset();
            }}
          >
            Clear inspection filters
          </button>
        )}
      </div>
      {inspections.loading && <p role="status">Checking inspection records…</p>}
      {!inspections.loading && !inspections.error && !inspections.data?.items.length && (
        <div className="empty">
          <h2>
            {status || branch
              ? "No inspections match these filters"
              : "No inspection requests on this page"}
          </h2>
        </div>
      )}
      {inspections.data?.items.map((inspection) => (
        <section
          key={inspection.id}
          className="detail-section"
          aria-labelledby={`inspection-heading-${inspection.id}`}
        >
          <h2 id={`inspection-heading-${inspection.id}`}>
            {inspection.vehicleListing.title} — {inspection.customerName}
          </h2>
          <p className="status">{inspection.status.replaceAll("_", " ")}</p>
          <dl className="totals">
            <dt>Stock number</dt>
            <dd>{inspection.vehicleListing.vehicle.stockNumber}</dd>
            <dt>Customer preference</dt>
            <dd>
              {formatBusinessDate(inspection.preferredStartAt)}
              {inspection.preferredEndAt
                ? ` – ${formatBusinessDate(inspection.preferredEndAt)}`
                : ""}
            </dd>
            <dt>Scheduled start</dt>
            <dd>{formatBusinessDate(inspection.scheduledStartAt)}</dd>
            <dt>Scheduled end</dt>
            <dd>{formatBusinessDate(inspection.scheduledEndAt)}</dd>
            <dt>Assigned staff</dt>
            <dd>
              {inspection.assignedStaff
                ? `${inspection.assignedStaff.firstName} ${inspection.assignedStaff.lastName}`
                : "Not assigned"}
            </dd>
          </dl>
          {inspection.notes && (
            <p className="preserve-lines">Customer notes: {inspection.notes}</p>
          )}
          {inspection.cancellationReason && (
            <p className="preserve-lines">
              Cancellation reason: {inspection.cancellationReason}
            </p>
          )}
          <details>
            <summary>Manage inspection progress</summary>
            <InspectionStatusForm
              inspection={inspection}
              disabled={disabled}
              onReview={(next) => {
                if (!disabled) {
                  setMessage(undefined);
                  setProposal(next);
                }
              }}
            />
          </details>
          {inspection.conditionReport && (
            <details>
              <summary>Recorded condition report</summary>
              <p>{formatBusinessDate(inspection.conditionReport.inspectedAt)}</p>
              <p className="preserve-lines">{inspection.conditionReport.summary}</p>
              <p>
                Odometer:{" "}
                {inspection.conditionReport.odometerKm === null
                  ? "Not recorded"
                  : `${inspection.conditionReport.odometerKm} km`}
              </p>
            </details>
          )}
          {inspection.status === "COMPLETED" && !inspection.conditionReport && (
            <p>
              To record the findings, find stock{" "}
              {inspection.vehicleListing.vehicle.stockNumber} in{" "}
              <Link className="text-link" href="/admin/vehicles">
                vehicle stock
              </Link>{" "}
              and link its condition report to this completed inspection.
            </p>
          )}
        </section>
      ))}
      <CursorPagination
        pagination={pagination}
        nextCursor={inspections.data?.nextCursor}
        disabled={disabled}
        label="Staff inspections"
      />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            inspections.refresh();
          }}
          onSuccess={() =>
            setMessage("Inspection change recorded. Review the refreshed details.")
          }
        />
      )}
    </>
  );
}
