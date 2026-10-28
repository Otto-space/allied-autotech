import type { NotificationPreference } from "@/lib/api/notification-schemas";
import {
  deliveryAvailability,
  type DeliveryChannels,
} from "@/lib/notifications/delivery-availability";
import styles from "./notification-delivery-status.module.css";

export function NotificationDeliveryStatus({
  id,
  category,
  channel,
  channels,
  enabled,
  isDefault,
  stale,
}: {
  id: string;
  category: NotificationPreference["category"];
  channel: NotificationPreference["channel"];
  channels: DeliveryChannels;
  enabled: boolean;
  isDefault: boolean;
  stale: boolean;
}) {
  const availability = deliveryAvailability(category, channel, channels, stale);
  return (
    <div id={id} className={styles.status}>
      <p>
        {stale
          ? "Last known preference"
          : isDefault
            ? "Default preference"
            : "Saved preference"}
        : {enabled ? "On" : "Off"}
      </p>
      <span className={styles.badge}>{availability.label}</span>
      <span className="sr-only">{availability.detail}</span>
    </div>
  );
}

export function NotificationDeliveryDetails() {
  return (
    <details className={styles.details}>
      <summary>How delivery preferences work</summary>
      <p>
        Your preference records whether you want optional messages. It does not turn on an
        unavailable delivery service. Service enabled means sending is enabled, not that
        an individual message has been delivered. Messages also need valid contact
        details.
      </p>
      <p>
        Marketing requires your consent for each channel and an available marketing
        service. You can change or withdraw your preference at any time.
      </p>
      <p>
        Required security and transaction messages follow the existing delivery policy.
        These optional choices do not change them. Your in-app inbox stays available.
      </p>
    </details>
  );
}
