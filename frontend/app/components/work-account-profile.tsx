"use client";
import Link from "next/link";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import "./work-account-profile.css";

const roles: Record<string, string> = {
  STAFF: "Staff",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
export function WorkAccountProfile() {
  const session = useAccountSession();
  const access = useOwnStaffPermissions();
  if (!session || !roles[session.user.role]) return null;
  const mismatch =
    access.data &&
    (access.data.id !== session.user.id ||
      access.data.role !== session.user.role ||
      access.data.status !== "ACTIVE");
  const error =
    access.error ||
    access.refreshError ||
    (mismatch
      ? "Your current profile could not be verified. Refresh before continuing."
      : undefined);
  const current = !access.loading && !error ? access.data : undefined;
  const name =
    current?.staffProfile &&
    [current.staffProfile.firstName, current.staffProfile.lastName]
      .filter(Boolean)
      .join(" ");
  return (
    <section className="work-own-profile">
      <h1>My profile</h1>
      <p>View the identity recorded for your signed-in work account.</p>
      <Feedback message={error} />
      {access.loading && <p role="status">Checking your profile…</p>}
      {current && (
        <div className="panel">
          <h2>{name || "My account"}</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{current.email}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{name || "No name recorded"}</dd>
            </div>
            <div>
              <dt>Account role</dt>
              <dd>{roles[session.user.role]}</dd>
            </div>
          </dl>
          <p>
            Contact an authorised account manager to correct recorded work details. This
            view does not change your role or responsibilities.
          </p>
        </div>
      )}
      <div className="actions">
        <Link className="button" href="/admin/security">
          Account security
        </Link>
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh my profile
        </button>
      </div>
    </section>
  );
}
