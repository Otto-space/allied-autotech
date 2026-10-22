"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkVehicleStock,
  stockFilterDefaults,
  stockFilterParams,
  stockFilterSchema,
  stockMatchesFilters,
  stockStatusLabels,
  workVehicleStockQuery,
  type StockFilterValues,
  type WorkStockVehicle,
} from "@/lib/admin/work-vehicle-stock";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { AdminBranchPicker } from "./admin-branch-picker";

export function WorkVehicleStock() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Vehicle stock</h1>
        <Feedback message="Staff access is required to view vehicle stock." />
      </>
    );
  return (
    <StockAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function StockAccess({ owner, role }: { owner: string; role: string }) {
  const permissions = useOwnStaffPermissions(),
    profile = permissions.data;
  const invalid =
    !!profile &&
    (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE");
  const error =
    permissions.error ||
    permissions.refreshError ||
    (invalid ? "Your current vehicle stock access could not be confirmed." : undefined);
  if (error || !profile)
    return (
      <div className="work-services work-vehicle-stock">
        <h1>Vehicle stock</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={permissions.loading || permissions.refreshing}
              onClick={permissions.refresh}
            >
              Retry stock access
            </button>
          </>
        ) : (
          <p role="status">Checking stock access…</p>
        )}
      </div>
    );
  const branchId = profile.staffProfile?.branchId;
  if (role === "STAFF" && !branchId)
    return (
      <div className="work-services work-vehicle-stock">
        <h1>Vehicle stock</h1>
        <p className="notice">
          Vehicle stock needs an active branch assignment. Contact your administrator.
        </p>
        <button className="button secondary" onClick={permissions.refresh}>
          Recheck branch assignment
        </button>
      </div>
    );
  return (
    <StockWorkspace
      key={`${owner}:${role}:${branchId ?? "all"}`}
      role={role}
      branchId={branchId}
    />
  );
}
function navigate(params: URLSearchParams) {
  window.history.pushState(null, "", `/admin/vehicles${params.size ? `?${params}` : ""}`);
}
function StockWorkspace({ role, branchId }: { role: string; branchId?: string | null }) {
  const search = useSearchParams(),
    administrator = role !== "STAFF";
  const { params, api, path, invalid } = workVehicleStockQuery(
    new URLSearchParams(search.toString()),
    role,
    branchId,
  );
  const parse = useCallback(
    (value: unknown) => parseWorkVehicleStock(value, role, branchId),
    [role, branchId],
  );
  const stock = useResource(path, parse),
    cursor = params.get("cursor");
  const mismatch = stock.data?.items.some(
    (row) => !stockMatchesFilters(row, api) || row.id === cursor,
  );
  const data = invalid || mismatch ? undefined : stock.data,
    error = mismatch
      ? "The returned stock records do not match this page. Refresh to try again."
      : stock.error || stock.refreshError;
  const busy = stock.loading || stock.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const trail = params.get("_trail")?.split(",") ?? [];
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
    document.getElementById("vehicle-stock-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-services work-vehicle-stock">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Vehicle stock</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="vehicle-stock-title" tabIndex={-1}>
            Vehicle stock
          </h1>
          <p>Review stock records and sale listings in your permitted branches.</p>
        </div>
        <div className="actions">
          <button className="button secondary" disabled={busy} onClick={stock.refresh}>
            <RefreshCw size={16} aria-hidden="true" />
            Refresh vehicle stock
          </button>
          {administrator || !blocked ? (
            <Link className="button" href="/admin/vehicles/new">
              <Plus size={16} aria-hidden="true" />
              Add vehicle record
            </Link>
          ) : (
            <span
              className="button ws-disabled"
              aria-disabled="true"
              title="Confirm active branch stock access first"
            >
              <Plus size={16} aria-hidden="true" />
              Add vehicle record
            </span>
          )}
        </div>
      </header>
      {invalid ? (
        <section className="work-service-state">
          <h2>Stock filters unavailable</h2>
          <p>This link contains invalid or unavailable stock filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear stock filters
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
          {!administrator && (
            <p className="ws-scope">
              Showing your assigned active branch
              {data?.items[0] ? `: ${data.items[0].branch.name}` : ""}.
            </p>
          )}
          <p className="ws-guidance">
            Stock records and sale listings are separate. Unlisted records have no sale
            listing.
          </p>
          <section className="ws-records" aria-labelledby="vehicle-stock-records-title">
            <div className="ws-band">
              <h2 id="vehicle-stock-records-title">Stock records</h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "record" : "records"} on
                  this page
                </span>
              )}
            </div>
            {busy && (
              <div className="work-service-state" role="status">
                {data ? "Refreshing vehicle stock…" : "Checking vehicle stock…"}
                {!data && <div className="ws-skeleton" aria-hidden="true" />}
              </div>
            )}
            {error && (
              <div className="work-service-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded stock records are shown. Refresh before adding records or moving to another page."
                    : "Vehicle stock could not be loaded. Check your branch access or try again."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={stock.refresh}
                >
                  Retry vehicle stock
                </button>
              </div>
            )}
            {data && data.items.length > 0 && <StockTable rows={data.items} />}
            {!busy && !error && data?.items.length === 0 && (
              <div className="work-service-state">
                <h3>
                  {filters.size
                    ? "No vehicles match these filters"
                    : cursor
                      ? "No stock records on this page"
                      : "No vehicle stock yet"}
                </h3>
                <p>
                  {filters.size
                    ? "Change the filters or refresh to check again."
                    : "Add a vehicle record before creating its sale listing."}
                </p>
                {filters.size > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => navigate(new URLSearchParams())}
                  >
                    Clear stock filters
                  </button>
                )}
              </div>
            )}
            <nav className="work-service-pagination" aria-label="Vehicle stock pages">
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
  const [open, setOpen] = useState(false),
    form = useForm<StockFilterValues>({
      resolver: zodResolver(stockFilterSchema),
      defaultValues: stockFilterDefaults(params),
    });
  const field = (
    name: "search" | "make" | "model" | "year",
    label: string,
    max: number,
  ) => {
    const error = form.formState.errors[name];
    return (
      <div className={`field ws-filter-${name}`}>
        <label htmlFor={`stock-filter-${name}`}>{label}</label>
        <input
          id={`stock-filter-${name}`}
          {...form.register(name)}
          type={name === "search" ? "search" : "text"}
          maxLength={max}
          inputMode={name === "year" ? "numeric" : "text"}
          placeholder={name === "search" ? "Stock number, make, model or VIN" : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `stock-filter-${name}-error` : undefined}
        />
        {error && (
          <p className="field-error" role="alert" id={`stock-filter-${name}-error`}>
            {error.message}
          </p>
        )}
      </div>
    );
  };
  return (
    <section
      className={`ws-filters${open ? " ws-filters-open" : ""}`}
      aria-label="Vehicle stock filters"
    >
      <button
        className="ws-filter-toggle button secondary"
        aria-expanded={open}
        aria-controls="vehicle-stock-filter-form"
        onClick={() => setOpen(!open)}
      >
        <Filter size={18} aria-hidden="true" />
        <span>
          Filters<small>Search, listing status and branch</small>
        </span>
        <ChevronRight className="ws-filter-chevron" size={16} aria-hidden="true" />
      </button>
      <form
        id="vehicle-stock-filter-form"
        className="ws-filter-form"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          navigate(stockFilterParams(values, administrator)),
        )}
      >
        {field("search", "Search stock records", 100)}
        <div className="field">
          <label htmlFor="stock-filter-status">Listing status filter</label>
          <select id="stock-filter-status" {...form.register("status")}>
            <option value="">All records, including unlisted</option>
            <option value="LISTED">Listed records</option>
            <option value="UNLISTED">Unlisted records</option>
            {Object.entries(stockStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {administrator && (
          <div className="field">
            <label htmlFor="stock-filter-branch">Branch filter</label>
            <Controller
              name="branchId"
              control={form.control}
              render={({ field }) => (
                <AdminBranchPicker
                  id="stock-filter-branch"
                  value={field.value}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  activeOnly={false}
                />
              )}
            />
          </div>
        )}
        {field("make", "Exact make", 80)}
        {field("model", "Exact model", 80)}
        {field("year", "Model year filter", 4)}
        <div className="actions">
          <button className="button" disabled={busy}>
            Apply stock filters
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              form.reset(stockFilterDefaults(new URLSearchParams()));
              navigate(new URLSearchParams());
            }}
          >
            Clear stock filters
          </button>
        </div>
      </form>
    </section>
  );
}
function StockTable({ rows }: { rows: WorkStockVehicle[] }) {
  const transmission = {
    AUTOMATIC: "Automatic",
    MANUAL: "Manual",
    CVT: "CVT",
    OTHER: "Other transmission",
  } as const;
  return (
    <table className="ws-table" aria-label="Vehicle stock">
      <thead>
        <tr>
          <th scope="col">Vehicle</th>
          <th scope="col">Branch</th>
          <th scope="col">Sale listings</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const image = row.images.find((image) => image.isPrimary) ?? row.images[0],
            name = `${row.year} ${row.make} ${row.model}`;
          return (
            <tr key={row.id}>
              <th scope="row">
                <div className="ws-vehicle">
                  <div className="ws-thumb">
                    <PublicMedia
                      key={image?.url ?? row.id}
                      src={image?.url}
                      alt={image?.altText ?? name}
                      stockPreview
                      sizes="88px"
                      fallbackIcon={<CarFront size={24} strokeWidth={1.5} />}
                    />
                  </div>
                  <div className="ws-vehicle-copy">
                    <Link
                      href={`/admin/vehicles/${row.id}`}
                      aria-label={`Manage ${name} (${row.stockNumber})`}
                    >
                      {name}
                    </Link>
                    <p className="ws-stock-number">{row.stockNumber}</p>
                    {row.trim && <p>{row.trim}</p>}
                    <p className="ws-specs">
                      {row.condition === "NEW" ? "New" : "Used"} ·{" "}
                      {row.mileageKm === null
                        ? "Mileage not recorded"
                        : `${row.mileageKm.toLocaleString("en-NG")} km`}
                      {row.transmission ? ` · ${transmission[row.transmission]}` : ""}
                    </p>
                  </div>
                </div>
              </th>
              <td data-label="Branch">
                <span className="ws-branch-name">{row.branch.name}</span>
                <span className="ws-branch-code">{row.branch.code}</span>
                {!row.branch.isActive && (
                  <span className="ws-inactive">Inactive branch</span>
                )}
              </td>
              <td data-label="Sale listings">
                {row.listings.length ? (
                  row.listings.map((listing) => (
                    <div className="ws-listing" key={listing.id}>
                      <div>
                        <span className="ws-listing-title">{listing.title}</span>
                        <span className="ws-listing-status" data-status={listing.status}>
                          {stockStatusLabels[listing.status]}
                        </span>
                      </div>
                      <p className="ws-price">{formatKobo(listing.priceKobo)}</p>
                    </div>
                  ))
                ) : (
                  <div className="ws-unlisted">
                    <span>Not listed</span>
                    <p>This stock record has no sale listing.</p>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
