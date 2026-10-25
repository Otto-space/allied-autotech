"use client";
import { useState } from "react";
import {
  supportEmailDeliveryPageSchema,
  type SupportEmailPage,
} from "@/lib/api/support-email-schemas";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { StatusBadge } from "./status-progress";
import { useAccountSession } from "./dashboard-shell";
import "./care-workspace.css";
const parse = (value: unknown) => supportEmailDeliveryPageSchema.parse(value);
const explanations: Record<string, string> = {
  CHANNEL_DISABLED: "Email delivery is disabled.",
  CONSENT_WITHDRAWN: "Operational email consent is off.",
  NO_RECIPIENT: "No customer email address is available.",
  SUPPORT_REPLY_ADDRESS_MISSING: "Support reply address needs configuration.",
  STAGING_RECIPIENT_NOT_ALLOWLISTED: "Recipient is outside the testing allowlist.",
  SUPPORT_EMAIL_FAILED: "Email delivery encountered an error.",
  PROVIDER_REJECTED: "The provider rejected this email.",
  RETRY_EXHAUSTED: "Automatic delivery attempts have stopped.",
};
export function SupportEmailDelivery({
  base,
  revision,
}: {
  base: string;
  revision: number;
}) {
  const session = useAccountSession();
  const resource = useResource(base + "/email-deliveries", parse, undefined, {
    refreshKey: revision,
  });
  return (
    <SupportEmailDeliverySummary
      page={resource.data}
      loading={resource.loading || resource.refreshing}
      error={resource.error || resource.refreshError}
      onRefresh={resource.refresh}
      dismissPath={
        session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role)
          ? base + "/email-deliveries/dismiss"
          : undefined
      }
    />
  );
}
export function SupportEmailDeliverySummary({
  page,
  loading,
  error,
  onRefresh,
  dismissPath,
}: {
  page?: SupportEmailPage;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  dismissPath?: string;
}) {
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<string>(),
    [confirmed, setConfirmed] = useState<string[]>([]);
  const visible =
    page?.items.filter(
      (i) =>
        i.noticeEligible &&
        i.noticeRevision &&
        !i.noticeDismissed &&
        !confirmed.includes(i.id + ":" + i.noticeRevision),
    ) ?? [];
  async function dismiss(items: typeof visible) {
    if (busy || loading || !dismissPath) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const result = await apiRequest<unknown>(dismissPath, {
        method: "POST",
        csrf: true,
        body: { notices: items.map((i) => ({ id: i.id, revision: i.noticeRevision })) },
      });
      const next = parse(result.data);
      if (
        !items.every((i) =>
          next.items.some(
            (n) =>
              n.id === i.id && n.noticeRevision === i.noticeRevision && n.noticeDismissed,
          ),
        )
      )
        throw Error("Unconfirmed dismissal");
      setConfirmed((old) => [...old, ...items.map((i) => i.id + ":" + i.noticeRevision)]);
      onRefresh();
    } catch {
      setFailure(
        "Delivery notices could not be confirmed as dismissed. Refresh and review the visible notices; delivery status is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const latest = page?.items[0];
  const groups = [
    ...new Set(visible.map((i) => `${i.providerStatus ?? i.status}:${i.reason ?? ""}`)),
  ].map((key) =>
    visible.filter((i) => `${i.providerStatus ?? i.status}:${i.reason ?? ""}` === key),
  );
  const failures =
    page?.items.filter(
      (i) =>
        i.status === "FAILED" ||
        ["BOUNCED", "COMPLAINED", "FAILED", "SUPPRESSED"].includes(
          i.providerStatus ?? "",
        ),
    ).length ?? 0;
  return (
    <section className="support-delivery" aria-label="Customer email delivery">
      <p>
        <strong>Email delivery: </strong>
        {latest ? (
          <StatusBadge status={latest.providerStatus ?? latest.status}>
            {latest.providerStatus
              ? latest.providerStatus.toLowerCase().replaceAll("_", " ")
              : latest.status === "SENT"
                ? "Provider accepted"
                : latest.status.toLowerCase().replaceAll("_", " ")}
          </StatusBadge>
        ) : loading ? (
          "Checking..."
        ) : (
          "No email updates recorded"
        )}
      </p>
      {failures > 0 && (
        <p>
          <StatusBadge status="FAILED">
            {failures} failed email {failures === 1 ? "update" : "updates"}
          </StatusBadge>{" "}
          retained in delivery history.
        </p>
      )}
      {error && (
        <p role="alert">
          Email status is unavailable. Check before sending a duplicate reply.
        </p>
      )}
      {failure && <p role="alert">{failure}</p>}
      {!!visible.length && !error && (
        <div className="delivery-notices" aria-label="Visible delivery notices">
          <p>
            Reply updates are saved separately from email delivery. {visible.length} email{" "}
            {visible.length === 1 ? "update needs" : "updates need"} attention.
          </p>
          {groups.map((items) => {
            const item = items[0];
            return (
              <div key={item.id + item.noticeRevision}>
                <p>
                  <strong>
                    {item.providerStatus?.toLowerCase() ??
                      item.status.toLowerCase().replaceAll("_", " ")}
                  </strong>{" "}
                  -{" "}
                  {item.reason
                    ? explanations[item.reason]
                    : "Review the retained delivery details before following up."}
                  {items.length > 1 ? ` (${items.length} email updates)` : ""}
                </p>
                {dismissPath && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || loading}
                    aria-label={
                      items.length === 1
                        ? "Dismiss delivery notice " + item.id
                        : `Dismiss ${items.length} matching delivery notices`
                    }
                    onClick={() => void dismiss(items)}
                  >
                    {items.length === 1 ? "Dismiss notice" : "Dismiss matching notices"}
                  </button>
                )}
              </div>
            );
          })}
          {dismissPath && visible.length > 1 && (
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy || loading}
                onClick={() => void dismiss(visible)}
              >
                Dismiss visible delivery notices
              </button>
            </div>
          )}
          <p className="field-hint">
            Dismissal affects your view only. Delivery failures and history remain
            recorded.
          </p>
        </div>
      )}
      {busy && <p role="status">Saving your notice dismissal...</p>}
      <details>
        <summary>
          Email delivery history
          {page?.items.length ? " (" + page.items.length + " latest updates)" : ""}
        </summary>
        <p>
          Saved replies, provider acceptance and confirmed recipient-server delivery are
          separate. Delivered does not confirm reading or inbox placement. Email replies
          reach the Support mailbox and are not imported into this conversation.
        </p>
        <button
          type="button"
          className="button secondary"
          disabled={loading || busy}
          onClick={onRefresh}
        >
          Refresh email delivery
        </button>
        <ol className="support-delivery-list">
          {page?.items.map((item) => (
            <li key={item.id}>
              {item.status === "SENT" && item.providerStatus && (
                <StatusBadge status="SENT">Provider accepted</StatusBadge>
              )}
              {item.noticeEligible &&
                item.noticeRevision &&
                !item.noticeDismissed &&
                !confirmed.includes(item.id + ":" + item.noticeRevision) &&
                dismissPath && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || loading}
                    aria-label={`Dismiss individual delivery notice ${item.id}`}
                    onClick={() => void dismiss([item])}
                  >
                    Dismiss this notice
                  </button>
                )}
              <StatusBadge status={item.providerStatus ?? item.status}>
                {item.providerStatus?.toLowerCase().replaceAll("_", " ") ??
                  (item.status === "SENT"
                    ? "Provider accepted"
                    : item.status.toLowerCase().replaceAll("_", " "))}
              </StatusBadge>{" "}
              <time dateTime={item.createdAt}>
                {new Intl.DateTimeFormat("en-NG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Africa/Lagos",
                }).format(new Date(item.createdAt))}
              </time>
              {item.reason && <p>{explanations[item.reason]}</p>}
              <p>Send attempts: {item.attempts}</p>
              {item.status === "RETRYING" && (
                <p>
                  Another attempt is scheduled automatically
                  {item.nextRetryAt
                    ? " after " +
                      new Intl.DateTimeFormat("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Lagos",
                      }).format(new Date(item.nextRetryAt))
                    : ""}
                  . Do not send a duplicate.
                </p>
              )}
              {item.status === "FAILED" && (
                <p>
                  Automatic delivery has stopped. Coordinate follow-up through the Support
                  mailbox/provider.
                </p>
              )}
              {item.providerUpdatedAt && (
                <p>
                  Provider observation recorded{" "}
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Lagos",
                  }).format(new Date(item.providerUpdatedAt))}{" "}
                  (Nigeria time).
                </p>
              )}
            </li>
          ))}
        </ol>
        {!page?.items.length && !loading && (
          <p>
            No customer emails recorded. Internal notes do not send customer emails; older
            messages are not backfilled.
          </p>
        )}
      </details>
    </section>
  );
}
