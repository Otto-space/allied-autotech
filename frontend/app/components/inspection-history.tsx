"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseInspections } from "@/lib/api/vehicle-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

export function InspectionHistory() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const inspections = useResource(
    `/customers/vehicle-inspections?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseInspections,
  );
  return (
    <>
      <h1>Vehicle inspections</h1>
      <p className="lead">
        Follow the progress of your inspection requests. All appointment times are shown
        in Lagos time.
      </p>
      <div className="field">
        <label htmlFor="inspection-status">Status</label>
        <select
          id="inspection-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {[
            "REQUESTED",
            "CONFIRMED",
            "COMPLETED",
            "RESCHEDULED",
            "CANCELLED",
            "NO_SHOW",
          ].map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={inspections.error} />
      <button
        className="button secondary"
        disabled={inspections.loading}
        onClick={inspections.refresh}
      >
        Refresh inspections
      </button>
      {inspections.loading && <p role="status">Checking inspection requests…</p>}
      <div className="list">
        {inspections.data?.items.map((item) => (
          <article className="card" key={item.id}>
            <h2>{item.vehicleListing.title}</h2>
            <span className="status">{item.status.replaceAll("_", " ")}</span>
            <p>Requested: {formatBusinessDate(item.preferredStartAt)}</p>
            {item.scheduledStartAt ? (
              <p>
                Scheduled: {formatBusinessDate(item.scheduledStartAt)}
                {item.scheduledEndAt
                  ? ` – ${formatBusinessDate(item.scheduledEndAt)}`
                  : ""}
              </p>
            ) : (
              <p className="muted">An appointment time has not been confirmed.</p>
            )}
            {item.notes && <p>{item.notes}</p>}
            {item.cancellationReason && (
              <p>Cancellation reason: {item.cancellationReason}</p>
            )}
            {item.conditionReport && (
              <details>
                <summary>Inspection report</summary>
                <p>{item.conditionReport.summary}</p>
                <p>
                  Inspected {formatBusinessDate(item.conditionReport.inspectedAt)} ·
                  Odometer {item.conditionReport.odometerKm.toLocaleString("en-NG")} km
                </p>
              </details>
            )}
            <p>
              <Link className="text-link" href="/dashboard/support">
                Contact customer care about your appointment
              </Link>
            </p>
          </article>
        ))}
      </div>
      {!inspections.loading &&
        !inspections.error &&
        inspections.data?.items.length === 0 && (
          <div className="empty">
            <h2>
              {status ? "No inspections match this status" : "No inspection requests yet"}
            </h2>
            {status ? (
              <button
                className="button secondary"
                onClick={() => {
                  setStatus("");
                  pagination.reset();
                }}
              >
                Clear filter
              </button>
            ) : (
              <Link className="button" href="/vehicles">
                Browse available vehicles
              </Link>
            )}
          </div>
        )}
      <CursorPagination
        pagination={pagination}
        nextCursor={inspections.data?.nextCursor}
        disabled={inspections.loading || !!inspections.error}
        label="Inspection requests"
      />
    </>
  );
}
