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
    text:
      payload.message +
      (payload.bookingAction
        ? `\nConfirm attendance or cancel: ${payload.bookingAction.url}`
        : ""),
    html: `<h1>${escapeHtml(payload.title)}</h1><p>${escapeHtml(payload.message).replaceAll("\n", "<br>")}</p>${payload.bookingAction ? `<p><a href="${escapeHtml(payload.bookingAction.url)}">Review appointment: confirm attendance or cancel</a></p>` : ""}`,
  };
}
