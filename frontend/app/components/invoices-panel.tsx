"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseInvoices } from "@/lib/api/invoice-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
export function InvoicesPanel() {
  const [status, setStatus] = useState("");
  const pagination = useCursorPage();
  const invoices = useResource(
    `/customers/invoices?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseInvoices,
  );
  return (
    <>
      <h1>Your invoices</h1>
      <p className="lead">Review issued invoices, deposit credits and payment records.</p>
      <div className="field">
        <label htmlFor="invoice-status">Invoice status</label>
        <select
          id="invoice-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {["ISSUED", "PAID", "VOID"].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={invoices.error} />
      <button
        className="button secondary"
        disabled={invoices.loading}
        onClick={invoices.refresh}
      >
        Refresh invoices
      </button>
      {invoices.loading && <p role="status">Checking invoices…</p>}
      <div className="list">
        {invoices.data?.items.map((invoice) => (
          <article className="list-item" key={invoice.id}>
            <div>
              <h2>
                <Link className="text-link" href={`/dashboard/invoices/${invoice.id}`}>
                  {invoice.invoiceNumber}
                </Link>
              </h2>
              <span className="status">{invoice.status}</span>
              <p className="muted">
                {formatBusinessDate(invoice.issuedAt ?? invoice.createdAt)}
              </p>
            </div>
            <div>
              <strong>{formatKobo(invoice.totalKobo)}</strong>
              <p>{invoice.paidAt ? "Payment recorded" : "Payment not recorded"}</p>
            </div>
          </article>
        ))}
      </div>
      {!invoices.loading && !invoices.error && invoices.data?.items.length === 0 && (
        <div className="empty">
          <h2>
            {status ? "No invoices match this status" : "No invoices have been issued"}
          </h2>
          {status && (
            <button
              className="button secondary"
              onClick={() => {
                setStatus("");
                pagination.reset();
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={invoices.data?.nextCursor}
        disabled={invoices.loading || !!invoices.error}
        label="Invoices"
      />
    </>
  );
}
