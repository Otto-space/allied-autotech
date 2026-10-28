import type {
  NotificationPreference,
  parseNotificationPreferences,
} from "@/lib/api/notification-schemas";

export type DeliveryChannels = ReturnType<
  typeof parseNotificationPreferences
>["channels"];

/** Availability describes the service, independently of the account's saved choice. */
export function deliveryAvailability(
  category: NotificationPreference["category"],
  channel: NotificationPreference["channel"],
  channels: DeliveryChannels,
  stale = false,
) {
  if (stale || !channels)
    return {
      label: "Availability unknown",
      detail:
        "Refresh preferences to check delivery availability. Your saved choice does not confirm that messages can be sent.",
    };
  if (category === "MARKETING" && !channels.marketing)
    return {
      label: "Delivery unavailable",
      detail: "Marketing delivery is not available yet. You can record your preference.",
    };
  if (!channels[channel === "EMAIL" ? "email" : "sms"])
    return {
      label: "Delivery unavailable",
      detail:
        "This delivery service is currently unavailable. Changing your preference will not enable the service.",
    };
  return {
    label: "Service enabled",
    detail:
      "The delivery service is enabled. Individual messages still depend on your preference, contact details and successful delivery.",
  };
}
