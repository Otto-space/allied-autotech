"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
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
import { workforceDestination, workforceAllows } from "@/lib/workforce-registry";

export function WorkforceWorkspace({
  access,
  refreshAccess,
  children,
}: {
  access: WorkforceAccess;
  refreshAccess: () => void;
  children?: React.ReactNode;
}) {
  const path = usePathname();
  const destination = workforceDestination(path);
  if (!destination || !workforceAllows(access, destination.predicate))
    return <WorkforceAccessRedirect />;
  switch (destination.id) {
    case "overview":
      return <WorkforceOverview access={access} refreshAccess={refreshAccess} />;
    case "fitment":
      return <WorkPartsFitment />;
    case "access":
      return <WorkforceAccessLookup canInvite={access.canInviteAdmins} />;
    case "jobs":
      return path === destination.href ? (
        <WorkforceJobs access={access} refreshAccess={refreshAccess} />
      ) : (
        <WorkforceJobDetail
          key={`${access.userId}:${path}`}
          id={path.slice(destination.href.length + 1)}
          access={access}
          refreshAccess={refreshAccess}
        />
      );
    case "bookings":
      return path === destination.href ? (
        <WorkforceBookings access={access} refreshAccess={refreshAccess} />
      ) : (
        <WorkforceBookingDetail
          key={`${access.userId}:${path}`}
          id={path.slice(destination.href.length + 1)}
          access={access}
          refreshAccess={refreshAccess}
        />
      );
    case "finance":
      return <WorkforceFinance access={access} refreshAccess={refreshAccess} />;
    case "orders":
      return <WorkforceOrders access={access} refreshAccess={refreshAccess} />;
    case "enquiries":
      return <WorkforceEnquiries access={access} refreshAccess={refreshAccess} />;
    case "complaints":
      return <WorkforceComplaints access={access} refreshAccess={refreshAccess} />;
    // Personal pages are rendered by DashboardShell, under the same registry guard.
    case "security":
    case "notifications":
      return null;
    case "refunds":
    case "disputes":
    case "financialPolicy":
    case "privacy":
      return children ?? null;
  }
}
function WorkforceAccessRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin?workAccess=updated");
  }, [router]);
  return (
    <section role="status">
      <h1>Access unavailable</h1>
      <p>
        Your current responsibilities do not permit this page. Returning to your overview.
      </p>
      <Link className="button secondary" href="/admin?workAccess=updated">
        Return to overview
      </Link>
    </section>
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
    // New servers supply the next start/expiry relative to their own clock.
    const delay = access.nextChangeAt
      ? Date.parse(access.nextChangeAt) - Date.parse(access.serverTime)
      : Math.min(
          ...access.assignments.flatMap((a) =>
            a.expiresAt ? [Date.parse(a.expiresAt) - Date.now()] : [],
          ),
        );
    const interval = window.setInterval(refresh, 30_000);
    const focus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", focus);
    const timeout = Number.isFinite(delay)
      ? window.setTimeout(refresh, Math.max(0, Math.min(2_147_483_647, delay + 50)))
      : undefined;
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener("focus", focus);
    };
  }, [refresh, access]);
}
