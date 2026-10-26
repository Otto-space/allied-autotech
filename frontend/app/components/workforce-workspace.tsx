"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkforceAssignees,
  parseWorkforceQueue,
  type WorkforceAccess,
} from "@/lib/api/workforce-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { WorkforceDirectory } from "./workforce-directory";
import { WorkforceOverview } from "./workforce-overview";
import { WorkforceBookingDetail } from "./workforce-booking-detail";
import { WorkforceBookings } from "./workforce-bookings";
import { WorkforceEnquiries } from "./workforce-enquiries";
import { WorkforceComplaints } from "./workforce-complaints";
import { WorkforceFinance } from "./workforce-finance";
import { WorkforceOrders } from "./workforce-orders";
import { WorkforceJobs } from "./workforce-jobs";
import { WorkPartsFitment } from "./work-parts-fitment";
import { WorkforceJobDetail } from "./workforce-job-detail";
import { canUseWorkforceFitment } from "@/lib/workforce-access";

export function WorkforceWorkspace({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const path = usePathname();
  if (path === "/admin/fitment" && canUseWorkforceFitment(access))
    return <WorkPartsFitment />;
  if (path === "/admin" || path === "/admin/workforce")
    return <WorkforceOverview access={access} refreshAccess={refreshAccess} />;
  if (
    (path === "/admin/workforce/access" ||
      /^\/admin\/workforce\/access\/[^/]+$/.test(path)) &&
    access.canManageAssignments
  )
    return <WorkforceAccessLookup canInvite={access.canInviteAdmins} />;
  const bookingId = /^\/admin\/workforce\/bookings\/([0-9a-f-]+)$/.exec(path)?.[1];
  if (bookingId && access.permissions.includes("BOOKINGS_READ"))
    return (
      <WorkforceBookingDetail
        key={`${access.userId}:${bookingId}`}
        id={bookingId}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  const id = /^\/admin\/workforce\/jobs\/([0-9a-f-]+)$/.exec(path)?.[1];
  if (id && access.permissions.includes("JOBS_READ"))
    return (
      <WorkforceJobDetail
        key={`${access.userId}:${id}`}
        id={id}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  if (path === "/admin/workforce/jobs" && access.permissions.includes("JOBS_READ"))
    return <WorkforceJobs access={access} refreshAccess={refreshAccess} />;
  if (
    path === "/admin/workforce/bookings" &&
    access.permissions.includes("BOOKINGS_READ")
  )
    return <WorkforceBookings access={access} refreshAccess={refreshAccess} />;
  if (path === "/admin/workforce/finance" && access.permissions.includes("FINANCE_READ"))
    return (
      <WorkforceFinance
        key={access.userId}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  const queue = path.split("/")[3];
  if (path === "/admin/workforce/orders" && access.permissions.includes("ORDERS_READ"))
    return (
      <WorkforceOrders
        key={access.userId}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  if (
    path === "/admin/workforce/enquiries" &&
    (access.permissions.includes("CUSTOMER_ENQUIRIES") ||
      access.permissions.includes("SALES_ENQUIRIES"))
  )
    return (
      <WorkforceEnquiries
        key={access.userId}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  if (path === "/admin/workforce/complaints" && access.permissions.includes("COMPLAINTS"))
    return (
      <WorkforceComplaints
        key={access.userId}
        access={access}
        refreshAccess={refreshAccess}
      />
    );
  const allowed =
    path === `/admin/workforce/${queue}` &&
    (
      {
        bookings: access.permissions.includes("BOOKINGS_READ"),
        enquiries:
          access.permissions.includes("CUSTOMER_ENQUIRIES") ||
          access.permissions.includes("SALES_ENQUIRIES"),
        complaints: access.permissions.includes("COMPLAINTS"),
        orders: access.permissions.includes("ORDERS_READ"),
        finance: access.permissions.includes("FINANCE_READ"),
      } as Record<string, boolean>
    )[queue ?? ""];
  return allowed && queue ? (
    <WorkforceQueue key={queue} queue={queue} access={access} />
  ) : (
    <>
      <h1>Access unavailable</h1>
      <p>Your current responsibilities do not permit this page.</p>
      <Link className="button secondary" href="/admin">
        Return to overview
      </Link>
    </>
  );
}
function WorkforceQueue({ queue, access }: { queue: string; access: WorkforceAccess }) {
  const [cursor, setCursor] = useState<string>();
  const record = useResource(
    `/staff/workforce/${queue}${cursor ? `?cursor=${cursor}` : ""}`,
    parseWorkforceQueue,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const title = (
    {
      bookings: "Bookings",
      enquiries: "Enquiries",
      complaints: "Complaints",
      orders: "Order progress",
      finance: "Payment records",
    } as Record<string, string>
  )[queue];
  return (
    <>
      <h1>{title}</h1>
      <p>Records within your active responsibility scopes.</p>
      <Feedback message={record.error} />
      {uncertain && (
        <Feedback
          message="The change could not be confirmed. Refresh and review before making another change."
          tone="warning"
        />
      )}
      <button
        className="button secondary"
        onClick={() => {
          setUncertain(false);
          record.refresh();
        }}
      >
        Refresh records
      </button>
      {record.loading ? (
        <p role="status">Checking permitted records…</p>
      ) : (
        record.data && (
          <>
            <ul className="support-record-list">
              {record.data.items.map((row) => (
                <li className="card" key={row.id}>
                  <h2>
                    {row.subject ??
                      row.orderNumber ??
                      row.paymentNumber ??
                      row.service?.name}
                  </h2>
                  <p>
                    {row.status.replaceAll("_", " ")}
                    {row.scheduledAt ? ` · ${formatBusinessDate(row.scheduledAt)}` : ""}
                  </p>
                  {row.customer && (
                    <p>
                      {row.customer.firstName} {row.customer.lastName} ·{" "}
                      {row.customer.phone}
                    </p>
                  )}
                  {(row.message ?? row.description) && (
                    <p>{row.message ?? row.description}</p>
                  )}
                  {row.amountKobo !== undefined && (
                    <p>
                      {row.currency}{" "}
                      {(Number(row.amountKobo) / 100).toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  )}
                  {row.items?.map((item, i) => (
                    <p key={i}>
                      {item.productName} × {item.quantity}
                    </p>
                  ))}
                  {["enquiries", "complaints"].includes(queue) &&
                    !["RESOLVED", "CLOSED"].includes(row.status) && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const body = String(
                            new FormData(event.currentTarget).get("reply"),
                          );
                          setProposal({
                            title: "Record this customer reply?",
                            description:
                              "This reply is visible in the customer’s existing enquiry thread.",
                            facts: [{ label: "Enquiry", value: row.subject ?? row.id }],
                            submit: async () => {
                              await apiRequest(
                                `/staff/workforce/${queue}/${row.id}/replies`,
                                {
                                  method: "POST",
                                  csrf: true,
                                  body: { expectedVersion: row.version, body },
                                },
                              );
                            },
                            onUncertain: () => setUncertain(true),
                          });
                        }}
                      >
                        <div className="field">
                          <label htmlFor={`reply-${row.id}`}>Customer reply</label>
                          <textarea
                            id={`reply-${row.id}`}
                            name="reply"
                            required
                            maxLength={5000}
                          />
                        </div>
                        <button
                          className="button secondary"
                          disabled={!!proposal || uncertain}
                        >
                          Review reply
                        </button>
                      </form>
                    )}
                  {queue === "enquiries" &&
                    access.permissions.includes("ENQUIRIES_ASSIGN") &&
                    !["RESOLVED", "CLOSED"].includes(row.status) && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          setProposal({
                            title: "Reassign this sales enquiry?",
                            description:
                              "Hiring or revoking temporary cover does not move records automatically. This explicitly assigns the enquiry to a verified account with sales access in this branch.",
                            facts: [{ label: "Enquiry", value: row.subject ?? row.id }],
                            submit: async () => {
                              await apiRequest(
                                `/staff/workforce/enquiries/${row.id}/assignment`,
                                {
                                  method: "PATCH",
                                  csrf: true,
                                  body: {
                                    expectedVersion: row.version,
                                    staffId: String(form.get("staffId")),
                                    reason: String(form.get("reason")),
                                  },
                                },
                              );
                            },
                            onUncertain: () => setUncertain(true),
                          });
                        }}
                      >
                        <WorkforceAssigneeSelect
                          kind="enquiries"
                          id={row.id}
                          label="New enquiry assignee"
                        />
                        <div className="field">
                          <label htmlFor={`sales-reason-${row.id}`}>
                            Reassignment reason
                          </label>
                          <textarea
                            id={`sales-reason-${row.id}`}
                            name="reason"
                            minLength={10}
                            maxLength={1000}
                            required
                          />
                        </div>
                        <button
                          className="button secondary"
                          disabled={!!proposal || uncertain}
                        >
                          Review enquiry reassignment
                        </button>
                      </form>
                    )}
                  {queue === "orders" &&
                    access.permissions.includes("ORDERS_PREPARE") &&
                    ["CONFIRMED", "PROCESSING"].includes(row.status) && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const reason = String(
                              new FormData(event.currentTarget).get("reason"),
                            ),
                            status = row.status === "CONFIRMED" ? "PROCESSING" : "READY";
                          setProposal({
                            title: `Move this order to ${status.toLowerCase()}?`,
                            description:
                              "Only a paid collection order can advance. Customer release requires separate authority.",
                            facts: [{ label: "Order", value: row.orderNumber ?? row.id }],
                            submit: async () => {
                              await apiRequest(`/staff/workforce/orders/${row.id}`, {
                                method: "PATCH",
                                csrf: true,
                                body: { expectedVersion: row.version, status, reason },
                              });
                            },
                            onUncertain: () => setUncertain(true),
                          });
                        }}
                      >
                        <div className="field">
                          <label htmlFor={`prepare-${row.id}`}>Preparation note</label>
                          <textarea
                            id={`prepare-${row.id}`}
                            name="reason"
                            required
                            minLength={10}
                            maxLength={1000}
                          />
                        </div>
                        <button
                          className="button secondary"
                          disabled={!!proposal || uncertain}
                        >
                          Review preparation update
                        </button>
                      </form>
                    )}
                </li>
              ))}
            </ul>
            {!record.data.items.length && <p>No records in your current scope.</p>}
            {record.data.nextCursor && (
              <button
                className="button secondary"
                onClick={() => setCursor(record.data!.nextCursor)}
              >
                Next records
              </button>
            )}
            {cursor && (
              <button className="button secondary" onClick={() => setCursor(undefined)}>
                First page
              </button>
            )}
          </>
        )
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={record.refresh}
        />
      )}
    </>
  );
}
function WorkforceAccessLookup({ canInvite }: { canInvite: boolean }) {
  return (
    <>
      <WorkforceDirectory />
      {canInvite && <WorkforceAdminInvitation />}
    </>
  );
}

function WorkforceAdminInvitation() {
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  return (
    <section className="detail-section">
      <h2>Invite enrolled staff to become an admin</h2>
      <p>
        The recipient must accept the existing secure invitation. Their operational
        responsibilities remain scoped; this invitation grants no finance or
        access-management duties.
      </p>
      <Feedback message={message} tone="success" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const email = String(form.get("email")),
            currentPassword = String(form.get("currentPassword"));
          setProposal({
            title: "Send this admin invitation?",
            description:
              "The server checks the current owner-approved invitation envelope and the recipient’s verified account and branch.",
            facts: [{ label: "Recipient", value: email }],
            submit: async () => {
              await apiRequest("/admin/workforce/invitations", {
                method: "POST",
                csrf: true,
                body: { email, role: "ADMIN", currentPassword },
              });
            },
          });
        }}
      >
        <div className="field">
          <label htmlFor="workforce-invitation-email">Verified staff email</label>
          <input
            id="workforce-invitation-email"
            name="email"
            type="email"
            required
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="workforce-invitation-password">Your current password</label>
          <input
            id="workforce-invitation-password"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="button secondary" disabled={!!proposal}>
          Review invitation
        </button>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() =>
            setMessage("Invitation queued for the recipient’s explicit acceptance.")
          }
        />
      )}
    </section>
  );
}

export function useWorkforceRefresh(refresh: () => void, access?: WorkforceAccess) {
  useEffect(() => {
    if (!access) return;
    const expiry = Math.min(
      ...access.assignments.flatMap((a) =>
        a.expiresAt ? [Date.parse(a.expiresAt)] : [],
      ),
    );
    const interval = window.setInterval(refresh, 30_000);
    const timeout = Number.isFinite(expiry)
      ? window.setTimeout(
          refresh,
          Math.max(0, Math.min(2_147_483_647, expiry - Date.now() + 50)),
        )
      : undefined;
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [refresh, access]);
}

function WorkforceAssigneeSelect({
  kind,
  id,
  label,
}: {
  kind: "jobs" | "enquiries";
  id: string;
  label: string;
}) {
  const choices = useResource(
    `/staff/workforce/${kind}/${id}/assignees`,
    parseWorkforceAssignees,
  );
  return (
    <div className="field">
      <label htmlFor={`assignee-${id}`}>{label}</label>
      <select
        id={`assignee-${id}`}
        name="staffId"
        required
        defaultValue=""
        disabled={choices.loading || !!choices.error}
      >
        <option value="">
          {choices.loading ? "Checking eligible staff?" : "Select authorized staff"}
        </option>
        {choices.data?.items.map((person) => (
          <option key={person.id} value={person.id}>
            {person.firstName} {person.lastName}
          </option>
        ))}
      </select>
      <Feedback message={choices.error} />
      {choices.data && !choices.data.items.length && (
        <p>
          No eligible staff in this branch. Ask an authorized operator to review
          responsibility assignments.
        </p>
      )}
    </div>
  );
}
