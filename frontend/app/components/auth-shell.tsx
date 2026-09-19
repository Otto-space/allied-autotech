import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthShell({
  children,
  audience = "customer",
}: Readonly<{ children: ReactNode; audience?: "customer" | "staff" }>) {
  const staff = audience === "staff";
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-main">
          {children}
          <p className="auth-help">
            <Link className="text-link" href="/help">
              Need help with your account?
            </Link>
          </p>
        </div>
      </section>
      <aside
        className="auth-visual"
        aria-label={
          staff ? "Your Allied AutoTech team account" : "Your Allied AutoTech account"
        }
      >
        <div className="auth-statement">
          <span className="auth-monogram" aria-hidden="true">
            A
          </span>
          <h2>
            {staff ? "Your team." : "Your vehicle."}
            <br />
            {staff ? "Your workshop." : "Your next chapter."}
          </h2>
          <p>
            {staff
              ? "Bookings, inventory and operations, within your assigned access."
              : "Vehicle care, parts and your workshop visits, connected."}
          </p>
        </div>
        <div className="auth-caption">
          <strong>
            {staff
              ? "Access starts with verification."
              : "One secure account for every visit."}
          </strong>
          <p>
            {staff
              ? "Accept your invitation, set a password, then complete MFA before using staff tools."
              : "Book available appointments, check payment status, receive reminders, and speak with customer care."}
          </p>
        </div>
      </aside>
    </main>
  );
}
