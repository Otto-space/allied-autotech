"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseSecuritySessions, type SecuritySession } from "@/lib/api/security-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const lastUsed = (value: string | null) =>
  value ? formatBusinessDate(value) : "No activity recorded";
export function SecuritySessions({ compact = false }: { compact?: boolean }) {
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const records = useResource("/auth/sessions", parseSecuritySessions);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const disabled = records.loading || !!records.error;
  const others = records.data?.sessions.filter((session) => !session.current) ?? [];
  function review(session?: SecuritySession) {
    const key = session?.id ?? "all";
    if (disabled || proposal || uncertain[key] || session?.current) return;
    setProposal({
      title: session ? "Sign out this session?" : "Sign out all other sessions?",
      description:
        "This browser's current session stays signed in. The selected access will require a new sign-in on its next request.",
      facts: [
        {
          label: "Scope",
          value: session
            ? `${session.client} / ${session.network}`
            : "Every other session on this account at submission time",
        },
        ...(session
          ? [
              { label: "Last used", value: lastUsed(session.lastUsedAt) },
              { label: "Session reference", value: session.id },
            ]
          : []),
      ],
      onUncertain: () => setUncertain((value) => ({ ...value, [key]: true })),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          await apiRequest(session ? `/auth/sessions/${session.id}` : "/auth/sessions", {
            method: "DELETE",
            csrf: true,
            signal: controller.signal,
            body: {},
          });
        } finally {
          if (!controller.signal.aborted) records.refresh();
          if (pending.current === controller) pending.current = null;
        }
      },
    });
  }
  return (
    <section
      className="detail-section security-sessions"
      id={compact ? "security-sessions" : undefined}
      tabIndex={compact ? -1 : undefined}
    >
      <h2>Active sessions</h2>
      <p>
        Review your signed-in browsers. Network addresses are masked. Use the dashboard’s
        Sign out action to end this browser’s session.
      </p>
      <Feedback message={records.error} />
      <Feedback message={message} tone="success" toast="Session change recorded." />
      {Object.values(uncertain).some(Boolean) && (
        <p className="notice" role="status">
          A sign-out result could not be confirmed. Refresh and review the sessions before
          taking another action. The affected request will not be resent here.
        </p>
      )}
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading || !!proposal}
          onClick={records.refresh}
        >
          Refresh sessions
        </button>
        <button
          className="button secondary"
          disabled={disabled || !others.length || Object.values(uncertain).some(Boolean)}
          onClick={() => review()}
        >
          Sign out all other sessions
        </button>
      </div>
      {records.loading && <p role="status">Checking active sessions…</p>}
      {!records.loading && !records.error && records.data?.sessions.length === 0 && (
        <p>
          No active sessions were returned. Verify your account again if this appears
          unexpected.
        </p>
      )}
      {records.data?.sessions.map((session) => (
        <article className="detail-section security-record" key={session.id}>
          <h3>
            {session.client}
            {session.current ? " · This browser" : ""}
          </h3>
          {compact ? (
            <>
              <dl className="security-record-summary">
                <div>
                  <dt>Network</dt>
                  <dd>{session.network}</dd>
                </div>
                <div>
                  <dt>Last used</dt>
                  <dd>{lastUsed(session.lastUsedAt)}</dd>
                </div>
              </dl>
              <details className="security-details">
                <summary>Session details</summary>
                <dl className="security-record-summary">
                  <div>
                    <dt>Created</dt>
                    <dd>{formatBusinessDate(session.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{formatBusinessDate(session.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>MFA verification</dt>
                    <dd>{session.mfaVerified ? "Verified" : "Not verified"}</dd>
                  </div>
                </dl>
              </details>
            </>
          ) : (
            <dl className="totals">
              <dt>Network</dt>
              <dd>{session.network}</dd>
              <dt>Last used</dt>
              <dd>{lastUsed(session.lastUsedAt)}</dd>
              <dt>Created</dt>
              <dd>{formatBusinessDate(session.createdAt)}</dd>
              <dt>Expires</dt>
              <dd>{formatBusinessDate(session.expiresAt)}</dd>
              <dt>MFA verification</dt>
              <dd>{session.mfaVerified ? "Verified" : "Not verified"}</dd>
            </dl>
          )}
          {!session.current && (
            <button
              className="button secondary"
              disabled={disabled || !!uncertain[session.id] || !!uncertain.all}
              onClick={() => review(session)}
            >
              Sign out {session.client} session
            </button>
          )}
        </article>
      ))}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() =>
            setMessage(
              "Session sign-out confirmed. Review the refreshed active sessions.",
            )
          }
        />
      )}
    </section>
  );
}
