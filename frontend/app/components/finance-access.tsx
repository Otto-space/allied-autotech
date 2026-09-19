"use client";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";

export function FinanceAccess({ children }: { children: React.ReactNode }) {
  const session = useAccountSession();
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return (
      <>
        <h1>Finance</h1>
        <Feedback message="Administrator access is required for finance." />
      </>
    );
  }
  return children;
}
