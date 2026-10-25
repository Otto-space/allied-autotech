"use client";
import "./care-workspace.css";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  customerDefaults,
  customerPageParams,
  customersQuery,
  parseWorkCustomers,
  type WorkCustomer,
} from "@/lib/admin/work-customers";
import { CopyableValue } from "./copyable-value";
import { CustomerAccountAction } from "./customer-account-action";
import { StatusBadge } from "./status-progress";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";

export function WorkCustomers() {
  const session = useAccountSession();
  if (!session) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <CustomerAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-inspections work-customers">
      <h1>Customers</h1>
      <Feedback message="Administrator access is required to view customers." />
    </div>
  );
}
function CustomerAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current customer-directory access could not be confirmed."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-customers">
        <h1>Customers</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={access.loading || access.refreshing}
              onClick={access.refresh}
            >
              Retry customer access
            </button>
          </>
        ) : (
          <p role="status">Checking customer access…</p>
        )}
      </div>
    );
  return <CustomerWorkspace />;
}
function useCustomerNavigate() {
  const router = useRouter();
  return (params: URLSearchParams) =>
    router.push(`/admin/customers${params.size ? `?${params}` : ""}`, { scroll: false });
}
function useCustomersPage(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseWorkCustomers(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function CustomerWorkspace() {
  const navigate = useCustomerNavigate(),
    search = useSearchParams(),
    query = customersQuery(new URLSearchParams(search.toString())),
    path = query.path,
    records = useCustomersPage(path),
    data = records.data,
    error = records.error || records.refreshError,
    busy = records.loading || records.refreshing,
    blocked = busy || !!error || !data;
  const filters = new URLSearchParams(query.params);
  filters.delete("cursor");
  filters.delete("_trail");
  return (
    <div className="work-inspections work-customers">
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Customers</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1 id="wc-title" tabIndex={-1}>
            Customers
          </h1>
          <p>Find a customer and review their account and activity.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || query.invalid}
          onClick={records.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh customers
        </button>
      </header>
      {query.invalid ? (
        <section className="wi-state">
          <h2>Customer filters unavailable</h2>
          <p>This link contains invalid or unavailable customer filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear customer filters
          </button>
        </section>
      ) : (
        <>
          <CustomerFilters key={filters.toString()} params={filters} busy={busy} />
          <div
            className="wc-applied-filters"
            role="group"
            aria-label="Applied customer filters"
          >
            {["search", "status", "verified"]
              .filter((key) => filters.has(key))
              .map((key) => {
                const title =
                  key === "search"
                    ? "Customer search"
                    : key === "status"
                      ? `Status: ${filters.get(key)!.toLowerCase()}`
                      : `Email: ${filters.get(key) === "true" ? "verified" : "not verified"}`;
                return (
                  <button
                    type="button"
                    className="button secondary"
                    key={key}
                    disabled={busy}
                    aria-label={`Remove ${title}`}
                    onClick={() => {
                      const next = new URLSearchParams(filters);
                      next.delete(key);
                      if (key === "search") next.delete("field");
                      navigate(next);
                      document
                        .getElementById("wc-records")
                        ?.focus({ preventScroll: true });
                    }}
                  >
                    {title}
                    <X size={14} aria-hidden="true" />
                  </button>
                );
              })}
          </div>
          <section aria-labelledby="wc-records">
            <div className="wi-band">
              <h2 id="wc-records" tabIndex={-1}>
                Customer records
              </h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "customer" : "customers"}{" "}
                  on this page
                </span>
              )}
            </div>
            {busy && (
              <p className="wi-state" role="status">
                {data ? "Refreshing customers…" : "Loading customers…"}
              </p>
            )}
            {error && (
              <div className="wi-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded customers are shown. Refresh before moving to another page."
                    : "Customers could not be loaded."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={records.refresh}
                >
                  Retry customers
                </button>
              </div>
            )}
            {!busy && !error && data && !data.items.length && (
              <div className="wi-state">
                <h3>
                  {filters.has("search") ||
                  filters.has("status") ||
                  filters.has("verified")
                    ? "No matching customers"
                    : "No customers on this page"}
                </h3>
                <p>
                  {query.params.has("cursor")
                    ? "Return to the first page to check current customers."
                    : "Try different filters or check again after a customer registers."}
                </p>
              </div>
            )}
            <div
              className="wc-records wc-table-region"
              role="region"
              aria-label="Customer results"
              tabIndex={0}
            >
              <table className="care-table">
                <caption className="sr-only">Customers on this page</caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Account status</th>
                    <th
                      scope="col"
                      aria-sort={
                        query.params.get("sort") === "oldest" ? "ascending" : "descending"
                      }
                    >
                      <button
                        type="button"
                        className="care-sort"
                        disabled={busy}
                        aria-label={
                          query.params.get("sort") === "oldest"
                            ? "Sort joined newest first"
                            : "Sort joined oldest first"
                        }
                        onClick={() => {
                          const next = new URLSearchParams(filters);
                          next.set(
                            "sort",
                            query.params.get("sort") === "oldest" ? "newest" : "oldest",
                          );
                          navigate(next);
                        }}
                      >
                        Joined {query.params.get("sort") === "oldest" ? "↑" : "↓"}
                      </button>
                    </th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((r) => (
                    <CustomerRecord
                      key={r.id}
                      customer={r}
                      returnParams={query.params.toString()}
                      disabled={blocked}
                      onChanged={records.refresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="wi-pagination" aria-label="Customers pages">
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("_trail")}
                onClick={() =>
                  navigate(customerPageParams(query.params, undefined, true))
                }
              >
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
                onClick={() => {
                  navigate(customerPageParams(query.params, data?.nextCursor));
                  document.getElementById("wc-title")?.focus({ preventScroll: true });
                }}
              >
                Next
              </button>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
function CustomerFilters({ params, busy }: { params: URLSearchParams; busy: boolean }) {
  const navigate = useCustomerNavigate();
  const [draft, setDraft] = useState({
      ...customerDefaults,
      ...Object.fromEntries(params),
    }),
    [error, setError] = useState("");
  return (
    <form
      className="wi-filters wc-filters"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const key of Object.keys(customerDefaults))
          if (draft[key as keyof typeof customerDefaults])
            next.set(key, draft[key as keyof typeof customerDefaults]);
        const query = customersQuery(next);
        if (query.invalid) {
          setError(
            "Enter a complete customer ID, at least 3 phone digits, or at least 2 name or email characters.",
          );
          document.getElementById("customer-search")?.focus();
          return;
        }
        setError("");
        if (
          query.params.toString() !== params.toString() ||
          window.location.search.includes("cursor=")
        )
          navigate(query.params);
      }}
    >
      <fieldset disabled={busy}>
        <legend className="sr-only">Customer filters</legend>

        <div className="wi-filter-grid wc-filter-grid">
          <div className="field wc-search">
            <label htmlFor="customer-search">Search customers</label>
            <input
              id="customer-search"
              type="search"
              inputMode={
                draft.field === "phone"
                  ? "tel"
                  : draft.field === "email"
                    ? "email"
                    : "text"
              }
              value={draft.search}
              maxLength={120}
              aria-describedby={
                error ? "wc-search-hint wc-search-error" : "wc-search-hint"
              }
              aria-invalid={!!error}
              onChange={(e) => {
                setDraft({ ...draft, search: e.target.value });
                setError("");
              }}
            />
            <p id="wc-search-hint" className="field-hint">
              {draft.field === "id"
                ? "Paste the complete customer ID; partial IDs cannot be searched."
                : draft.field === "phone"
                  ? "Start with at least 3 phone digits, including the country code when recorded."
                  : `Enter at least 2 characters from the start of the ${draft.field}. Search is not case-sensitive.`}
            </p>
          </div>
          {(
            [
              {
                key: "field",
                label: "Search by",
                options: [
                  ["name", "Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["id", "Customer ID"],
                ],
              },
              {
                key: "status",
                label: "Account status",
                options: [
                  ["", "All statuses"],
                  ["ACTIVE", "Active"],
                  ["SUSPENDED", "Suspended"],
                  ["DEACTIVATED", "Deactivated"],
                ],
              },
              {
                key: "verified",
                label: "Email verification",
                options: [
                  ["", "All customers"],
                  ["true", "Verified"],
                  ["false", "Not verified"],
                ],
              },
              {
                key: "sort",
                label: "Sort by",
                options: [
                  ["newest", "Newest registered"],
                  ["oldest", "Oldest registered"],
                ],
              },
            ] as const
          ).map(({ key, label, options }) => (
            <div className="field" key={key}>
              <label htmlFor={`customer-${key}`}>{label}</label>
              <select
                id={`customer-${key}`}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              >
                {options.map(([value, text]) => (
                  <option value={value} key={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div id="wc-search-error">
          <Feedback message={error} />
        </div>
        <div className="wi-filter-actions">
          <button className="button" type="submit">
            Search customers
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setDraft(customerDefaults);
              setError("");
              navigate(new URLSearchParams());
            }}
          >
            Clear filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function CustomerRecord({
  customer: r,
  returnParams,
  disabled,
  onChanged,
}: {
  customer: WorkCustomer;
  returnParams: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const session = useAccountSession();
  const name = (r.firstName + " " + r.lastName).trim() || "Unnamed customer",
    href = "/admin/customers/" + r.id;
  function remember() {
    try {
      sessionStorage.setItem(
        `aat:customer-return:${session?.user.id}`,
        JSON.stringify({ id: r.id, params: returnParams }),
      );
    } catch {}
  }
  return (
    <tr className="wc-record">
      <td>
        <Link className="text-link" href={href} onClick={remember}>
          {name}
        </Link>
      </td>
      <td>
        <CopyableValue value={r.email} label="Copy customer email" />
      </td>
      <td>
        <CopyableValue value={r.phone} label="Copy customer phone" />
      </td>
      <td>
        <StatusBadge status={r.status} />
      </td>
      <td>
        <time dateTime={r.createdAt} title={new Date(r.createdAt).toISOString()}>
          {new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeZone: "Africa/Lagos",
          }).format(new Date(r.createdAt))}
        </time>
      </td>
      <td>
        <div className="care-row-actions">
          <Link className="text-link" href={href} onClick={remember}>
            View details <ChevronRight size={14} aria-hidden="true" />
            <span className="sr-only"> for {name}</span>
          </Link>
          <CustomerAccountAction customer={r} disabled={disabled} onChanged={onChanged} />
        </div>
      </td>
    </tr>
  );
}
