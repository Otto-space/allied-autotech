"use client";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { parseCustomerDirectory } from "@/lib/api/customer-directory-schemas";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import styles from "./customer-directory.module.css";

const initial = { search: "", field: "name", status: "", verified: "", sort: "newest" };
export function CustomerDirectory() {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [invalid, setInvalid] = useState("");
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(
    allowed ? `/admin/customers?${query}` : null,
    parseCustomerDirectory,
  );
  if (!allowed)
    return (
      <>
        <h1>Customers</h1>
        <Feedback message="Administrator access is required to view customers." />
      </>
    );
  return (
    <>
      <h1>Customers</h1>
      <p className="lead">Find a customer and review their account and activity.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const search = draft.search.trim();
          const valid =
            !search ||
            (draft.field === "id"
              ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                  search,
                )
              : draft.field === "phone"
                ? /^\+?[0-9 ()-]+$/.test(search) && search.replace(/\D/g, "").length >= 3
                : search.length >= 2);
          if (!valid) {
            setInvalid(
              "Enter a complete customer ID, at least 3 phone digits, or at least 2 name or email characters.",
            );
            return;
          }
          setInvalid("");
          setFilters({ ...draft, search });
          pagination.reset();
          records.refresh();
        }}
      >
        <div className={`catalogue-filters ${styles.filters}`}>
          <div className="field">
            <label htmlFor="customer-search">Search customers</label>
            <input
              id="customer-search"
              value={draft.search}
              maxLength={120}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              placeholder="Start of name, email or phone"
            />
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
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
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
        <div className="actions">
          <button className="button" type="submit">
            Search customers
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setDraft(initial);
              setFilters(initial);
              setInvalid("");
              pagination.reset();
              records.refresh();
            }}
          >
            Clear filters
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={records.loading}
            onClick={records.refresh}
          >
            Refresh
          </button>
        </div>
      </form>
      <Feedback message={invalid || records.error} />
      {records.loading ? (
        <DirectorySkeleton />
      ) : !records.error && records.data?.items.length === 0 ? (
        <div className="empty">
          <h2>
            {filters.search || filters.status || filters.verified
              ? "No matching customers"
              : "No customers yet"}
          </h2>
          <p>
            {filters.search || filters.status || filters.verified
              ? "Try a different search or clear the filters."
              : "Registered customers will appear here."}
          </p>
        </div>
      ) : !records.error && records.data ? (
        <div
          className={styles.table}
          tabIndex={0}
          role="region"
          aria-label="Customer results"
        >
          <table>
            <thead>
              <tr>
                {[
                  "Customer",
                  "Email",
                  "Phone",
                  "Status",
                  "Verification",
                  "Registered",
                  "Action",
                ].map((text) => (
                  <th scope="col" key={text}>
                    {text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.data.items.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className={styles.person}>
                      <span className={styles.avatar} aria-hidden="true">
                        {customer.firstName[0]}
                        {customer.lastName[0]}
                      </span>
                      <strong>
                        {customer.firstName} {customer.lastName}
                      </strong>
                    </div>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.status.toLowerCase()}</td>
                  <td>
                    {customer.emailVerified ? "Email verified" : "Email pending"}
                    <br />
                    {customer.phoneVerified ? "Phone verified" : "Phone pending"}
                  </td>
                  <td>{new Date(customer.createdAt).toLocaleDateString("en-NG")}</td>
                  <td>
                    <Link className="text-link" href={`/admin/customers/${customer.id}`}>
                      View
                      <span className="sr-only">
                        {" "}
                        {customer.firstName} {customer.lastName}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Customers"
      />
    </>
  );
}
export function DirectorySkeleton() {
  return (
    <div role="status" aria-label="Loading customers" className={styles.table}>
      <span className="sr-only">Loading customers…</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} aria-hidden="true" className={styles.skeleton} />
      ))}
    </div>
  );
}
