"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseSecuritySessions, type SecuritySession } from "@/lib/api/security-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function SecuritySessions() {
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
              { label: "Last used", value: formatBusinessDate(session.lastUsedAt) },
              { label: "Session reference", value: session.id },
            ]
          : []),
      ],
      onUncertain: () => setUncertain((value) => ({ ...value, [key]: true })),
      submit: async () => {
        try {
          await apiRequest(session ? `/auth/sessions/${session.id}` : "/auth/sessions", {
            method: "DELETE",
            csrf: true,
            body: {},
          });
        } finally {
          records.refresh();
        }
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>Active sessions</h2>
      <p>
        Device labels and masked network addresses come from the server. Use Sign out in
        the page header to end this browser’s session.
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
        <article className="detail-section" key={session.id}>
          <h3>
            {session.client}
            {session.current ? " · This browser" : ""}
          </h3>
          <dl className="totals">
            <dt>Network</dt>
            <dd>{session.network}</dd>
            <dt>Last used</dt>
            <dd>{formatBusinessDate(session.lastUsedAt)}</dd>
            <dt>Created</dt>
            <dd>{formatBusinessDate(session.createdAt)}</dd>
            <dt>Expires</dt>
            <dd>{formatBusinessDate(session.expiresAt)}</dd>
            <dt>MFA verification</dt>
            <dd>{session.mfaVerified ? "Verified" : "Not verified"}</dd>
          </dl>
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
