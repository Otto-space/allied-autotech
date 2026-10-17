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
  discountTypeLabels,
  parseWorkPromotions,
  promotionMatchesFilters,
  workPromotionsQuery,
  type WorkPromotion,
} from "@/lib/admin/work-promotions";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { formatPromotionDate, promotionDiscount } from "./promotion-summary";
export function WorkPromotions() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Promotions</h1>
        <Feedback message="Administrator access is required to manage promotions." />
      </>
    );
  return <PromotionWorkspace key={`${session.user.id}:${session.user.role}`} />;
}
function navigate(params: URLSearchParams) {
  window.history.pushState(
    null,
    "",
    `/admin/promotions${params.size ? `?${params}` : ""}`,
  );
}
function PromotionWorkspace() {
  const search = useSearchParams(),
    { params, api, path, invalid } = workPromotionsQuery(
      new URLSearchParams(search.toString()),
    );
  const records = useResource(path, parseWorkPromotions),
    mismatch = records.data?.items.some((row) => !promotionMatchesFilters(row, api));
  const data = invalid || mismatch ? undefined : records.data,
    error = mismatch
      ? "The returned promotions do not match your filters. Refresh to try again."
      : records.error || records.refreshError;
  const busy = records.loading || records.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function page(direction: "next" | "previous") {
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
    document.getElementById("work-promotions-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-services work-promotions">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Promotions</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-promotions-title" tabIndex={-1}>
            Promotions
          </h1>
          <p>
            Manage checkout discounts, eligibility windows and configured usage limits.
          </p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy || invalid}
            onClick={records.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh promotions
          </button>
          <Link className="button" href="/admin/promotions/new">
            <Plus size={16} aria-hidden="true" />
            Create promotion
          </Link>
        </div>
      </header>
      {invalid ? (
        <section className="work-service-state">
          <h2>Promotion filters unavailable</h2>
          <p>This link contains invalid or unavailable promotion filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <>
          <PromotionFilters key={filters.toString()} params={filters} busy={busy} />
          <section className="wp-records" aria-labelledby="work-promotions-records">
            <div className="wp-band">
              <h2 id="work-promotions-records">Promotion records</h2>
              {data && (
                <span>
                  {data.items.length}{" "}
                  {data.items.length === 1 ? "promotion" : "promotions"} on this page
                </span>
              )}
            </div>
            {busy && (
              <div className="work-service-state" role="status">
                {data ? "Refreshing promotions…" : "Checking promotions…"}
                {!data && <div className="wp-skeleton" aria-hidden="true" />}
              </div>
            )}
            {error && (
              <div className="work-service-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded promotions are shown. Refresh before moving to another page."
                    : "Promotions could not be loaded. Try again when your connection is available."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={records.refresh}
                >
                  Retry promotions
                </button>
              </div>
            )}
            {data && data.items.length > 0 && <PromotionTable rows={data.items} />}
            {!busy && !error && data?.items.length === 0 && (
              <div className="work-service-state">
                <h3>
                  {filters.size
                    ? "No matching promotions"
                    : cursor
                      ? "No promotions on this page"
                      : "No promotions yet"}
                </h3>
                <p>
                  {filters.size
                    ? "Change the filters or refresh to check again."
                    : "Create a promotion when its discount and eligibility rules are approved."}
                </p>
                {filters.size > 0 && (
                  <button
                    className="button secondary"
                    onClick={() => navigate(new URLSearchParams())}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <nav className="work-service-pagination" aria-label="Promotion pages">
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
function PromotionFilters({ params, busy }: { params: URLSearchParams; busy: boolean }) {
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [active, setActive] = useState(params.get("isActive") ?? ""),
    [type, setType] = useState(params.get("discountType") ?? ""),
    [open, setOpen] = useState(false);
  return (
    <section
      className={`wp-filters${open ? " wp-filters-open" : ""}`}
      aria-label="Promotion filters"
    >
      <button
        className="wp-filter-toggle button secondary"
        aria-expanded={open}
        aria-controls="promotion-filter-form"
        onClick={() => setOpen(!open)}
      >
        <Filter size={16} aria-hidden="true" />
        Filters
      </button>
      <form
        id="promotion-filter-form"
        className="wp-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("search", search.trim());
          if (active) next.set("isActive", active);
          if (type) next.set("discountType", type);
          navigate(next);
        }}
      >
        <div className="field">
          <label htmlFor="promotion-search">Search promotion name or code</label>
          <input
            id="promotion-search"
            type="search"
            maxLength={160}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="promotion-active">Configuration filter</label>
          <select
            id="promotion-active"
            value={active}
            onChange={(event) => setActive(event.target.value)}
          >
            <option value="">All promotions</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="promotion-type">Discount type</label>
          <select
            id="promotion-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All types</option>
            {Object.entries(discountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
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
      <p className="wp-guidance">
        Enabled is a configuration setting. Dates, subtotal and usage limits are checked
        at checkout. These records do not include redemption counts or remaining uses.
      </p>
    </section>
  );
}
function PromotionTable({ rows }: { rows: WorkPromotion[] }) {
  const money = (value: string | null) =>
    value === null ? "Not set" : formatKobo(value);
  return (
    <table className="wp-table" aria-label="Promotions">
      <thead>
        <tr>
          {[
            "Promotion",
            "Discount",
            "Eligibility window (Lagos)",
            "Configuration",
            "Usage limits",
          ].map((label) => (
            <th scope="col" key={label}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">
              <Link
                className="text-link"
                href={`/admin/promotions/${row.id}`}
                aria-label={`Manage ${row.name}`}
              >
                {row.name}
              </Link>
              <span className="wp-code">
                {row.code === null ? "No redemption code" : `Code: ${row.code}`}
              </span>
            </th>
            <td data-label="Discount">
              <strong className="wp-discount">{promotionDiscount(row)}</strong>
              <dl>
                <div>
                  <dt>Minimum subtotal</dt>
                  <dd>{money(row.minimumOrderAmountKobo)}</dd>
                </div>
                <div>
                  <dt>Discount cap</dt>
                  <dd>{money(row.maximumDiscountAmountKobo)}</dd>
                </div>
              </dl>
            </td>
            <td data-label="Eligibility window (Lagos)">
              <dl>
                <div>
                  <dt>Starts</dt>
                  <dd>
                    <time dateTime={row.startsAt}>
                      {formatPromotionDate(row.startsAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>
                    <time dateTime={row.endsAt}>{formatPromotionDate(row.endsAt)}</time>
                  </dd>
                </div>
              </dl>
            </td>
            <td data-label="Configuration">
              <span className="wp-configuration">
                {row.isActive ? "Enabled" : "Disabled"}
              </span>
            </td>
            <td data-label="Usage limits">
              <dl>
                <div>
                  <dt>Total usage limit</dt>
                  <dd>{row.usageLimit ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Per-customer limit</dt>
                  <dd>{row.perCustomerLimit ?? "Not set"}</dd>
                </div>
              </dl>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
