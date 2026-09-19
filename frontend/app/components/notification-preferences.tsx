"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseNotificationPreferences,
  preferenceEnabled,
  preferenceSchema,
  type NotificationPreference,
} from "@/lib/api/notification-schemas";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function NotificationPreferences({ base }: { base: string }) {
  const records = useResource(
    `${base}/preferences/current`,
    parseNotificationPreferences,
  );
  const preferences = records.data?.preferences;
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const disabled =
    records.loading || !!records.error || !records.data || !!proposal || uncertain;
  function review(
    category: NotificationPreference["category"],
    channel: NotificationPreference["channel"],
    enabled: boolean,
  ) {
    if (disabled) return;
    setMessage(undefined);
    setProposal({
      title: `${enabled ? "Enable" : "Disable"} ${category.toLowerCase()} ${channel === "EMAIL" ? "email" : "SMS"}?`,
      description:
        category === "MARKETING" && enabled
          ? "By confirming, you consent to receive marketing messages through this channel. You can turn this preference off later."
          : "This changes your preference for future optional messages. It does not recall messages already queued for delivery or change in-app notifications.",
      facts: [
        { label: "Category", value: category.toLowerCase() },
        { label: "Channel", value: channel },
        { label: "New preference", value: enabled ? "Enabled" : "Disabled" },
      ],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          const response = await apiRequest(`${base}/preferences/current`, {
            method: "PUT",
            csrf: true,
            body: { category, channel, enabled },
            signal: controller.signal,
          });
          const updated = preferenceSchema.parse(response.data);
          if (
            updated.category !== category ||
            updated.channel !== channel ||
            updated.enabled !== enabled ||
            (category === "MARKETING" && enabled && !updated.consentedAt)
          )
            throw new Error("Unconfirmed preference");
          setMessage(
            "Delivery preference saved. Message delivery also depends on available contact details and enabled delivery services.",
          );
          records.refresh();
        } finally {
          pending.current = null;
        }
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
        Operational delivery is enabled by default. Marketing delivery requires your
        consent for each channel. Enabled preferences do not guarantee delivery.
      </p>
      <Feedback message={records.error} />
      <Feedback message={message} tone="success" />
      {uncertain && (
        <p className="notice" role="status">
          The preference change could not be confirmed. Refresh to inspect saved
          preferences. Further changes are paused in this view; no request will be
          replayed automatically.
        </p>
      )}
      <button
        className="button secondary"
        disabled={records.loading || !!proposal}
        onClick={records.refresh}
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
                  <p>
                    {enabled ? "Enabled" : "Disabled"}
                    {!preference ? " (default)" : ""}
                  </p>
                  <button
                    className="button secondary"
                    disabled={disabled}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${title.toLowerCase()}`}
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
