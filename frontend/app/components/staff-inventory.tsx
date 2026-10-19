"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  inventoryCreationKey,
  readInventoryCreation,
  inventoryMatchesFilters,
  parseWorkInventories,
  workInventoryQuery,
} from "@/lib/admin/work-inventory";
import type { Inventory } from "@/lib/api/inventory-schemas";
import { Feedback } from "./feedback";
import { InventoryCreateForm } from "./inventory-create-form";
import { AdminBranchPicker } from "./admin-branch-picker";
import { useAccountSession } from "./dashboard-shell";
export function StaffInventory() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Parts inventory</h1>
        <Feedback message="Staff access is required to view inventory." />
      </>
    );
  return (
    <InventoryWorkspace
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function navigate(params: URLSearchParams) {
  window.history.pushState(
    null,
    "",
    `/admin/inventory${params.size ? `?${params}` : ""}`,
  );
}
function InventoryWorkspace({ owner, role }: { owner: string; role: string }) {
  const search = useSearchParams(),
    administrator = role !== "STAFF";
  const { params, api, path, invalid } = workInventoryQuery(
    new URLSearchParams(search.toString()),
    administrator,
  );
  const inventory = useResource(path, parseWorkInventories),
    mismatch = inventory.data?.items.some((row) => !inventoryMatchesFilters(row, api));
  const data = invalid || mismatch ? undefined : inventory.data,
    error = mismatch
      ? "The returned inventory does not match your filters. Refresh to try again."
      : inventory.error || inventory.refreshError;
  const busy = inventory.loading || inventory.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  const [createOpen, setCreateOpen] = useState(
      () => !!readInventoryCreation(inventoryCreationKey(owner)),
    ),
    [createMounted, setCreateMounted] = useState(
      () => !!readInventoryCreation(inventoryCreationKey(owner)),
    );
  function openCreation() {
    setCreateMounted(true);
    setCreateOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("inventory-create-branch")?.focus(),
    );
  }
  function page(direction: "previous" | "next") {
    const next = new URLSearchParams(params);
    if (direction === "next" && data?.nextCursor) {
      const history = [...trail, cursor ?? "start"];
      next.set("cursor", data.nextCursor);
      if (history.length <= 20 && history[0] === "start")
        next.set("_trail", history.join(","));
      else next.delete("_trail");
    } else {
      const history = [...trail],
        previous = history.pop();
      if (previous && previous !== "start") next.set("cursor", previous);
      else next.delete("cursor");
      if (history.length) next.set("_trail", history.join(","));
      else next.delete("_trail");
    }
    navigate(next);
    document.getElementById("work-inventory-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-services work-inventory">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Product inventory</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-inventory-title" tabIndex={-1}>
            Parts inventory
          </h1>
          <p>Review recorded stock and reservations in your permitted branches.</p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy || invalid}
            onClick={inventory.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh inventory
          </button>
          {administrator && (
            <button className="button" onClick={openCreation}>
              <Plus size={16} aria-hidden="true" />
              Add inventory record
            </button>
          )}
        </div>
      </header>
      {invalid ? (
        <section className="work-service-state">
          <h2>Inventory filters unavailable</h2>
          <p>This link contains invalid or unavailable inventory filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <StockFilters
            key={filters.toString()}
            params={filters}
            administrator={administrator}
            busy={busy}
          />
          <p className="wi-guidance">
            Available is on-hand stock less reserved stock. Low stock is at or below the
            reorder level.
          </p>
          <section
            className="work-service-catalogue wi-catalogue"
            aria-labelledby="work-inventory-records"
          >
            <div className="wi-band">
              <h2 id="work-inventory-records">Inventory records</h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "record" : "records"} on
                  this page
                </span>
              )}
            </div>
            {busy && (
              <div className="work-service-state" role="status">
                {data ? "Refreshing inventory…" : "Checking inventory…"}
                {!data && <div className="wi-skeleton" aria-hidden="true" />}
              </div>
            )}
            {error && (
              <div className="work-service-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded inventory is shown. Refresh before moving to another page."
                    : "Inventory could not be loaded. Try again when your connection is available."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={inventory.refresh}
                >
                  Retry inventory
                </button>
              </div>
            )}
            {data && data.items.length > 0 && <StockTable rows={data.items} />}
            {!busy && !error && data?.items.length === 0 && (
              <div className="work-service-state">
                <h3>
                  {filters.get("lowStock") === "true"
                    ? "No low-stock records on this page"
                    : filters.size
                      ? "No inventory matches these filters"
                      : "No inventory records on this page"}
                </h3>
                <p>
                  {filters.size
                    ? "Check the part name or SKU, or clear filters to see other stock."
                    : "Inventory records will appear here when they are added for a branch."}
                </p>
                {filters.size > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => navigate(new URLSearchParams())}
                  >
                    {filters.get("lowStock") === "true"
                      ? "Show all stock"
                      : "Clear filters"}
                  </button>
                )}
              </div>
            )}
            <nav className="work-service-pagination" aria-label="Inventory pages">
              <button
                className="button secondary"
                disabled={blocked || !cursor}
                onClick={() => page("previous")}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {cursor && !trail.length ? "First page" : "Previous"}
              </button>
              <span>
                {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
              </span>
              <button
                className="button secondary"
                disabled={blocked || !data?.nextCursor || data.nextCursor === cursor}
                onClick={() => page("next")}
              >
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </section>
        </>
      )}
      {administrator && (
        <section className="wi-create">
          <button
            className="wi-create-toggle"
            aria-expanded={createOpen}
            aria-controls="inventory-create-panel"
            onClick={() => {
              setCreateMounted(true);
              setCreateOpen(!createOpen);
            }}
          >
            <span>
              <strong>Add a branch inventory record</strong>
              <small>Create an empty record; receive stock separately.</small>
            </span>
            <Plus size={18} aria-hidden="true" />
          </button>
          <div id="inventory-create-panel" hidden={!createOpen}>
            {createMounted && (
              <InventoryCreateForm
                owner={owner}
                role={role}
                onSaved={inventory.refresh}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
function StockFilters({
  params,
  administrator,
  busy,
}: {
  params: URLSearchParams;
  administrator: boolean;
  busy: boolean;
}) {
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [branch, setBranch] = useState(params.get("branchId") ?? ""),
    [lowStock, setLowStock] = useState(params.get("lowStock") === "true"),
    [open, setOpen] = useState(false);
  return (
    <section
      className={`wi-filters${open ? " wi-filters-open" : ""}`}
      aria-label="Inventory filters"
    >
      <button
        className="wi-filter-toggle button secondary"
        aria-expanded={open}
        aria-controls="inventory-filters-form"
        onClick={() => setOpen(!open)}
      >
        <Filter size={16} aria-hidden="true" />
        Filters
      </button>
      <form
        id="inventory-filters-form"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("search", search.trim());
          if (branch) next.set("branchId", branch);
          if (lowStock) next.set("lowStock", "true");
          if (params.has("productId")) next.set("productId", params.get("productId")!);
          navigate(next);
        }}
      >
        <div className="field">
          <label htmlFor="inventory-search">Search part name or SKU</label>
          <input
            id="inventory-search"
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {administrator && (
          <div className="field">
            <label htmlFor="inventory-branch">Branch</label>
            <AdminBranchPicker
              id="inventory-branch"
              value={branch}
              onChange={setBranch}
              activeOnly={false}
            />
          </div>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(event) => setLowStock(event.target.checked)}
          />
          Show only low-stock records
        </label>
        <div className="actions">
          <button className="button" disabled={busy}>
            Apply filters
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </div>
      </form>
      {params.has("productId") && (
        <p className="wi-scope">
          Showing one selected part. Clear filters to include other parts.
        </p>
      )}
      {!administrator && (
        <p className="wi-scope">Inventory is limited to your assigned active branch.</p>
      )}
    </section>
  );
}
function StockTable({ rows }: { rows: Inventory[] }) {
  return (
    <table className="wi-table" aria-label="Parts inventory">
      <thead>
        <tr>
          {["Part & branch", "On hand", "Reserved", "Available", "Reorder level"].map(
            (label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">
              <Link href={`/admin/inventory/${row.id}`} className="text-link">
                {row.product.name}
              </Link>
              <span className="wi-meta">{row.product.sku}</span>
              <span className="wi-meta">
                {row.branch.name}
                {row.branch.isActive ? "" : " (inactive branch)"}
              </span>
              {(!row.product.isActive || !row.product.category.isActive) && (
                <span className="wi-meta">
                  {!row.product.isActive ? "Inactive part" : "Inactive category"}
                </span>
              )}
            </th>
            {(
              [
                ["On hand", row.quantity],
                ["Reserved", row.reserved],
                ["Available", row.available],
                ["Reorder level", row.reorderLevel],
              ] as const
            ).map(([label, value]) => (
              <td key={label}>
                <span className="wi-mobile-label" aria-hidden="true">
                  {label}
                </span>
                <span>{value}</span>
                {label === "Available" && row.available <= row.reorderLevel && (
                  <small className="wi-low">Low stock</small>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
