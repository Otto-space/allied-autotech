"use client";
import Link from "next/link";
import { useAccountSession } from "./dashboard-shell";
import { WorkforceDirectory } from "./workforce-directory";
import { Feedback } from "./feedback";
export function WorkforceEntry() {
  const session = useAccountSession();
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
  return <WorkforceDirectory />;
}
