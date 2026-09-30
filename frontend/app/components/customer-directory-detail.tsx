"use client";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import {
  parseCustomerDetail,
  parseCustomerRelated,
} from "@/lib/api/customer-directory-schemas";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { DirectorySkeleton } from "./customer-directory";
import styles from "./customer-directory.module.css";

const collections = [
  "vehicles",
  "bookings",
  "quotations",
  "orders",
  "payments",
  "enquiries",
  "complaints",
] as const;
export function CustomerDirectoryDetail({ customerId }: { customerId: string }) {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [collection, setCollection] = useState<(typeof collections)[number]>("vehicles");
  const pagination = useCursorPage();
  const root = `/admin/customers/${encodeURIComponent(customerId)}`;
  const detail = useResource(allowed ? root : null, parseCustomerDetail);
  const query = new URLSearchParams({ limit: "25" });
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(
    allowed && detail.data && !detail.error ? `${root}/${collection}?${query}` : null,
    parseCustomerRelated,
  );
  if (!allowed)
    return (
      <>
        <h1>Customer details</h1>
        <Feedback message="Administrator access is required to view customers." />
      </>
    );
  const customer = detail.data;
  return (
    <>
      <Link className="text-link" href="/admin/customers">
        Back to customers
      </Link>
      <h1>
        {customer ? `${customer.firstName} ${customer.lastName}` : "Customer details"}
      </h1>
      <Feedback message={detail.error} />
      <button
        className="button secondary"
        onClick={() => {
          detail.refresh();
          records.refresh();
        }}
        disabled={detail.loading}
      >
        Refresh customer
      </button>
      {detail.loading ? (
        <DirectorySkeleton />
      ) : customer && !detail.error ? (
        <>
          <dl className={styles.summary}>
            {[
              ["Customer ID", customer.id],
              ["Email", customer.email],
              ["Phone", customer.phone],
              ["Account status", customer.status.toLowerCase()],
              [
                "Email verification",
                customer.emailVerified ? "Verified" : "Not verified",
              ],
              [
                "Phone verification",
                customer.phoneVerified ? "Verified" : "Not verified",
              ],
              ["Registered", new Date(customer.createdAt).toLocaleDateString("en-NG")],
              [
                "Address",
                [customer.address, customer.city, customer.state, customer.country]
                  .filter(Boolean)
                  .join(", "),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Not provided"}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.tabs} role="group" aria-label="Customer activity">
            {collections.map((name) => (
              <button
                type="button"
                className="button secondary"
                aria-pressed={name === collection}
                key={name}
                onClick={() => {
                  setCollection(name);
                  pagination.reset();
                }}
              >
                {name === "vehicles" ? "Garage" : name[0].toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
          <Feedback message={records.error} />
          {records.error && (
            <button className="button secondary" onClick={records.refresh}>
              Retry activity
            </button>
          )}
          {records.loading ? (
            <DirectorySkeleton />
          ) : !records.error && records.data?.items.length === 0 ? (
            <div className="empty">
              <h2>No {collection} yet</h2>
              <p>Customer records will appear here when available.</p>
            </div>
          ) : !records.error && records.data ? (
            <div
              className={styles.table}
              tabIndex={0}
              role="region"
              aria-label="Customer activity records"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {records.data.items.map((record) => (
                    <tr key={record.id}>
                      <td>{record.title}</td>
                      <td>{record.status?.replaceAll("_", " ") ?? "—"}</td>
                      <td>{new Date(record.createdAt).toLocaleDateString("en-NG")}</td>
                      <td>
                        {record.amountKobo === null
                          ? "—"
                          : `${record.currency} ${(Number(record.amountKobo) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}
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
            label="Customer activity"
          />
        </>
      ) : null}
    </>
  );
}
