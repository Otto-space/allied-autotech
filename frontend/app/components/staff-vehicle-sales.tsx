"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffVehicleSales } from "@/lib/api/staff-vehicle-sales-schemas";
import { transactionStatuses } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { useAccountSession } from "./dashboard-shell";
export function StaffVehicleSales() {
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const session = useAccountSession();
  const pagination = useCursorPage();
  const sales = useResource(
    `/staff/vehicle-transactions?limit=25${status ? `&status=${status}` : ""}${branchId ? `&branchId=${branchId}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffVehicleSales,
  );
  return (
    <>
      <h1>Vehicle sales</h1>
      <p className="lead">
        Review enquiries and purchase progress within your permitted branches. Recorded
        prices and payment status are shown separately.
      </p>
      <div className="catalogue-filters">
        <div className="field">
          <label htmlFor="sales-status">Purchase status</label>
          <select
            id="sales-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              pagination.reset();
            }}
          >
            <option value="">All statuses</option>
            {transactionStatuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {session?.user.role !== "STAFF" && (
          <div className="field">
            <label htmlFor="sales-branch">Active branch filter</label>
            <SlotCatalogPicker
              kind="branch"
              id="sales-branch"
              value={branchId}
              onChange={(value) => {
                setBranchId(value);
                pagination.reset();
              }}
            />
            <p className="field-hint">Leave blank to include every permitted branch.</p>
          </div>
        )}
      </div>
      <Feedback message={sales.error} />
      <button
        className="button secondary"
        onClick={sales.refresh}
        disabled={sales.loading}
      >
        Refresh vehicle sales
      </button>
      {sales.loading && <p role="status">Checking vehicle sales…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Vehicle sales records"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Vehicle</th>
              <th>Customer</th>
              <th>Progress</th>
              <th>Agreed price</th>
            </tr>
          </thead>
          <tbody>
            {sales.data?.items.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <Link className="text-link" href={`/admin/vehicle-sales/${sale.id}`}>
                    {sale.transactionNumber}
                  </Link>
                </td>
                <td>
                  {sale.vehicleListing.title}
                  <p className="muted">{sale.vehicleListing.vehicle.stockNumber}</p>
                </td>
                <td>{sale.customerName}</td>
                <td>{sale.status.replaceAll("_", " ")}</td>
                <td>
                  {sale.agreedPriceKobo === null
                    ? "Not agreed"
                    : formatKobo(sale.agreedPriceKobo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sales.loading && !sales.error && sales.data?.items.length === 0 && (
        <div className="empty">
          <h2>
            {status || branchId
              ? "No purchases match these filters"
              : "No vehicle purchases on this page"}
          </h2>
        </div>
      )}
      {(status || branchId) && (
        <button
          className="button secondary"
          onClick={() => {
            setStatus("");
            setBranchId("");
            pagination.reset();
          }}
        >
          Clear purchase filters
        </button>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={sales.data?.nextCursor}
        disabled={sales.loading || !!sales.error}
        label="Vehicle purchases"
      />
    </>
  );
}
