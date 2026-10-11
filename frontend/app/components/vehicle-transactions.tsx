"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CarFront, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { customerPurchaseQuery, purchaseLabels } from "@/lib/customer-purchase-query";
import { transactionStatuses } from "@/lib/api/vehicle-schemas";
import {
  parseCustomerPurchases,
  type CustomerPurchase,
} from "@/lib/api/customer-purchases-schema";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
const startDate = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});
function PurchaseRow({ item }: { item: CustomerPurchase }) {
  const images = item.vehicleListing.vehicle?.images ?? [];
  const photo = images.find((image) => image.isPrimary) ?? images[0];
  const rowId = `purchase-${item.id}`;
  return (
    <tr className="purchase-row">
      <th id={rowId} scope="row">
        <div className="purchase-vehicle">
          <div className="purchase-photo">
            <PublicMedia
              key={photo?.url ?? "missing"}
              src={photo?.url}
              alt={photo?.altText ?? item.vehicleListing.title}
              sizes="88px"
              fallbackIcon={<CarFront size={24} strokeWidth={1.5} />}
            />
          </div>
          <div className="purchase-identity">
            <span className="purchase-title">{item.vehicleListing.title}</span>
            <span>{item.transactionNumber}</span>
            <span>
              Started{" "}
              <time dateTime={item.createdAt}>
                {startDate.format(new Date(item.createdAt))}
              </time>
            </span>
          </div>
        </div>
      </th>
      <td headers={`${rowId} purchase-price-heading`} className="purchase-price">
        <span>{item.agreedPriceKobo === null ? "Asking price" : "Agreed price"}</span>
        <strong>{formatKobo(item.agreedPriceKobo ?? item.askingPriceKobo)}</strong>
      </td>
      <td headers={`${rowId} purchase-status-heading`} className="purchase-status-cell">
        <span
          className={`purchase-status${["CANCELLED", "EXPIRED"].includes(item.status) ? " closed" : ""}`}
        >
          {purchaseLabels[item.status]}
        </span>
      </td>
      <td className="purchase-row-action">
        <Link
          href={`/dashboard/vehicle-transactions/${item.id}`}
          aria-label={`View progress for ${item.vehicleListing.title}`}
          prefetch={false}
        >
          View progress <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

export function VehicleTransactions() {
  const search = useSearchParams();
  const { params, invalid, path } = customerPurchaseQuery(
    new URLSearchParams(search.toString()),
  );
  const status = params.get("status") ?? "",
    limit = params.get("limit")!,
    cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  const enquiries = useResource(path, parseCustomerPurchases);
  const data = !enquiries.loading && !enquiries.error ? enquiries.data : undefined;
  const stale = !!enquiries.refreshError;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/dashboard/vehicle-transactions?${customerPurchaseQuery(next).params}`,
    );
    if (focus) {
      document.getElementById("purchase-results")?.focus({ preventScroll: true });
      document.getElementById("purchase-results")?.scrollIntoView({ block: "start" });
    }
  }
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }
  function reset() {
    navigate(new URLSearchParams());
    document.getElementById("purchase-status")?.focus();
  }
  function firstPage() {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next, true);
  }
  return (
    <div className="customer-purchases">
      <nav className="purchase-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Vehicle purchases</span>
          </li>
        </ol>
      </nav>
      <header className="purchase-heading">
        <div>
          <h1>Vehicle enquiries & purchases</h1>
          <p>
            Follow each enquiry from your first conversation through payment and handover.
          </p>
        </div>
        <div className="purchase-actions">
          <button
            className="button secondary"
            onClick={enquiries.refresh}
            disabled={enquiries.loading || enquiries.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {enquiries.refreshing ? "Updating…" : "Refresh enquiries"}
          </button>
          <Link className="button" href="/vehicles">
            Browse vehicles
          </Link>
        </div>
      </header>
      <aside className="purchase-guidance">
        <CarFront size={26} aria-hidden="true" />
        <div>
          <h2>Your vehicle journey</h2>
          <p>Open an enquiry to review its progress and payment requests.</p>
        </div>
      </aside>
      <div className="purchase-filters" role="group" aria-label="Purchase filters">
        <div>
          <label htmlFor="purchase-status">Purchase status</label>
          <select
            id="purchase-status"
            value={status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {transactionStatuses.map((value) => (
              <option key={value} value={value}>
                {purchaseLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="purchase-limit">Rows per page</label>
          <select
            id="purchase-limit"
            value={limit}
            onChange={(e) => filter("limit", e.target.value)}
          >
            {[10, 20, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <button
          className="purchase-text-button"
          onClick={reset}
          disabled={!status && limit === "20" && !cursor && !invalid}
        >
          Reset filters
        </button>
        <p>All times in Lagos</p>
      </div>
      {invalid && (
        <p role="status">
          Some invalid filters were ignored. Reset filters to clear them.
        </p>
      )}
      {stale && (
        <div className="purchase-warning" role="alert">
          <p>
            <strong>These enquiries may be out of date.</strong> Refresh before relying on
            their status or price.
          </p>
          <button className="button secondary" onClick={enquiries.refresh}>
            Retry enquiries
          </button>
        </div>
      )}
      <section aria-label="Purchase results">
        <h2
          id="purchase-results"
          className="purchase-count"
          tabIndex={-1}
          aria-live="polite"
        >
          {enquiries.loading
            ? "Checking vehicle enquiries…"
            : enquiries.error
              ? "Enquiries unavailable"
              : data
                ? `${data.items.length} ${data.items.length === 1 ? "enquiry" : "enquiries"} on this page`
                : "Checking vehicle enquiries…"}
        </h2>
        {enquiries.loading && (
          <div className="purchase-skeleton" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {enquiries.error && (
          <div className="purchase-empty" role="alert">
            <CarFront size={28} aria-hidden="true" />
            <h3>We couldn’t load your enquiries</h3>
            <p>{enquiries.error}</p>
            <button className="button secondary" onClick={enquiries.refresh}>
              Retry enquiries
            </button>
            {cursor && (
              <button className="purchase-text-button" onClick={firstPage}>
                First page
              </button>
            )}
          </div>
        )}
        {!!data?.items.length && (
          <div className="purchase-table-wrap">
            <table className="purchase-table">
              <caption className="sr-only">
                Your vehicle enquiries and purchases. All start times are in Lagos time.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Vehicle</th>
                  <th id="purchase-price-heading" scope="col">
                    Price
                  </th>
                  <th id="purchase-status-heading" scope="col">
                    Status
                  </th>
                  <th scope="col">Progress</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <PurchaseRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data?.items.length === 0 && (
          <div className="purchase-empty">
            <CarFront size={30} aria-hidden="true" />
            <h3>
              {cursor
                ? "No enquiries on this page"
                : status
                  ? "No enquiries with this status"
                  : "No vehicle enquiries yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : status
                  ? "Try a different status or reset your filters."
                  : "Browse available vehicles and start an enquiry from a vehicle page."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : status ? (
              <button className="button secondary" onClick={reset}>
                Reset purchase filters
              </button>
            ) : (
              <Link className="button" href="/vehicles">
                Browse vehicles
              </Link>
            )}
          </div>
        )}
      </section>
      <footer className="purchase-footer">
        <nav className="purchase-pagination" aria-label="Purchase pages">
          <button
            className="button secondary"
            disabled={!trail.length || enquiries.loading || stale || !!enquiries.error}
            onClick={() => {
              const next = new URLSearchParams(params),
                previous = trail.at(-1)!;
              if (previous === "start") next.delete("cursor");
              else next.set("cursor", previous);
              const remaining = trail.slice(0, -1);
              if (remaining.length) next.set("_trail", remaining.join(","));
              else next.delete("_trail");
              navigate(next, true);
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Previous
          </button>
          <span>
            {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
          </span>
          <button
            className="button secondary"
            disabled={!data?.nextCursor || enquiries.loading || stale}
            onClick={() => {
              if (!data?.nextCursor) return;
              const next = new URLSearchParams(params);
              next.set("cursor", data.nextCursor);
              if ((!cursor || trail.length) && trail.length < 50)
                next.set("_trail", [...trail, cursor ?? "start"].join(","));
              else next.delete("_trail");
              navigate(next, true);
            }}
          >
            Next
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          {cursor && !trail.length && (
            <button className="purchase-text-button" onClick={firstPage}>
              First page
            </button>
          )}
        </nav>
        <p>
          Need help with an enquiry?{" "}
          <Link href="/dashboard/support">Contact customer care</Link>
        </p>
      </footer>
    </div>
  );
}
