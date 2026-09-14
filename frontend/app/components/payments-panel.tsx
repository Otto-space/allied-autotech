"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parsePayments } from "@/lib/api/payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
export function PaymentsPanel() {
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const paymentQuery = new URLSearchParams({ limit: "20" });
  if (status) paymentQuery.set("status", status);
  if (cursor) paymentQuery.set("cursor", cursor);
  const payments = useResource(
    `/customers/payments?${paymentQuery.toString()}`,
    parsePayments,
  );
  return (
    <>
      <h1>Your payments</h1>
      <p className="muted">Check a payment here before making another attempt.</p>
      <div className="field filter-field">
        <label htmlFor="payment-filter">Payment status</label>
        <select
          id="payment-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setCursor(undefined);
            setHistory([]);
          }}
        >
          <option value="">All statuses</option>
          {[
            "REQUIRES_PAYMENT",
            "PROCESSING",
            "REQUIRES_REVIEW",
            "SUCCEEDED",
            "CANCELLED",
            "EXPIRED",
          ].map((value) => (
            <option value={value} key={value}>
              {value.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={payments.error} />
      {payments.error && (
        <button className="button secondary" onClick={payments.refresh}>
          Retry payments
        </button>
      )}
      {payments.loading && <output>Checking payments…</output>}
      <div className="list">
        {payments.data?.items.map((payment) => (
          <article className="list-item" key={payment.id}>
            <div>
              <h2>
                <Link className="text-link" href={`/dashboard/payments/${payment.id}`}>
                  {payment.paymentNumber}
                </Link>
              </h2>
              <output className="status">{payment.status.replaceAll("_", " ")}</output>
            </div>
            <strong>{formatKobo(payment.amountKobo)}</strong>
            <Link className="text-link" href={`/dashboard/payments/${payment.id}`}>
              Details & verification →
            </Link>
          </article>
        ))}
      </div>
      {!payments.loading && !payments.error && payments.data?.items.length === 0 && (
        <div className="empty">
          <h2>{status ? "No payments with this status" : "No payments yet"}</h2>
          <p>Your payment requests will appear here when created.</p>
        </div>
      )}
      <nav className="pagination" aria-label="Payment pages">
        <button
          className="button secondary"
          disabled={!history.length || payments.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!payments.data?.nextCursor || payments.loading || !!payments.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(payments.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
    </>
  );
}
