"use client";
import {
  supportEmailDeliveryPageSchema,
  type SupportEmailPage,
} from "@/lib/api/support-email-schemas";
import { useResource } from "@/lib/api/use-resource";
import { StatusBadge } from "./status-progress";

const parse = (value: unknown) => supportEmailDeliveryPageSchema.parse(value);
const explanations = {
  CHANNEL_DISABLED: "Email delivery is disabled. Follow up through the Support mailbox.",
  CONSENT_WITHDRAWN:
    "The customer has turned off operational emails. The response remains in their account.",
  NO_RECIPIENT:
    "No customer email address is available. Use another supplied contact method.",
  SUPPORT_REPLY_ADDRESS_MISSING:
    "The Support reply address is not configured. Ask an administrator to check email settings.",
  STAGING_RECIPIENT_NOT_ALLOWLISTED:
    "This recipient is outside the testing email allowlist.",
  SUPPORT_EMAIL_FAILED: "Email delivery encountered an error.",
  PROVIDER_REJECTED:
    "The email provider rejected this message. Ask an administrator to review the provider result before any follow-up.",
  RETRY_EXHAUSTED:
    "Repeated delivery attempts failed. Ask an administrator to review the provider result before any follow-up.",
};
export function SupportEmailDelivery({
  base,
  revision,
}: {
  base: string;
  revision: number;
}) {
  const resource = useResource(`${base}/email-deliveries`, parse, undefined, {
    refreshKey: revision,
  });
  return (
    <SupportEmailDeliverySummary
      page={resource.data}
      loading={resource.loading || resource.refreshing}
      error={resource.error || resource.refreshError}
      onRefresh={resource.refresh}
    />
  );
}
export function SupportEmailDeliverySummary({
  page,
  loading,
  error,
  onRefresh,
}: {
  page?: SupportEmailPage;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
}) {
  return (
    <section className="wi-card support-delivery" aria-labelledby="support-email-title">
      <h2 id="support-email-title">Customer email delivery</h2>
      <p>
        Saving a reply and sending its email are separate steps. Sent means the email
        provider accepted it for processing; recipient-server delivery, inbox placement
        and reading are not confirmed here.
      </p>
      <p>
        Email replies arrive in the Support mailbox and are not automatically added to
        this conversation.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={loading}
        onClick={onRefresh}
      >
        Refresh email delivery
      </button>
      {loading && <p role="status">Checking email delivery…</p>}
      {error && (
        <p role="alert">
          Email status is unavailable. Refresh to check before sending a duplicate reply.
        </p>
      )}
      {!error &&
        page &&
        (page.items.length ? (
          <ol className="support-delivery-list">
            {page.items.map((item) => (
              <li key={item.id}>
                <StatusBadge status={item.status} />
                {item.status === "SENT" && <span> Provider accepted</span>}
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Lagos",
                  }).format(new Date(item.createdAt))}{" "}
                  (Nigeria time)
                </time>
                {item.reason && <p>{explanations[item.reason]}</p>}
                {item.attempts > 0 && <p>Send attempts: {item.attempts}</p>}
                {item.status === "RETRYING" && (
                  <p>
                    Another attempt is scheduled automatically
                    {item.nextRetryAt
                      ? ` after ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(item.nextRetryAt))} (Nigeria time)`
                      : ""}
                    . Do not send the same reply again.
                  </p>
                )}
                {item.status === "FAILED" && (
                  <p>
                    Automatic delivery has stopped. Check the Support mailbox/provider
                    before following up manually.
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p>
            No customer email updates are recorded yet. Internal notes and staff
            assignments do not send customer emails. Older messages are not backfilled.
          </p>
        ))}
      {!!page?.items.length && (
        <p>
          Latest {page.items.length} email{" "}
          {page.items.length === 1 ? "update" : "updates"}, newest first.
        </p>
      )}
    </section>
  );
}
