"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  privilegedRoles,
  staffStatuses,
  type StaffMember,
} from "@/lib/api/staff-admin-schemas";
import {
  directoryName,
  parseStaffDirectory,
  staffDirectoryQuery,
  staffDirectoryPageParams,
  staffLabels,
} from "@/lib/admin/work-staff-directory";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
const root = "/admin/staff";
export function StaffDirectory() {
  const session = useAccountSession();
  if (!session) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <DirectoryAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-staff-directory">
      <h1>Staff directory</h1>
      <Feedback message="Administrator access is required to view these records." />
    </div>
  );
}
function DirectoryAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    [denied, setDenied] = useState(false),
    p = access.data;
  const error =
    access.error ||
    access.refreshError ||
    (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      ? "Current staff-directory access could not be confirmed."
      : undefined);
  const deny = useCallback(() => setDenied(true), []);
  if (!p || error || denied)
    return (
      <div className="work-staff-directory">
        <h1>Staff directory</h1>
        {error || denied ? (
          <Feedback
            message={
              error ??
              "Staff directory access is unavailable. Protected records have been cleared."
            }
          />
        ) : (
          <p role="status">Checking staff directory access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={() => {
            setDenied(false);
            access.refresh();
          }}
        >
          Refresh staff access
        </button>
      </div>
    );
  return (
    <DirectoryWorkspace owner={owner} onDenied={deny} refreshAccess={access.refresh} />
  );
}
function useDirectoryPage(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseStaffDirectory(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function DirectoryWorkspace({
  owner,
  onDenied,
  refreshAccess,
}: {
  owner: string;
  onDenied: () => void;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = staffDirectoryQuery(new URLSearchParams(search.toString())),
    params = query.params;
  const [searchRevision, setSearchRevision] = useState(0);
  const records = useDirectoryPage(query.path),
    data = records.data,
    error = records.error || records.refreshError,
    busy = records.loading || records.refreshing;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  useEffect(() => {
    if (records.denied) onDenied();
  }, [records.denied, onDenied]);
  function navigate(next: URLSearchParams) {
    router.push(`${root}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(filters);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }
  function clearFilters() {
    setSearchRevision((v) => v + 1);
    navigate(new URLSearchParams());
  }
  return (
    <div className="work-staff-directory">
      <header className="wsd-heading">
        <div>
          <h1>Staff directory</h1>
          <p>Find staff and administrator accounts across branches.</p>
        </div>
        {!records.denied && (
          <Link className="button" href="/admin/staff/invite" prefetch={false}>
            Promotions &amp; invitations
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>
      {query.invalid ? (
        <section className="wsd-state">
          <Feedback message="This staff view contains unsupported or invalid filters." />
          <button className="button secondary" onClick={clearFilters}>
            Clear staff filters
          </button>
        </section>
      ) : (
        !records.denied && (
          <>
            <div className="wsd-filters">
              <StaffSearch
                key={`${params.get("q") ?? ""}:${searchRevision}`}
                value={params.get("q") ?? ""}
                onSearch={(value) => {
                  change("q", value);
                  requestAnimationFrame(() =>
                    document.getElementById("directory-records")?.focus(),
                  );
                }}
              />
              {(
                [
                  { name: "role", label: "Account role", options: privilegedRoles },
                  { name: "status", label: "Account status", options: staffStatuses },
                ] as const
              ).map((f) => (
                <div className="field" key={f.name}>
                  <label htmlFor={`directory-${f.name}`}>{f.label}</label>
                  <select
                    id={`directory-${f.name}`}
                    value={params.get(f.name) ?? ""}
                    onChange={(e) => change(f.name, e.target.value)}
                  >
                    <option value="">
                      {f.name === "role" ? "All roles" : "All statuses"}
                    </option>
                    {f.options.map((v) => (
                      <option key={v} value={v}>
                        {staffLabels[v]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="field wsd-branch">
                <label htmlFor="directory-branch">Branch</label>
                <AdminBranchPicker
                  id="directory-branch"
                  value={params.get("branchId") ?? ""}
                  activeOnly={false}
                  onChange={(id) => change("branchId", id)}
                  onDenied={onDenied}
                />
              </div>
              <div className="wsd-filter-actions">
                <button
                  className="button secondary"
                  aria-label="Refresh staff directory"
                  disabled={busy}
                  onClick={() => {
                    records.refresh();
                    refreshAccess();
                  }}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Refresh
                </button>
                <button
                  className="button secondary"
                  aria-label="Clear staff filters"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </div>
            </div>
            <section aria-labelledby="directory-records">
              <div className="wsd-band">
                <h2 id="directory-records" tabIndex={-1}>
                  Staff accounts
                </h2>
                <span>
                  {data ? `${data.items.length} on this page` : "Current results"}
                </span>
              </div>
              {busy && (
                <p role="status" className="wsd-state">
                  {data ? "Refreshing staff accounts…" : "Checking staff accounts…"}
                </p>
              )}
              {error && (
                <div className="wsd-state">
                  <Feedback message={error} />
                  <p>
                    {data
                      ? "Previously loaded accounts are shown. Refresh before moving to another page."
                      : "Staff accounts could not be loaded."}
                  </p>
                </div>
              )}
              {!busy && !error && data && !data.items.length && (
                <div className="wsd-state">
                  <h3>No matching staff accounts</h3>
                  <p>
                    Clear the filters or refresh to check for updates. Invitations appear
                    here after they are accepted.
                  </p>
                </div>
              )}
              {!!data?.items.length && (
                <>
                  <div className="wsd-columns" aria-hidden="true">
                    <span>Person</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Branch</span>
                    <span>Email</span>
                    <span>Account</span>
                  </div>
                  <ul className="wsd-records">
                    {data.items.map((row) => (
                      <DirectoryRecord key={row.id} row={row} owner={owner} />
                    ))}
                  </ul>
                </>
              )}
              <nav className="wsd-pagination" aria-label="Staff directory pages">
                <span>Account records · refresh for recent changes</span>
                <div>
                  <button
                    className="button secondary"
                    disabled={busy || !!error || !params.has("cursor")}
                    onClick={() =>
                      navigate(staffDirectoryPageParams(params, undefined, true))
                    }
                  >
                    Previous
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !!error || !data?.nextCursor}
                    onClick={() =>
                      navigate(staffDirectoryPageParams(params, data?.nextCursor))
                    }
                  >
                    Next
                  </button>
                </div>
              </nav>
            </section>
          </>
        )
      )}
    </div>
  );
}
function StaffSearch({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [error, setError] = useState<string>();
  return (
    <form
      className="wsd-search"
      role="search"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (q && (q.length < 2 || q.length > 100 || /[\u0000-\u001f\u007f]/u.test(q))) {
          setError("Enter 2–100 characters to search, or clear the search.");
          document.getElementById("directory-search")?.focus();
          return;
        }
        setError(undefined);
        onSearch(q);
      }}
    >
      <div className="field">
        <label htmlFor="directory-search">Search name or email</label>
        <div className="wsd-search-controls">
          <input
            type="search"
            name="q"
            id="directory-search"
            defaultValue={value}
            maxLength={100}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? "directory-search-error" : undefined}
          />
          <button className="button secondary">Search</button>
        </div>
        {error && (
          <p className="field-error" role="alert" id="directory-search-error">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
function DirectoryRecord({ row, owner }: { row: StaffMember; owner: string }) {
  const name = directoryName(row),
    branch = row.staffProfile?.branch;
  return (
    <li>
      <article className="wsd-record" aria-labelledby={`directory-name-${row.id}`}>
        <div className="wsd-person">
          <h3 id={`directory-name-${row.id}`}>{name}</h3>
          {name !== row.email && <p>{row.email}</p>}
          {row.staffProfile?.jobTitle && <span>{row.staffProfile.jobTitle}</span>}
          {row.id === owner && <small>Your account</small>}
        </div>
        <dl>
          <dt>Role</dt>
          <dd>{staffLabels[row.role]}</dd>
        </dl>
        <dl>
          <dt>Status</dt>
          <dd>
            <span className={`wsd-status wsd-${row.status.toLowerCase()}`}>
              {staffLabels[row.status]}
            </span>
          </dd>
        </dl>
        <dl className="wsd-record-branch">
          <dt>Branch</dt>
          <dd>
            {branch?.name ?? "No branch assigned"}
            {branch && !branch.isActive && <small>Inactive branch</small>}
          </dd>
        </dl>
        <dl>
          <dt>Email</dt>
          <dd>{row.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
        </dl>
        <Link
          className="text-link wsd-account"
          href={`${root}/${row.id}`}
          prefetch={false}
          aria-label={`View account for ${name}`}
        >
          View account
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}
