"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkforceDirectory,
  workforceDirectoryQuerySchema,
  workforcePositionSchema,
} from "@/lib/api/workforce-directory-schemas";
import { workforceTemplateLabels } from "@/lib/api/workforce-schemas";
import { workforcePositionLabels as positionLabels } from "@/lib/api/workforce-positions";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkforceAccessPanel } from "./workforce-access-panel";
import "./workforce-directory.css";

const base = "/admin/workforce/access";
export function WorkforceDirectory() {
  return (
    <Suspense fallback={<p role="status">Loading workforce directory…</p>}>
      <Directory />
    </Suspense>
  );
}
function Directory() {
  const pathname = usePathname(),
    search = useSearchParams(),
    session = useAccountSession();
  const target = /^\/admin\/workforce\/access\/([^/]+)$/.exec(pathname)?.[1];
  const back = search.size ? `${base}?${search.toString()}` : base;
  if (target)
    return (
      <section className="workforce-directory">
        <Link className="text-link" href={back}>
          Back to workforce directory
        </Link>
        <h1>Manage workforce &amp; responsibilities</h1>
        <p>
          Account role, business position and responsibility assignments are separate. A
          position does not grant access.
        </p>
        {z.uuid().safeParse(target).success ? (
          <WorkforceAccessPanel key={target} userId={target} />
        ) : (
          <Feedback message="This account reference is invalid. Return to the directory and select a person." />
        )}
        {session?.user.role === "SUPER_ADMIN" && z.uuid().safeParse(target).success && (
          <p>
            <Link href={`/admin/staff/${target}`}>
              Open account status and role controls
            </Link>
          </p>
        )}
      </section>
    );
  return <DirectoryTable />;
}
function DirectoryTable() {
  const search = useSearchParams(),
    router = useRouter(),
    session = useAccountSession();
  const parsed = workforceDirectoryQuerySchema.safeParse(
    Object.fromEntries(
      ["q", "role", "status", "position", "branchId", "cursor"].flatMap((key) =>
        search.get(key) ? [[key, search.get(key)!]] : [],
      ),
    ),
  );
  const query = new URLSearchParams(parsed.success ? Object.entries(parsed.data) : []);
  const queryText = query.toString();
  const records = useResource(
    parsed.success
      ? `/admin/workforce/accounts${queryText ? `?${queryText}` : ""}`
      : null,
    parseWorkforceDirectory,
  );
  const data = records.data,
    error = records.error || records.refreshError;
  const first = new URLSearchParams(query);
  first.delete("cursor");
  const href = (params: URLSearchParams) => (params.size ? `${base}?${params}` : base);
  return (
    <section className="workforce-directory">
      <div className="wf-directory-heading">
        <div>
          <h1>Manage workforce &amp; responsibilities</h1>
          <p>
            Find a person, review their account tier and manage their permitted
            responsibilities.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={records.refresh}
          disabled={records.loading || !parsed.success}
        >
          Refresh workforce
        </button>
      </div>
      <form
        className="wf-directory-filters"
        key={queryText}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget),
            next = new URLSearchParams();
          for (const key of ["q", "role", "status", "position"]) {
            const value = String(form.get(key) ?? "").trim();
            if (value) next.set(key, value);
          }
          router.push(href(next));
        }}
      >
        <div className="field">
          <label htmlFor="wf-directory-q">Find a person</label>
          <input
            id="wf-directory-q"
            name="q"
            type="search"
            maxLength={120}
            defaultValue={search.get("q") ?? ""}
            placeholder="Name or work email"
          />
        </div>
        {session?.user.role === "SUPER_ADMIN" && (
          <div className="field">
            <label htmlFor="wf-directory-role">Account role</label>
            <select
              id="wf-directory-role"
              name="role"
              defaultValue={search.get("role") ?? ""}
            >
              <option value="">All account roles</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="wf-directory-position">Business position</label>
          <select
            id="wf-directory-position"
            name="position"
            defaultValue={search.get("position") ?? ""}
          >
            <option value="">All recorded positions</option>
            {workforcePositionSchema.options.map((position) => (
              <option key={position} value={position}>
                {positionLabels[position]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wf-directory-status">Account status</label>
          <select
            id="wf-directory-status"
            name="status"
            defaultValue={search.get("status") ?? ""}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
        <div className="wf-directory-actions">
          <button className="button" disabled={records.loading}>
            Search workforce
          </button>
          <Link className="button secondary" href={base}>
            Clear filters
          </Link>
        </div>
      </form>
      <p>
        Only accounts within your current management scope are shown. Responsibility
        summaries include the grants you are permitted to manage.
      </p>
      {!parsed.success && (
        <Feedback message="A directory filter is invalid. Clear filters to return to the permitted account list." />
      )}
      <Feedback message={error} />
      {records.loading ? (
        <p role="status">Checking permitted workforce accounts…</p>
      ) : (
        parsed.success &&
        data &&
        !error && (
          <>
            <p role="status">
              {data.items.length} {data.items.length === 1 ? "account" : "accounts"} on
              this page
            </p>
            {data.items.length ? (
              <div
                className="wf-directory-table-region"
                role="region"
                aria-label="Workforce accounts"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Account roles, business positions and currently active responsibility
                    grants
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Account role</th>
                      <th scope="col">Business position</th>
                      <th scope="col">Status</th>
                      <th scope="col">Responsibilities you can manage</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((person) => (
                      <tr key={person.userId}>
                        <th scope="row">
                          <span>{person.name}</span>
                          <span className="wf-directory-secondary">{person.email}</span>
                        </th>
                        <td>
                          {person.role === "SUPER_ADMIN"
                            ? "Super Admin"
                            : person.role === "ADMIN"
                              ? "Admin"
                              : "Staff"}
                        </td>
                        <td>
                          {person.position
                            ? positionLabels[person.position]
                            : person.managed
                              ? "Position needs review"
                              : "Not enrolled"}
                          {person.accountBranch && (
                            <span className="wf-directory-secondary">
                              Account branch: {person.accountBranch.name}
                              {!person.accountBranch.isActive && " (inactive)"}
                            </span>
                          )}
                        </td>
                        <td>
                          {person.status === "ACTIVE"
                            ? "Active"
                            : person.status === "SUSPENDED"
                              ? "Suspended"
                              : "Deactivated"}
                          {!person.verified && (
                            <span className="wf-directory-secondary">
                              Email not verified
                            </span>
                          )}
                        </td>
                        <td>
                          {person.responsibilities.length ? (
                            <ul>
                              {person.responsibilities.map((assignment) => (
                                <li key={assignment.assignmentId}>
                                  {workforceTemplateLabels[assignment.template]}
                                  <span className="wf-directory-secondary">
                                    {assignment.branch.name} ·{" "}
                                    {assignment.scope === "ASSIGNED"
                                      ? "Assigned records"
                                      : "Branch records"}
                                    {assignment.temporary && " · Temporary coverage"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span>
                              {person.managed
                                ? "No active grants in your management scope"
                                : "Legacy access; review before enrollment"}
                            </span>
                          )}
                          {person.responsibilitiesMore && (
                            <p className="wf-directory-secondary">
                              More active responsibilities are available in the account
                              review.
                            </p>
                          )}
                        </td>
                        <td>
                          {person.canInspect && (
                            <Link
                              className="text-link"
                              aria-label={`View/manage ${person.name}`}
                              href={`${base}/${person.userId}${queryText ? `?${queryText}` : ""}`}
                            >
                              View/manage
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                No workforce accounts match these filters within your permitted scope.
              </p>
            )}
            <nav className="wf-directory-actions" aria-label="Workforce result pages">
              {query.has("cursor") && (
                <Link className="button secondary" href={href(first)}>
                  First page
                </Link>
              )}
              {data.nextCursor && (
                <Link
                  className="button secondary"
                  href={href(
                    new URLSearchParams([...first, ["cursor", data.nextCursor]]),
                  )}
                >
                  Next page
                </Link>
              )}
            </nav>
          </>
        )
      )}
    </section>
  );
}
