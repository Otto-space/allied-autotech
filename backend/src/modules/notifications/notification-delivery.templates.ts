import { renderBrandEmail } from "../../common/email/brand-template.js";
import type { NotificationDeliveryPayload } from "./notifications.types.js";
export function renderNotificationEmail(payload: NotificationDeliveryPayload) {
  return renderBrandEmail({
    title: payload.title,
    message: payload.message,
    ...(payload.bookingAction
      ? {
          action: {
            label: "Review appointment: confirm attendance or cancel",
            url: payload.bookingAction.url,
          },
        }
      : {}),
  });
}
