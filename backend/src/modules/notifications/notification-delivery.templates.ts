import type { NotificationDeliveryPayload } from "./notifications.types.js";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function renderNotificationEmail(payload: NotificationDeliveryPayload) {
  return {
    subject: payload.title,
    text: payload.message,
    html: `<h1>${escapeHtml(payload.title)}</h1><p>${escapeHtml(payload.message).replaceAll("\n", "<br>")}</p>`,
  };
}
