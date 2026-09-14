"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseVehicleTransactions, transactionStatuses } from "@/lib/api/vehicle-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

export function VehicleTransactions() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const transactions = useResource(
    `/customers/vehicle-transactions?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseVehicleTransactions,
  );
  return (
    <>
      <h1>Vehicle enquiries & purchases</h1>
      <p className="lead">
        Follow each enquiry from your first conversation through payment and handover.
      </p>
      <div className="field">
        <label htmlFor="transaction-status">Status</label>
        <select
          id="transaction-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {transactionStatuses.map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={transactions.error} />
      <button
        className="button secondary"
        disabled={transactions.loading}
        onClick={transactions.refresh}
      >
        Refresh vehicle enquiries
      </button>
      {transactions.loading && <p role="status">Checking vehicle enquiries…</p>}
      <div className="list">
        {transactions.data?.items.map((item) => (
          <article className="card" key={item.id}>
            <p className="muted">{item.transactionNumber}</p>
            <h2>
              <Link href={`/dashboard/vehicle-transactions/${item.id}`}>
                {item.vehicleListing.title}
              </Link>
            </h2>
            <span className="status">{item.status.replaceAll("_", " ")}</span>
            <p>
              {item.agreedPriceKobo === null ? "Asking price" : "Agreed price"}:{" "}
              {formatKobo(item.agreedPriceKobo ?? item.askingPriceKobo)}
            </p>
            <p className="muted">Started {formatBusinessDate(item.createdAt)}</p>
            <Link
              className="text-link"
              href={`/dashboard/vehicle-transactions/${item.id}`}
            >
              View enquiry & progress →
            </Link>
          </article>
        ))}
      </div>
      {!transactions.loading &&
        !transactions.error &&
        transactions.data?.items.length === 0 && (
          <div className="empty">
            <h2>
              {status ? "No enquiries match this status" : "No vehicle enquiries yet"}
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
                Browse vehicles
              </Link>
            )}
          </div>
        )}
      <CursorPagination
        pagination={pagination}
        nextCursor={transactions.data?.nextCursor}
        disabled={transactions.loading || !!transactions.error}
        label="Vehicle enquiries"
      />
    </>
  );
}
