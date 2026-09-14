"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseInventories } from "@/lib/api/inventory-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { InventoryCreateForm } from "./inventory-create-form";
import { useAccountSession } from "./dashboard-shell";
import { InventoryFilters } from "./inventory-filters";
export function StaffInventory() {
  const session = useAccountSession();
  const pagination = useCursorPage();
  const [lowStock, setLowStock] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const inventory = useResource(
    `/staff/inventory?limit=25${lowStock ? "&lowStock=true" : ""}${branchId ? `&branchId=${branchId}` : ""}${productId ? `&productId=${productId}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseInventories,
  );
  return (
    <>
      <h1>Parts inventory</h1>
      <p className="lead">
        Review recorded stock and reservations in your permitted branches. Available
        quantities come directly from the inventory service.
      </p>
      <label className="check-label">
        <input
          type="checkbox"
          checked={lowStock}
          onChange={(event) => {
            setLowStock(event.target.checked);
            pagination.reset();
          }}
        />
        Show only low-stock records
      </label>
      <Feedback message={inventory.error} />
      <button
        className="button secondary"
        type="button"
        aria-expanded={showFilters}
        onClick={() => setShowFilters((value) => !value)}
      >
        {showFilters ? "Hide branch & part filters" : "Filter by branch or part"}
      </button>
      {showFilters && (
        <InventoryFilters
          branchId={branchId}
          productId={productId}
          onBranch={(value) => {
            setBranchId(value);
            pagination.reset();
          }}
          onProduct={(value) => {
            setProductId(value);
            pagination.reset();
          }}
          onClear={() => {
            setBranchId("");
            setProductId("");
            setLowStock(false);
            pagination.reset();
          }}
        />
      )}
      {!showFilters && (branchId || productId) && (
        <p className="field-hint">Branch or part filters are active.</p>
      )}
      <button
        className="button secondary"
        disabled={inventory.loading}
        onClick={inventory.refresh}
      >
        Refresh inventory
      </button>
      {inventory.loading && <p role="status">Checking inventory…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Parts inventory"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Part & branch</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Reorder level</th>
            </tr>
          </thead>
          <tbody>
            {inventory.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link className="text-link" href={`/admin/inventory/${item.id}`}>
                    {item.product.name}
                  </Link>
                  <p className="muted">
                    {item.product.sku} · {item.branch.name}
                  </p>
                </td>
                <td>{item.quantity}</td>
                <td>{item.reserved}</td>
                <td>{item.available}</td>
                <td>{item.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!inventory.loading && !inventory.error && inventory.data?.items.length === 0 && (
        <div className="empty">
          <h2>
            {lowStock
              ? "No low-stock records on this page"
              : "No inventory records on this page"}
          </h2>
          {lowStock && (
            <button
              className="button secondary"
              onClick={() => {
                setLowStock(false);
                pagination.reset();
              }}
            >
              Show all stock
            </button>
          )}
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={inventory.data?.nextCursor}
        disabled={inventory.loading || !!inventory.error}
        label="Inventory"
      />
      {(session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN") && (
        <InventoryCreateForm onSaved={inventory.refresh} />
      )}
    </>
  );
}
