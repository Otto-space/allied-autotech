"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { WorkforceDirectory } from "./workforce-directory";
import { Feedback } from "./feedback";
import { WorkforceAccessReviews } from "./workforce-access-reviews";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess } from "@/lib/api/workforce-schemas";
import { workforceAccessKey } from "@/lib/workforce-registry";
import { useWorkforceRefresh } from "./workforce-workspace";
import "./workforce-entry.css";

export function WorkforceEntry() {
  const session = useAccountSession();
  const path = usePathname();
  // Admin keeps its approved account-level workspace, even with a workforce
  // record. Its real session therefore does not set workforceManaged. Check the
  // separate, current delegation rather than requiring that Staff-only flag.
  if (session?.user.role === "ADMIN")
    return <DelegatedPeopleEntry key={`${session.id}:${session.user.id}`} path={path} />;
  if (session?.user.role !== "SUPER_ADMIN")
    return (
      <>
        <h1>Responsibility management unavailable</h1>
        <Feedback message="Responsibility workspace access requires enrollment or an owner access review." />
        <Link className="button secondary" href="/admin">
          Return to overview
        </Link>
      </>
    );
  return path === "/admin/workforce/reviews" ? (
    <WorkforceAccessReviews />
  ) : (
    <WorkforceDirectory />
  );
}

function DelegatedPeopleEntry({ path }: { path: string }) {
  const session = useAccountSession();
  const own = useOwnStaffPermissions();
  const access = useResource("/staff/workforce/access", parseWorkforceAccess);
  useWorkforceRefresh(access.refresh, access.data);
  const identity =
    own.data?.id === session?.user.id &&
    own.data?.role === "ADMIN" &&
    own.data?.status === "ACTIVE" &&
    !own.error &&
    !own.refreshError;
  const supported =
    path === "/admin/workforce" ||
    path === "/admin/workforce/access" ||
    path.startsWith("/admin/workforce/access/") ||
    path === "/admin/workforce/reviews";
  const retained =
    supported &&
    identity &&
    access.data?.managed &&
    access.data.userId === session?.user.id &&
    access.data.canManageAssignments &&
    !access.error &&
    !access.refreshError
      ? access.data
      : undefined;
  const pending = own.loading || own.refreshing || access.loading || access.refreshing;
  const verified = !!retained && !pending;
  const error = own.error || own.refreshError || access.error || access.refreshError;
  const mismatch =
    (own.data &&
      (own.data.id !== session?.user.id ||
        own.data.role !== "ADMIN" ||
        own.data.status !== "ACTIVE")) ||
    (access.data &&
      (access.data.userId !== session?.user.id ||
        (access.data.canManageAssignments && !access.data.managed)));
  return (
    <>
      {retained && (
        <div hidden={!verified} inert={!verified}>
          <DelegatedPeopleContent key={workforceAccessKey(retained)} path={path} />
        </div>
      )}
      {!verified && (
        <section className="detail-section">
          <h1>{pending ? "Checking duty management" : "Duty management unavailable"}</h1>
          {pending ? (
            <p role="status">Checking your current identity and delegated duties…</p>
          ) : (
            <Feedback
              message={
                error ??
                (mismatch || !identity
                  ? "Your current Admin identity could not be confirmed. Refresh before relying on previous duty details."
                  : "Your current delegation does not permit this duty-management page. Your account-level Admin workspace remains available.")
              }
            />
          )}
          <div className="wf-entry-actions">
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => {
                own.refresh();
                access.refresh();
              }}
            >
              Refresh duty management access
            </button>
            <Link
              className="button secondary"
              href={identity ? "/admin/staff" : "/admin"}
            >
              {identity ? "Return to People" : "Return to overview"}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

function DelegatedPeopleContent({ path }: { path: string }) {
  return path === "/admin/workforce/reviews" ? (
    <WorkforceAccessReviews />
  ) : (
    <WorkforceDirectory />
  );
}
