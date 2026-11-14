"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountSession } from "./dashboard-shell";
import { WorkforceDirectory } from "./workforce-directory";
import { Feedback } from "./feedback";
import { WorkforceAccessReviews } from "./workforce-access-reviews";
export function WorkforceEntry() {
  const session = useAccountSession();
  const path = usePathname();
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
