"use client";
import { useEffect } from "react";
import { invalidateSession } from "@/lib/api/client";
import { PasswordChangeForm } from "./password-change-form";
import { SecuritySessions } from "./security-sessions";
import { SecurityFactors } from "./security-factors";
export function SecurityPanel({ presentation }: { presentation: "customer" | "staff" }) {
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) invalidateSession();
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);
  return (
    <div className={`account-security ${presentation}-security`}>
      <header className="security-heading">
        <span className="eyebrow">Account protection</span>
        <h1>Account security</h1>
        <p>
          {presentation === "staff"
            ? "Manage your work account password, sign-in methods and active sessions."
            : "Manage your password, sign-in methods and active sessions."}
        </p>
        {presentation === "staff" && (
          <p className="security-role-note">
            Work accounts require at least one active MFA factor.
          </p>
        )}
      </header>
      <nav className="security-sections" aria-label="Security sections">
        <a href="#security-password">Password</a>
        <a href="#security-factors">MFA &amp; recovery</a>
        <a href="#security-sessions">Active sessions</a>
      </nav>
      <div className="security-grid">
        <PasswordChangeForm compact />
        <SecurityFactors compact />
        <SecuritySessions compact />
      </div>
    </div>
  );
}
