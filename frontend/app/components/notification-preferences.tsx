"use client";
import { useState } from "react";
import { usePreferenceWrite } from "@/lib/notifications/use-preference-write";
import { PreferenceRecovery } from "./preference-recovery";
import { deliveryAvailability } from "@/lib/notifications/delivery-availability";
import {
  NotificationDeliveryDetails,
  NotificationDeliveryStatus,
} from "./notification-delivery-status";
import { useAccountSession } from "./dashboard-shell";
import type { PreferenceIntent } from "@/lib/notifications/preference-recovery";
import { useResource } from "@/lib/api/use-resource";
import {
  parseNotificationPreferences,
  preferenceEnabled,
  type NotificationPreference,
} from "@/lib/api/notification-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function NotificationPreferences({ base }: { base: string }) {
  const session = useAccountSession();
  if (!session) return null;
  const role = session.user.role;
  if (
    role !== "CUSTOMER" &&
    role !== "STAFF" &&
    role !== "ADMIN" &&
    role !== "SUPER_ADMIN"
  )
    return null;
  return (
    <OwnedPreferences
      key={`${session.user.id}:${session.user.role}`}
      base={base}
      userId={session.user.id}
      role={role}
    />
  );
}
function OwnedPreferences({
  base,
  userId,
  role,
}: {
  base: string;
  userId: string;
  role: PreferenceIntent["role"];
}) {
  const records = useResource(
    `${base}/preferences/current`,
    parseNotificationPreferences,
  );
  const preferences = records.data?.preferences;
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const guard = usePreferenceWrite(userId, role, records);
  const disabled = guard.disabled || !!proposal;
  function review(
    category: NotificationPreference["category"],
    channel: NotificationPreference["channel"],
    enabled: boolean,
  ) {
    if (disabled) return;
    const expectedVersion =
      preferences?.find((p) => p.category === category && p.channel === channel)
        ?.version ?? 0;
    setMessage(undefined);
    setProposal({
      title: `${enabled ? "Enable" : "Disable"} ${category.toLowerCase()} ${channel === "EMAIL" ? "email" : "SMS"}?`,
      description:
        category === "MARKETING" && enabled
          ? `By confirming, you consent to receive marketing messages through this channel. You can turn this preference off later. ${deliveryAvailability(category, channel, records.data?.channels).detail}`
          : "This changes your preference for future optional messages. It does not recall messages already queued for delivery or change in-app notifications.",
      facts: [
        { label: "Category", value: category.toLowerCase() },
        { label: "Channel", value: channel },
        { label: "New preference", value: enabled ? "Enabled" : "Disabled" },
      ],
      retryAfterRejection: false,
      submit: async () => {
        await guard.run({ category, channel, enabled, expectedVersion });
        setMessage(
          "Delivery preference saved. Message delivery also depends on available contact details and enabled delivery services.",
        );
        records.refresh();
      },
    });
  }
  return (
    <section className="detail-section" aria-labelledby="notification-preferences-title">
      <h2 id="notification-preferences-title">Delivery preferences</h2>
      <p>
        Security and transactional messages cannot be turned off here. These settings
        apply to optional email and SMS messages; in-app updates remain available.
      </p>
      <p>
        Service-update preferences are on by default. Your preference and delivery
        availability are shown separately.
      </p>
      <Feedback message={records.error} />
      <Feedback
        message={message}
        tone="success"
        toast="Notification preferences updated."
      />
      <Feedback message={records.refreshError} />
      <PreferenceRecovery
        guard={guard}
        onRecovered={(superseded) => {
          setMessage(
            superseded
              ? "Original change confirmed. A newer preference is already saved; it has been preserved."
              : "Preference change confirmed.",
          );
          records.refresh();
        }}
      />
      <button
        className="button secondary"
        disabled={records.loading || records.refreshing || guard.busy || !!proposal}
        onClick={guard.refresh}
      >
        Refresh preferences
      </button>
      {records.loading && <p role="status">Checking delivery preferences…</p>}
      {preferences && (
        <div className="notification-preferences">
          {(["OPERATIONAL", "MARKETING"] as const).flatMap((category) =>
            (["EMAIL", "SMS"] as const).map((channel) => {
              const preference = preferences.find(
                (item) => item.category === category && item.channel === channel,
              );
              const enabled = preferenceEnabled(category, preference);
              const title = `${category === "OPERATIONAL" ? "Operational" : "Marketing"} ${channel === "EMAIL" ? "email" : "SMS"}`;
              return (
                <article
                  className="notification-item"
                  key={`${category}-${channel}`}
                  aria-label={title}
                >
                  <h3>{title}</h3>
                  <NotificationDeliveryStatus
                    id={`delivery-${category}-${channel}`}
                    category={category}
                    channel={channel}
                    channels={records.data?.channels}
                    enabled={enabled}
                    isDefault={!preference}
                    stale={
                      records.refreshing || !!records.error || !!records.refreshError
                    }
                  />
                  <button
                    className="button secondary"
                    disabled={disabled}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${title.toLowerCase()}`}
                    aria-describedby={`delivery-${category}-${channel}`}
                    onClick={() => review(category, channel, !enabled)}
                  >
                    {enabled ? "Disable" : "Enable"}
                  </button>
                </article>
              );
            }),
          )}
        </div>
      )}
      <NotificationDeliveryDetails />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}
