"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  customerDefaults,
  customerPageParams,
  customersQuery,
  parseWorkCustomers,
  type WorkCustomer,
} from "@/lib/admin/work-customers";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
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
          <section aria-labelledby="wc-records">
            <div className="wi-band">
              <h2 id="wc-records">Customer records</h2>
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
            <div className="wc-records">
              {data?.items.map((r) => (
                <CustomerRecord key={r.id} customer={r} />
              ))}
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
              value={draft.search}
              maxLength={120}
              aria-describedby="wc-search-hint"
              aria-invalid={!!error}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
            />
            <p id="wc-search-hint" className="field-hint">
              Name, email or phone prefix; use a complete customer ID.
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
        <Feedback message={error} />
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
function CustomerRecord({ customer: r }: { customer: WorkCustomer }) {
  const name = `${r.firstName} ${r.lastName}`.trim() || "Unnamed customer";
  return (
    <article className="wc-record" aria-labelledby={`wc-${r.id}`}>
      <div className="wc-person">
        <span className="wc-avatar" aria-hidden="true">
          {r.firstName[0]}
          {r.lastName[0]}
        </span>
        <div>
          <h3 id={`wc-${r.id}`}>
            <Link className="text-link" href={`/admin/customers/${r.id}`}>
              {name}
            </Link>
          </h3>
          <p className="wc-reference">Profile reference: {r.id}</p>
        </div>
      </div>
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{r.email || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{r.phone || "Not recorded"}</dd>
        </div>
      </dl>
      <dl>
        <div>
          <dt>Account status</dt>
          <dd>
            <span className="status" data-status={r.status}>
              {
                { ACTIVE: "Active", SUSPENDED: "Suspended", DEACTIVATED: "Deactivated" }[
                  r.status
                ]
              }
            </span>
          </dd>
        </div>
        <div>
          <dt>Email verification</dt>
          <dd>{r.emailVerified ? "Verified" : "Not verified"}</dd>
        </div>
        <div>
          <dt>Phone verification</dt>
          <dd>{r.phoneVerified ? "Verified" : "Not verified"}</dd>
        </div>
      </dl>
      <dl>
        <div>
          <dt>Registered</dt>
          <dd>{formatStockInstant(r.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}
