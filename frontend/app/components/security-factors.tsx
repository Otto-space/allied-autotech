"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseFactors, recoveryCodesSchema } from "@/lib/api/security-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { FactorRemovalForm } from "./factor-removal-form";
import { RecoveryCodes } from "./recovery-codes";
export function SecurityFactors() {
  const session = useAccountSession();
  const records = useResource("/auth/mfa/factors", parseFactors);
  const [selected, setSelected] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [codes, setCodes] = useState<string[]>();
  const [message, setMessage] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  const clearPassword = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
      clearPassword.current?.();
    },
    [],
  );
  const active =
    records.data?.factors.filter((factor) => factor.status === "ACTIVE") ?? [];
  const disabled = records.loading || !!records.error;
  const mayRemove = session?.user.role === "CUSTOMER" || active.length > 1;
  function regenerate() {
    if (disabled || proposal || !active.length || codes) return;
    setProposal({
      title: "Replace your recovery codes?",
      description:
        "Every previous recovery code will stop working. Save the new codes privately before leaving this page. No codes are emailed or automatically downloaded.",
      facts: [
        {
          label: "Previous codes",
          value: uncertain.recovery
            ? "The last result was unknown; any previous codes may already be invalid"
            : "Invalidate all",
        },
      ],
      onUncertain: () => setUncertain((value) => ({ ...value, recovery: true })),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const result = recoveryCodesSchema.parse(
            (
              await apiRequest<unknown>("/auth/mfa/recovery-codes/regenerate", {
                method: "POST",
                csrf: true,
                body: {},
                signal: controller.signal,
              })
            ).data,
          );
          if (!controller.signal.aborted) {
            setCodes(result.recoveryCodes);
            setUncertain((value) => ({ ...value, recovery: false }));
          }
        } finally {
          pending.current = null;
        }
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>Multi-factor authentication</h2>
      <Link className="button secondary" href="/mfa?setup=1">
        Add MFA factor
      </Link>
      <p>
        Review the factors registered to your account. Pending setup is not an active
        sign-in factor.
      </p>
      <Feedback message={records.error} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={records.loading || !!proposal}
        onClick={records.refresh}
      >
        Refresh MFA factors
      </button>
      {records.loading && <p role="status">Checking MFA factors…</p>}
      {!records.loading && !records.error && records.data?.factors.length === 0 && (
        <p>No MFA factors are registered.</p>
      )}
      {records.data?.factors.map((factor) => (
        <article className="detail-section" key={factor.id}>
          <h3>
            {factor.name ??
              (factor.type === "TOTP" ? "Authenticator app" : "Security key")}
          </h3>
          <dl className="totals">
            <dt>Type</dt>
            <dd>{factor.type === "TOTP" ? "Authenticator app" : "Security key"}</dd>
            <dt>Status</dt>
            <dd>{factor.status}</dd>
            <dt>Added</dt>
            <dd>{formatBusinessDate(factor.createdAt)}</dd>
            <dt>Verified</dt>
            <dd>
              {factor.verifiedAt ? formatBusinessDate(factor.verifiedAt) : "Not verified"}
            </dd>
            <dt>Last used</dt>
            <dd>
              {factor.lastUsedAt ? formatBusinessDate(factor.lastUsedAt) : "Not recorded"}
            </dd>
          </dl>
          {factor.status === "PENDING" && (
            <p>Setup has not been completed. Pending factors cannot be removed here.</p>
          )}
          {factor.status === "ACTIVE" && (
            <>
              {!mayRemove && (
                <p className="notice">
                  Staff and administrator accounts must keep at least one active MFA
                  factor.
                </p>
              )}
              {uncertain[factor.id] && (
                <p className="notice">
                  Removal could not be confirmed. Refresh the factor list before taking
                  further action. This removal will not be resent.
                </p>
              )}
              {selected === factor.id ? (
                <FactorRemovalForm
                  disabled={disabled || !mayRemove || !!uncertain[factor.id]}
                  onCancel={() => setSelected(undefined)}
                  onReview={(password, clear) => {
                    if (disabled || proposal || !mayRemove || uncertain[factor.id])
                      return;
                    let credential = password;
                    clearPassword.current = () => {
                      credential = "";
                      clear();
                    };
                    setProposal({
                      title: "Remove this MFA factor?",
                      description:
                        "This factor will no longer verify future sign-ins. Existing sessions and recovery codes are not revoked by this action. The account must retain any MFA factor required by its role.",
                      facts: [
                        { label: "Factor", value: factor.name ?? factor.type },
                        { label: "Reference", value: factor.id },
                      ],
                      retryAfterRejection: false,
                      onUncertain: () =>
                        setUncertain((value) => ({ ...value, [factor.id]: true })),
                      submit: async () => {
                        const controller = new AbortController();
                        pending.current = controller;
                        try {
                          await apiRequest(`/auth/mfa/factors/${factor.id}`, {
                            method: "DELETE",
                            csrf: true,
                            signal: controller.signal,
                            body: { password: credential },
                          });
                          if (!controller.signal.aborted) setSelected(undefined);
                        } catch (error) {
                          if (
                            error instanceof ApiError &&
                            error.code === "AUTHENTICATION_FAILED"
                          )
                            throw new ApiError(401, {
                              error: { code: "SECURITY_PASSWORD_REJECTED" },
                            });
                          throw error;
                        } finally {
                          credential = "";
                          clear();
                          clearPassword.current = null;
                          pending.current = null;
                          records.refresh();
                        }
                      },
                    });
                  }}
                />
              ) : (
                <button
                  className="button secondary"
                  disabled={
                    disabled || !mayRemove || !!uncertain[factor.id] || !!selected
                  }
                  onClick={() => setSelected(factor.id)}
                >
                  Remove {factor.name ?? factor.type}
                </button>
              )}
            </>
          )}
        </article>
      ))}
      <section className="detail-section">
        <h3>Recovery codes</h3>
        <p>
          Recovery codes are single-use alternatives when your usual MFA factor is
          unavailable. Their current values cannot be retrieved.
        </p>
        {!active.length && !records.loading && !records.error && (
          <p>An active MFA factor is needed before managing recovery codes here.</p>
        )}
        {uncertain.recovery && (
          <p className="notice" role="status">
            Replacement could not be confirmed and previous codes may no longer work. You
            may explicitly review a new replacement to obtain a fresh set.
          </p>
        )}
        <button
          className="button secondary"
          disabled={disabled || !active.length || !!codes}
          onClick={regenerate}
        >
          {uncertain.recovery
            ? "Review another code replacement"
            : "Replace recovery codes"}
        </button>
        {codes && !proposal && (
          <RecoveryCodes codes={codes} onDismiss={() => setCodes(undefined)} />
        )}
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            clearPassword.current?.();
            clearPassword.current = null;
            setProposal(null);
          }}
          onSuccess={() =>
            setMessage("Security change confirmed. Review the updated information below.")
          }
        />
      )}
    </section>
  );
}
