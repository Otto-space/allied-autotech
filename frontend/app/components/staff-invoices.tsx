"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseInvoices } from "@/lib/api/invoice-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { InvoiceCreateForm } from "./invoice-create-form";
import { InvoiceFilters, type InvoiceFiltersValue } from "./invoice-filters";
export function StaffInvoices() {
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOpened, setFormOpened] = useState(false);
  const [filters, setFilters] = useState<InvoiceFiltersValue>({
    branchId: "",
    customerId: "",
  });
  const [filterRevision, setFilterRevision] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pagination = useCursorPage();
  const params = new URLSearchParams({ limit: "25" });
  if (status) params.set("status", status);
  if (pagination.cursor) params.set("cursor", pagination.cursor);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.customerId) params.set("customerId", filters.customerId);
  const invoices = useResource(`/staff/invoices?${params}`, parseInvoices);
  const filtered = !!status || !!filters.branchId || !!filters.customerId;
  function clearFilters() {
    setStatus("");
    setFilters({ branchId: "", customerId: "" });
    setFilterRevision((value) => value + 1);
    pagination.reset();
  }
  return (
    <>
      <h1>Invoices</h1>
      <p className="lead">
        Review invoices within your permitted branches. Invoice value and confirmed
        payments are separate records.
      </p>
      <div className="actions">
        <button
          className="button"
          aria-expanded={creating}
          onClick={() => {
            setFormOpened(true);
            setCreating((value) => !value);
          }}
        >
          {creating ? "Close invoice form" : "Create an invoice"}
        </button>
        <button
          className="button secondary"
          disabled={invoices.loading}
          onClick={invoices.refresh}
        >
          Refresh invoices
        </button>
      </div>
      {formOpened && (
        <div hidden={!creating}>
          <InvoiceCreateForm onSaved={invoices.refresh} />
        </div>
      )}
      <div className="field filter-field">
        <label htmlFor="staff-invoice-status">Invoice status</label>
        <select
          id="staff-invoice-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {["DRAFT", "ISSUED", "PAID", "VOID"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="actions">
        <button
          className="button secondary"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          Filter by branch or customer
        </button>
        {filtered && (
          <button className="button secondary" onClick={clearFilters}>
            Clear invoice filters
          </button>
        )}
      </div>
      {filtersOpen && (
        <InvoiceFilters
          key={filterRevision}
          value={filters}
          onApply={(value) => {
            setFilters(value);
            pagination.reset();
          }}
        />
      )}
      <Feedback message={invoices.error} />
      {invoices.loading && <p role="status">Checking invoices…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Invoice records"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Source</th>
              <th>Status</th>
              <th>Invoice total</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {invoices.data?.items.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link className="text-link" href={`/admin/invoices/${invoice.id}`}>
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td>
                  {invoice.order?.orderNumber ??
                    invoice.vehicleTransaction?.transactionNumber ??
                    (invoice.booking ? "Workshop booking" : "Source unavailable")}
                </td>
                <td>{invoice.status}</td>
                <td>{formatKobo(invoice.totalKobo)}</td>
                <td>{invoice.dueAt ? formatBusinessDate(invoice.dueAt) : "Not set"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!invoices.loading && !invoices.error && invoices.data?.items.length === 0 && (
        <div className="empty">
          <h2>
            {filtered ? "No invoices match these filters" : "No invoices on this page"}
          </h2>
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
