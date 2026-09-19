"use client";
import { PasswordChangeForm } from "./password-change-form";
import { SecuritySessions } from "./security-sessions";
import { SecurityFactors } from "./security-factors";
export function SecurityPanel() {
  return (
    <>
      <span className="eyebrow">Account protection</span>
      <h1>Account security</h1>
      <p className="lead">
        Manage your password, active sessions and registered sign-in factors.
      </p>
      <PasswordChangeForm />
      <SecuritySessions />
      <SecurityFactors />
    </>
  );
}
