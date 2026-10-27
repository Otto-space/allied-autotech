"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  workforceDestinationAllowed,
  workforceDestinations,
} from "@/lib/workforce-registry";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Info,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkforceOverview,
  workforceTemplateLabels,
  type WorkforceAccess,
} from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { formatBusinessDate } from "@/lib/format/date";
import "./workforce-overview.css";

const queues = [
  { key: "jobs", title: "Workshop jobs", detail: "All jobs in your scope", icon: Wrench },
  {
    key: "bookings",
    title: "Bookings",
    detail: "All bookings in your scope",
    icon: CalendarDays,
  },
  {
    key: "enquiries",
    title: "Enquiries",
    detail: "Unresolved enquiries",
    icon: MessageSquare,
  },
  { key: "complaints", title: "Complaints", detail: "Unresolved complaints", icon: Info },
  {
    key: "orders",
    title: "Order progress",
    detail: "All orders in your scope",
    icon: ClipboardList,
  },
] as const;

export function WorkforceOverview({
  access,
  refreshAccess,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const search = useSearchParams();
  const record = useResource("/staff/workforce/overview", parseWorkforceOverview);
  const mismatch = !!record.data && !sameWorkforceScope(access, record.data.access);
  const unavailable =
    record.loading ||
    record.refreshing ||
    !!record.error ||
    !!record.refreshError ||
    mismatch;
  const data = !unavailable ? record.data : undefined;
  const active = data?.access;
  const independentDestinations = active
    ? workforceDestinations.filter(
        (entry) =>
          entry.predicate.scope === "independent" &&
          workforceDestinationAllowed(active, entry.id),
      )
    : [];
  const branches = new Map(data?.branches.map((branch) => [branch.id, branch.name]));
  function refresh() {
    refreshAccess();
    record.refresh();
  }
  const position =
    active?.position === "CEO_MD"
      ? "Chief Executive / Managing Director"
      : active?.position
        ? (workforceTemplateLabels[
            active.position as keyof typeof workforceTemplateLabels
          ] ?? "Team member")
        : "Team member";
  const working = record.loading || record.refreshing;
  const failure = record.error || record.refreshError;
  return (
    <div className="workforce-overview">
      <nav className="wfo-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <span aria-current="page">Overview</span>
          </li>
        </ol>
      </nav>
      <header className="wfo-heading">
        <div>
          <h1>Operational overview</h1>
          <p>Current work across your active responsibilities.</p>
        </div>
        <div className="wfo-refresh">
          <button className="button secondary" onClick={refresh} disabled={working}>
            <RefreshCw size={17} aria-hidden="true" />
            {working ? "Refreshing overview…" : "Refresh overview"}
          </button>
          {data && (
            <p>
              Updated{" "}
              <time dateTime={data.generatedAt}>
                {formatBusinessDate(data.generatedAt)}
              </time>
            </p>
          )}
        </div>
      </header>
      {search.get("workAccess") === "updated" && (
        <p className="notice" role="status">
          Your current responsibilities do not permit that page. You can continue with the
          tools available here.
        </p>
      )}
      {failure && (
        <div className="wfo-feedback" role="alert">
          <strong>
            {record.denied
              ? "Overview access unavailable"
              : "Overview could not be refreshed"}
          </strong>
          <p>
            {record.denied
              ? "Your current account cannot open this overview. Check your access before continuing."
              : "Refresh overview to check your current work. Previous counts are hidden until the check succeeds."}
          </p>
        </div>
      )}
      {mismatch && !failure && (
        <div className="wfo-feedback" role="alert">
          <strong>Your responsibilities changed</strong>
          <p>Refresh overview to check your current access and work together.</p>
        </div>
      )}
      <div className="wfo-main">
        <section
          className="wfo-panel wfo-work"
          aria-labelledby="wfo-work-title"
          aria-busy={working}
        >
          <header>
            <h2 id="wfo-work-title">Your work</h2>
            <p>Counts reflect the records your current responsibilities allow.</p>
          </header>
          {working ? (
            <div className="wfo-loading" role="status">
              Checking permitted queues…
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </div>
          ) : data ? (
            <>
              <ul className="wfo-queues">
                {queues.map(
                  ({ key, title, detail, icon: Icon }) =>
                    data.counts[key] !== undefined &&
                    workforceDestinationAllowed(data.access, key) && (
                      <li key={key}>
                        <Link
                          prefetch={false}
                          href={
                            workforceDestinations.find((entry) => entry.id === key)!.href
                          }
                        >
                          <Icon size={22} aria-hidden="true" />
                          <span className="wfo-queue-copy">
                            <strong>{title}</strong>
                            <span>{detail}</span>
                          </span>
                          <span
                            className="wfo-count"
                            aria-label={`${data.counts[key]} records`}
                          >
                            {data.counts[key]!.toLocaleString("en-NG")}
                          </span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      </li>
                    ),
                )}
                {active && workforceDestinationAllowed(active, "finance") && (
                  <li>
                    <Link prefetch={false} href="/admin/workforce/finance">
                      <CreditCard size={22} aria-hidden="true" />
                      <span className="wfo-queue-copy">
                        <strong>Payment records</strong>
                        <span>Payments in your permitted branches</span>
                      </span>
                      <span className="wfo-open">View records</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                )}
              </ul>
              {!Object.keys(data.counts).length &&
                !independentDestinations.length &&
                !(active && workforceDestinationAllowed(active, "finance")) && (
                  <div className="wfo-empty">
                    <h3>No work queues available</h3>
                    <p>
                      Ask an authorized access operator to review your responsibilities.
                      Your personal account tools remain available.
                    </p>
                  </div>
                )}
            </>
          ) : (
            !working && (
              <p className="wfo-unavailable">
                Current work is unavailable until access and overview are verified.
              </p>
            )
          )}
          {independentDestinations.length > 0 && (
            <nav className="wfo-independent" aria-label="Separately granted work">
              <h2>Separately granted work</h2>
              <p>
                These duties use explicit owner grants and their existing record and
                approval rules.
              </p>
              <ul>
                {independentDestinations.map((entry) => (
                  <li key={entry.id}>
                    <Link className="text-link" href={entry.href} prefetch={false}>
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
        <aside className="wfo-side" aria-label="Your account access">
          <section className="wfo-access" aria-labelledby="wfo-access-title">
            <h2 id="wfo-access-title">Your access</h2>
            {active ? (
              <>
                <ul>
                  <li>
                    <UserRound size={20} aria-hidden="true" />
                    <span>{position}</span>
                  </li>
                  {active.department && (
                    <li>
                      <Users size={20} aria-hidden="true" />
                      <span>{active.department}</span>
                    </li>
                  )}
                  <li>
                    <ClipboardList size={20} aria-hidden="true" />
                    <span>
                      {active.assignments.length} active{" "}
                      {active.assignments.length === 1
                        ? "responsibility"
                        : "responsibilities"}
                    </span>
                  </li>
                  <li>
                    <Building2 size={20} aria-hidden="true" />
                    <span>
                      {data!.branches.length} active{" "}
                      {data!.branches.length === 1 ? "branch" : "branches"}
                    </span>
                  </li>
                </ul>
                <p>Access follows your current assignments.</p>
              </>
            ) : (
              <p>
                {working
                  ? "Checking current responsibilities…"
                  : "Refresh overview to verify your responsibilities."}
              </p>
            )}
          </section>
          <nav className="wfo-personal wfo-panel" aria-label="Personal account tools">
            <Link href="/admin/notifications" prefetch={false}>
              <Bell size={20} aria-hidden="true" />
              <span>My notifications</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/admin/security" prefetch={false}>
              <ShieldCheck size={20} aria-hidden="true" />
              <span>My account security</span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            {active && workforceDestinationAllowed(active, "access") && (
              <Link href="/admin/workforce/access" prefetch={false}>
                <Users size={20} aria-hidden="true" />
                <span>Responsibility assignments</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
          </nav>
        </aside>
      </div>
      {active && (
        <section
          className="wfo-panel wfo-responsibilities"
          aria-labelledby="wfo-responsibilities-title"
        >
          <header>
            <h2 id="wfo-responsibilities-title">Active responsibilities</h2>
            <p>Branch, coverage and review dates for your current assignments.</p>
          </header>
          {active.assignments.length ? (
            <table>
              <caption className="sr-only">Current responsibility assignments</caption>
              <thead>
                <tr>
                  <th scope="col">Responsibility</th>
                  <th scope="col">Branch and scope</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Dates and reason</th>
                </tr>
              </thead>
              <tbody>
                {active.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <th scope="row">{workforceTemplateLabels[assignment.template]}</th>
                    <td data-label="Branch and scope">
                      <span>{branches.get(assignment.branchId)}</span>
                      <small>
                        {assignment.scope === "ASSIGNED"
                          ? "Assigned records only"
                          : "Branch records"}
                      </small>
                    </td>
                    <td data-label="Coverage">
                      <span
                        className={`wfo-coverage${assignment.temporary ? " is-temporary" : ""}`}
                      >
                        {assignment.temporary
                          ? "Temporary cover"
                          : "Primary responsibility"}
                      </span>
                    </td>
                    <td data-label="Dates and reason">
                      <span>
                        Starts{" "}
                        <time dateTime={assignment.startsAt}>
                          {formatBusinessDate(assignment.startsAt)}
                        </time>
                      </span>
                      <span>
                        {assignment.expiresAt ? (
                          <>
                            Until{" "}
                            <time dateTime={assignment.expiresAt}>
                              {formatBusinessDate(assignment.expiresAt)}
                            </time>
                          </>
                        ) : (
                          "No scheduled end"
                        )}
                      </span>
                      <p>{assignment.reason}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="wfo-empty">
              <h3>No active responsibilities</h3>
              <p>Ask an authorized access operator to review your assignments.</p>
            </div>
          )}
          <p className="wfo-authority">
            <Info size={18} aria-hidden="true" />
            <span>
              Financial approvals and collection release require separate approved
              authority.
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
