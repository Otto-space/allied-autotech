"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { transactionStatuses } from "@/lib/api/vehicle-schemas";
import {
  parseWorkVehicleSales,
  purchaseLabels,
  salesPageParams,
  workVehicleSalesQuery,
  type WorkVehicleSale,
} from "@/lib/admin/work-vehicle-sales";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
export function WorkVehicleSales() {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <SalesAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff access is required to view vehicle sales." />
  );
}
function SalesAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    profile = access.data,
    error =
      access.error ||
      access.refreshError ||
      (profile &&
      (profile.id !== owner ||
        profile.role !== role ||
        profile.status !== "ACTIVE" ||
        (role === "STAFF" && !profile.staffProfile?.branchId))
        ? "Current vehicle-sales access and branch assignment could not be confirmed."
        : undefined);
  if (!profile || error)
    return (
      <div className="work-inspections work-vehicle-sales">
        <h1>Vehicle sales</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              onClick={access.refresh}
              disabled={access.loading || access.refreshing}
            >
              Retry sales access
            </button>
          </>
        ) : (
          <p role="status">Checking vehicle-sales access…</p>
        )}
      </div>
    );
  return (
    <SalesWorkspace
      key={`${owner}:${role}:${role === "STAFF" ? profile.staffProfile?.branchId : "all"}`}
      role={role}
      branchId={role === "STAFF" ? profile.staffProfile?.branchId : undefined}
    />
  );
}
function navigate(params: URLSearchParams) {
  window.history.pushState(
    null,
    "",
    `/admin/vehicle-sales${params.size ? `?${params}` : ""}`,
  );
}
function useSalesPage(path: string | null, role: string, branchId?: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseWorkVehicleSales(
        value,
        role,
        branchId,
        new URLSearchParams(path?.split("?")[1]),
      ),
    [path, role, branchId],
  );
  return useResource(path, parse);
}
function SalesWorkspace({ role, branchId }: { role: string; branchId?: string | null }) {
  const search = useSearchParams(),
    query = workVehicleSalesQuery(new URLSearchParams(search.toString()), role, branchId),
    sales = useSalesPage(query.path, role, branchId),
    data = sales.data,
    error = sales.error || sales.refreshError,
    busy = sales.loading || sales.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(query.params);
  filters.delete("cursor");
  filters.delete("_trail");
  function page(next: boolean) {
    navigate(salesPageParams(query.params, data?.nextCursor, !next));
    document.getElementById("wvs-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-inspections work-vehicle-sales">
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">Vehicle sales</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1 id="wvs-title" tabIndex={-1}>
            Vehicle sales
          </h1>
          <p>Review enquiries and purchase progress within your permitted branches.</p>
        </div>
        <button
          className="button secondary"
          onClick={sales.refresh}
          disabled={busy || query.invalid}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh vehicle sales
        </button>
      </header>
      {query.invalid ? (
        <section className="wi-state">
          <h2>Purchase filters unavailable</h2>
          <p>This link contains invalid or unavailable purchase filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear purchase filters
          </button>
        </section>
      ) : (
        <>
          <SalesFilters
            key={filters.toString()}
            params={filters}
            role={role}
            disabled={busy}
          />
          {role === "STAFF" && (
            <p className="wi-scope">Showing purchases for your assigned branch.</p>
          )}
          <section aria-labelledby="wvs-records">
            <div className="wi-band">
              <h2 id="wvs-records">Sales records</h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "purchase" : "purchases"}{" "}
                  on this page
                </span>
              )}
            </div>
            {busy && (
              <p className="wi-state" role="status">
                {data ? "Refreshing vehicle sales…" : "Checking vehicle sales…"}
              </p>
            )}
            {error && (
              <div className="wi-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded purchases are shown. Refresh before moving to another page."
                    : "Vehicle sales could not be loaded."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={sales.refresh}
                >
                  Retry vehicle sales
                </button>
              </div>
            )}
            {!busy && !error && data && !data.items.length && (
              <div className="wi-state">
                <h3>
                  {filters.size
                    ? "No purchases match these filters"
                    : "No vehicle purchases on this page"}
                </h3>
                <p>
                  {query.params.has("cursor")
                    ? "Return to the first page to check current purchases."
                    : "New vehicle enquiries will appear here."}
                </p>
              </div>
            )}
            <div className="wvs-records">
              {data?.items.map((sale) => (
                <SaleRecord key={sale.id} sale={sale} />
              ))}
            </div>
            <nav className="wi-pagination" aria-label="Vehicle purchases pages">
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("_trail")}
                onClick={() => page(false)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Previous
              </button>
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("cursor")}
                onClick={() => navigate(filters)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={blocked || !data?.nextCursor}
                onClick={() => page(true)}
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
function SalesFilters({
  params,
  role,
  disabled,
}: {
  params: URLSearchParams;
  role: string;
  disabled: boolean;
}) {
  const [status, setStatus] = useState(params.get("status") ?? ""),
    [branch, setBranch] = useState(params.get("branchId") ?? "");
  return (
    <form
      className="wi-filters"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        if (status) next.set("status", status);
        if (role !== "STAFF" && branch) next.set("branchId", branch);
        navigate(next);
      }}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">Purchase filters</legend>
        <div className="field">
          <label htmlFor="sales-status">Purchase status</label>
          <select
            id="sales-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {transactionStatuses.map((value) => (
              <option key={value} value={value}>
                {purchaseLabels[value]}
              </option>
            ))}
          </select>
        </div>
        {role !== "STAFF" && (
          <div className="field">
            <label htmlFor="sales-branch">Branch filter</label>
            <AdminBranchPicker
              id="sales-branch"
              value={branch}
              onChange={setBranch}
              activeOnly={false}
            />
          </div>
        )}
        <div className="actions">
          <button className="button">
            <Filter size={16} aria-hidden="true" />
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setStatus("");
              setBranch("");
              navigate(new URLSearchParams());
            }}
          >
            Clear purchase filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function SaleRecord({ sale }: { sale: WorkVehicleSale }) {
  const image =
      sale.vehicleListing.vehicle.images.find((image) => image.isPrimary) ??
      sale.vehicleListing.vehicle.images[0],
    vehicle = sale.vehicleListing.vehicle;
  return (
    <article className="wi-card wvs-record" aria-labelledby={`sale-${sale.id}`}>
      <div className="wvs-identity">
        <Link className="wvs-link" href={`/admin/vehicle-sales/${sale.id}`}>
          {sale.transactionNumber}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <div className="wvs-vehicle">
          {image && (
            <div className="wvs-image">
              <PublicMedia
                src={image.url}
                alt={image.altText ?? sale.vehicleListing.title}
                stockPreview
                sizes="80px"
                fallbackIcon={<CarFront aria-hidden="true" size={24} />}
              />
            </div>
          )}
          <div>
            <h3 id={`sale-${sale.id}`}>{sale.vehicleListing.title}</h3>
            <p>Stock {vehicle.stockNumber}</p>
            <p>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
        </div>
        <p className="wvs-version">Version {sale.version}</p>
      </div>
      <dl className="wvs-facts">
        <div>
          <dt>Customer</dt>
          <dd>{sale.customerName}</dd>
        </div>
        <div>
          <dt>Branch reference</dt>
          <dd>{sale.vehicleListing.branchId}</dd>
        </div>
      </dl>
      <dl className="wvs-facts">
        <div>
          <dt>Purchase status</dt>
          <dd>
            <span className="status">{purchaseLabels[sale.status]}</span>
          </dd>
        </div>
        <div>
          <dt>Handover status</dt>
          <dd>
            {sale.handover
              ? sale.handover.status.charAt(0) +
                sale.handover.status.slice(1).toLowerCase()
              : "Not recorded"}
          </dd>
        </div>
      </dl>
      <dl className="wvs-facts wvs-prices">
        {[
          { label: "Recorded asking price", value: sale.askingPriceKobo },
          { label: "Agreed price", value: sale.agreedPriceKobo },
          { label: "Required reservation", value: sale.reservationRequiredKobo },
        ].map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>
              {f.value === null
                ? f.label === "Agreed price"
                  ? "Not agreed"
                  : "Not recorded"
                : formatKobo(f.value)}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="wvs-facts">
        {[
          { label: "Created", value: sale.createdAt },
          { label: "Paid date", value: sale.paidAt },
          { label: "Reservation expires", value: sale.reservationExpiresAt },
        ]
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{formatStockInstant(f.value)}</dd>
            </div>
          ))}
      </dl>
    </article>
  );
}
