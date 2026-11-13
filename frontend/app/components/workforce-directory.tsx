"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import {
  parseWorkforceDirectory,
  workforceDirectoryQuerySchema,
  workforcePositionSchema,
} from "@/lib/api/workforce-directory-schemas";
import { workforceTemplateLabels } from "@/lib/api/workforce-schemas";
import { workforcePositionLabels as positionLabels } from "@/lib/api/workforce-positions";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkforceAccessPanel } from "./workforce-access-panel";
import { AdminBranchPicker } from "./admin-branch-picker";
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
          Back to People
        </Link>
        {z.uuid().safeParse(target).success ? (
          <WorkforceAccessPanel key={target} userId={target} personPage />
        ) : (
          <>
            <h1>Person</h1>
            <Feedback message="This account reference is invalid. Return to People and select a person." />
          </>
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
  return <DirectoryTable key={search.toString()} />;
}
function DirectoryTable() {
  const search = useSearchParams(),
    router = useRouter(),
    session = useAccountSession();
  const [branchId, setBranchId] = useState(search.get("branchId") ?? "");
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
  const applied = [...first].map(([key, value]) => ({
    key,
    label:
      key === "q"
        ? `Search: ${value}`
        : key === "role"
          ? `Account level: ${{ STAFF: "Staff", ADMIN: "Admin", SUPER_ADMIN: "Super Admin" }[value as "STAFF" | "ADMIN" | "SUPER_ADMIN"]}`
          : key === "position"
            ? `Job position: ${positionLabels[value as keyof typeof positionLabels]}`
            : key === "status"
              ? `Status: ${{ ACTIVE: "Active", SUSPENDED: "Suspended", DEACTIVATED: "Deactivated" }[value as "ACTIVE" | "SUSPENDED" | "DEACTIVATED"]}`
              : "Account branch",
  }));
  return (
    <section className="workforce-directory">
      <div className="wf-directory-heading">
        <div>
          <h1>People</h1>
          <p>
            Find a person and review their account level, job position, branch and
            permitted duties.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={records.refresh}
          disabled={records.loading || !parsed.success}
        >
          Refresh people
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
          if (branchId) next.set("branchId", branchId);
          router.push(href(next));
        }}
      >
        <div className="field wf-directory-search">
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
            <label htmlFor="wf-directory-role">Account level</label>
            <select
              id="wf-directory-role"
              name="role"
              defaultValue={search.get("role") ?? ""}
            >
              <option value="">All account levels</option>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="wf-directory-position">Job position</label>
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
          <div className="field wf-directory-branch">
            <label htmlFor="wf-directory-branch">Account branch</label>
            {session?.user.role === "SUPER_ADMIN" ? (
              <AdminBranchPicker
                id="wf-directory-branch"
                value={branchId}
                onChange={setBranchId}
                activeOnly={false}
              />
            ) : (
              <>
                <select
                  id="wf-directory-branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  disabled={!data?.managementBranches || !!error || records.loading}
                >
                  <option value="">All permitted branches</option>
                  {data?.managementBranches &&
                    !error &&
                    !records.loading &&
                    data.managementBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                        {!branch.isActive && " (inactive)"}
                      </option>
                    ))}
                  {branchId &&
                    !data?.managementBranches?.some(
                      (branch) => branch.id === branchId,
                    ) && <option value={branchId}>Selected branch unavailable</option>}
                </select>
                {!data?.managementBranches && !records.loading && (
                  <p>
                    Branch choices are unavailable. Refresh People to check your permitted
                    branches.
                  </p>
                )}
              </>
            )}
          </div>
          <button className="button" disabled={records.loading}>
            Search people
          </button>
          <Link className="button secondary" href={base}>
            Clear filters
          </Link>
        </div>
      </form>
      {parsed.success && applied.length > 0 && (
        <nav aria-label="Applied people filters" className="wf-directory-applied">
          <ul>
            {applied.map(({ key, label }) => {
              const next = new URLSearchParams(first);
              next.delete(key);
              return (
                <li key={key}>
                  <span>{label}</span>
                  <Link href={href(next)} aria-label={`Remove ${label} filter`}>
                    Remove
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
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
                <table role="table">
                  <caption className="sr-only">
                    Account roles, business positions and currently active responsibility
                    grants
                  </caption>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        Person
                      </th>
                      <th scope="col" role="columnheader">
                        Account level
                      </th>
                      <th scope="col" role="columnheader">
                        Job position
                      </th>
                      <th scope="col" role="columnheader">
                        Status
                      </th>
                      <th scope="col" role="columnheader">
                        Active duties you can manage
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {data.items.map((person) => (
                      <tr key={person.userId} role="row">
                        <th scope="row" role="rowheader">
                          <span>{person.name}</span>
                          {person.name !== person.email && (
                            <span className="wf-directory-secondary">{person.email}</span>
                          )}
                          {person.canInspect && (
                            <Link
                              className="text-link"
                              aria-label={`View person: ${person.name}`}
                              href={`${base}/${person.userId}${queryText ? `?${queryText}` : ""}`}
                            >
                              View person
                            </Link>
                          )}
                        </th>
                        <td role="cell">
                          <span className="wf-directory-label" aria-hidden="true">
                            Account level
                          </span>
                          {person.role === "SUPER_ADMIN"
                            ? "Super Admin"
                            : person.role === "ADMIN"
                              ? "Admin"
                              : "Staff"}
                        </td>
                        <td role="cell">
                          <span className="wf-directory-label" aria-hidden="true">
                            Job position
                          </span>
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
                        <td role="cell">
                          <span className="wf-directory-label" aria-hidden="true">
                            Status
                          </span>
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
                        <td role="cell">
                          <span className="wf-directory-label" aria-hidden="true">
                            Active duties you can manage
                          </span>
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
                                    {assignment.temporary && " · Temporary cover"}
                                    {assignment.expiresAt &&
                                      ` · Ends ${formatBusinessDate(assignment.expiresAt)}`}
                                  </span>
                                  {assignment.temporary && !assignment.expiresAt && (
                                    <span className="wf-directory-secondary">
                                      No end date recorded. Review this existing temporary
                                      cover.
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span>
                              {person.managed
                                ? "No active grants in your management scope"
                                : "Earlier access setup; review before enrollment"}
                            </span>
                          )}
                          {person.responsibilitiesMore && (
                            <p className="wf-directory-secondary">
                              More active responsibilities are available in the account
                              review.
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {first.size
                  ? "No people match these filters within your permitted scope."
                  : "No people are available within your current management scope."}
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
