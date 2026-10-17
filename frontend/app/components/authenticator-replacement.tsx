"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseFactors } from "@/lib/api/security-schemas";
import { Feedback } from "./feedback";
import { MfaEnrollment } from "./mfa-enrollment";

export function AuthenticatorReplacement({
  onComplete,
  onCheck,
  onReverify,
  onCancel,
}: {
  onComplete: (token: string, codes: string[]) => void;
  onCheck: () => void;
  onReverify: () => void;
  onCancel: () => void;
}) {
  const factors = useResource("/auth/mfa/factors", parseFactors);
  const [selected, setSelected] = useState<string>();
  const [pending, setPending] = useState(false);
  const active =
    factors.data?.factors.filter(
      (factor) => factor.type === "TOTP" && factor.status === "ACTIVE",
    ) ?? [];
  const previous = active.find((factor) => factor.id === selected) ?? active[0];
  if (factors.loading) return <p role="status">Checking your linked authenticator...</p>;
  if (factors.error)
    return (
      <>
        <Feedback message={factors.error} />
        <button className="button secondary" onClick={onReverify}>
          Verify account to continue
        </button>
        <button className="mfa-text-button" onClick={factors.refresh}>
          Check authenticator again
        </button>
      </>
    );
  if (!previous)
    return (
      <>
        <p>
          No active authenticator registration is linked to this account. You can use the
          existing setup flow to add one.
        </p>
        <button className="button secondary" onClick={onCancel}>
          Return to MFA options
        </button>
      </>
    );
  return (
    <>
      {active.length > 1 ? (
        <div className="field">
          <label htmlFor="replace-authenticator">Authenticator to replace</label>
          <div className="mfa-select">
            <select
              id="replace-authenticator"
              value={previous.id}
              disabled={pending}
              onChange={(event) => setSelected(event.target.value)}
            >
              {active.map((factor, index) => (
                <option key={factor.id} value={factor.id}>
                  {factor.name ?? `Authenticator ${index + 1}`}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      ) : (
        <p className="mfa-hint">Replacing: {previous.name ?? "Authenticator app"}.</p>
      )}
      <MfaEnrollment
        key={previous.id}
        replaceFactorId={previous.id}
        onComplete={onComplete}
        onCheck={onCheck}
        onReverify={onReverify}
        onCancel={onCancel}
        onPendingChange={setPending}
      />
    </>
  );
}
