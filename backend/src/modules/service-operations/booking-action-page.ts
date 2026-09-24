import { createHash } from "node:crypto";
import type { Response } from "express";
import type { BookingStatus } from "../../generated/prisma/client.js";

export interface BookingActionSummary {
  scheduledAt: Date;
  status: BookingStatus;
  attendanceConfirmedAt: Date | null;
  service: { name: string };
  branch: { name: string; address: string; city: string; state: string } | null;
}

const styles = `
@font-face{font-family:Quicksand;src:url('/fonts/quicksand-variable.ttf') format('truetype');font-weight:300 700;font-display:swap}
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;background:#f5f6f7;color:#01121a;font:500 16px/1.65 Quicksand,system-ui,sans-serif}
a{color:inherit;text-underline-offset:4px}a:hover{text-decoration-thickness:2px}button,input{font:inherit}button,summary,a{touch-action:manipulation}
:focus-visible{outline:3px solid #1c64ad;outline-offset:4px}header{background:#01121a;color:#fff;padding:20px max(20px,calc((100vw - 1000px)/2));border-bottom:3px solid #e60301}
.brand{font-size:20px;font-weight:700;text-decoration:none;letter-spacing:-.5px}.brand span{color:#ff7573}main{max-width:680px;margin:48px auto;padding:0 20px}article{background:white;border:1px solid #dce1e4;border-radius:12px;padding:32px}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#52616c;margin:0 0 12px}h1{font-size:clamp(25px,5vw,32px);font-weight:700;line-height:1.25;letter-spacing:-.7px;margin:0 0 16px}h2{font-size:18px;margin:0 0 8px;font-weight:700}p{margin:0 0 18px}dl{margin:24px 0;padding:20px;background:#f5f6f7;border-radius:8px}dl div+div{margin-top:16px}dt{font-size:13px;color:#52616c}dd{margin:2px 0 0;font-weight:600;overflow-wrap:anywhere}dd small{display:block;font-weight:500;font-size:14px}time{font-variant-numeric:tabular-nums}.status{display:inline-block;font-size:13px;border:1px solid #ccd5da;border-radius:4px;padding:3px 10px;margin-bottom:4px}
button,.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 18px;border:1px solid #01121a;border-radius:6px;background:#01121a;color:#fff;font-weight:700;font-size:15px;text-decoration:none;cursor:pointer}button:hover,.button:hover{background:#223943}details{margin-top:24px;border-top:1px solid #dce1e4;padding-top:16px}summary{cursor:pointer;min-height:44px;padding:8px 0;font-weight:600}details p{font-size:15px}.danger{background:#b50000;border-color:#b50000}.danger:hover{background:#850000}.notice{border-left:3px solid #52616c;padding:12px 16px;background:#f5f6f7;font-size:15px}.secondary{margin:24px 0 0;font-size:15px}.support{font-size:14px;margin:24px 0;color:#52616c}.support a{display:inline-block;min-height:44px;padding:10px 0}.support p{margin:0}footer{max-width:680px;margin:24px auto;padding:0 20px 24px;font-size:12px;color:#52616c}form{margin:0}@media(max-width:480px){main{margin:24px auto;padding:0 16px}article{padding:22px 18px}dl{padding:16px}button,.button{width:100%}header{padding:16px}footer{padding:0 16px 20px}}
`;

export const bookingPageCsp = [
  "default-src 'none'",
  `style-src 'sha256-${createHash("sha256").update(styles).digest("base64")}'`,
  "font-src 'self'",
  "script-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Native form POSTs need a non-null Origin. Send origin only, never the signed URL.
export function bookingPageHeaders(res: Response) {
  res.set({
    "Cache-Control": "no-store",
    "Referrer-Policy": "strict-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Content-Security-Policy": bookingPageCsp,
  });
}

function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function document(title: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="strict-origin"><title>${escape(title)} | Allied AutoTech</title><style>${styles}</style></head><body><header><a rel="noreferrer" class="brand" href="/">Allied <span>AutoTech</span></a></header><main><article><p class="eyebrow">Your service appointment</p><h1>${escape(title)}</h1>${content}</article><aside class="support" aria-label="Appointment support"><p>Need help with your appointment?</p><a rel="noreferrer" href="tel:+2348136075567">Call +234 813 607 5567</a><p><a rel="noreferrer" href="/help">Visit our help centre</a></p></aside></main><footer>Allied AutoTech &middot; Built on Trust, Driven by Quality.</footer></body></html>`;
}

const statusLabels: Record<BookingStatus, string> = {
  REQUESTED: "Awaiting staff review",
  AWAITING_DEPOSIT: "Awaiting booking review",
  CONFIRMED: "Appointment confirmed",
  IN_PROGRESS: "Service in progress",
  COMPLETED: "Service completed",
  CANCELLED: "Appointment cancelled",
  NO_SHOW: "Marked as missed",
  EXPIRED: "Appointment expired",
};

function summary(booking: BookingActionSummary) {
  const date = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(booking.scheduledAt);
  const time = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
  }).format(booking.scheduledAt);
  return `<dl><div><dt>Service</dt><dd>${escape(booking.service.name)}</dd></div><div><dt>Appointment time</dt><dd><time datetime="${booking.scheduledAt.toISOString()}">${escape(date)}<small>${escape(time)} &middot; West Africa Time (Lagos)</small></time></dd></div>${booking.branch ? `<div><dt>Location</dt><dd>${escape(booking.branch.name)}<small>${escape([booking.branch.address, booking.branch.city, booking.branch.state].join(", "))}</small></dd></div>` : ""}</dl>`;
}

function form(token: string, action: "CONFIRM" | "CANCEL", label: string) {
  return `<form method="post" action="/api/v1/public/booking-response"><input type="hidden" name="token" value="${escape(token)}"><button${action === "CANCEL" ? ' class="danger"' : ""} name="action" value="${action}">${label}</button></form>`;
}

const manage =
  '<p class="secondary"><a rel="noreferrer" href="/dashboard/bookings">View bookings in your account</a></p>';

export function bookingActionPage(booking: BookingActionSummary, token: string) {
  const confirmed = booking.status === "CONFIRMED";
  const canCancel = [
    "REQUESTED",
    "AWAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
  ].includes(booking.status);
  const title = confirmed
    ? booking.attendanceConfirmedAt
      ? "We’re expecting you"
      : "Let us know you’re coming"
    : statusLabels[booking.status];
  return document(
    title,
    `<span class="status">${statusLabels[booking.status]}</span>${summary(booking)}${confirmed ? (booking.attendanceConfirmedAt ? '<p class="notice">Your attendance is already confirmed. You do not need to confirm again.</p>' : `<p>Confirm that you plan to attend this appointment. Opening this page does not change your booking.</p>${form(token, "CONFIRM", "Confirm attendance")}`) : "<p>View your account for the latest booking details.</p>"}${canCancel ? `<details><summary>Cancel this appointment</summary><h2>Review cancellation</h2><p>This cancels the appointment shown above. There is no cancellation fee. Any refund for an existing payment is reviewed separately.</p><p>To keep your appointment, close this section without submitting.</p>${form(token, "CANCEL", "Yes, cancel appointment")}</details>` : ""}${manage}`,
  );
}

export function bookingActionSuccess(
  booking: BookingActionSummary,
  action: "CONFIRM" | "CANCEL",
) {
  return document(
    action === "CANCEL" ? "Appointment cancelled" : "Attendance confirmed",
    `<p>${action === "CANCEL" ? "Your appointment is cancelled. There is no cancellation fee. Any refund for an existing payment is reviewed separately." : "Your attendance has been recorded. We look forward to seeing you at the scheduled time."}</p>${summary(booking)}${manage}`,
  );
}

export function bookingActionError(status: number, mutation: boolean) {
  const unavailable = status >= 500;
  return document(
    unavailable
      ? "We couldn’t check your appointment"
      : "This appointment link needs attention",
    `<p>${unavailable ? (mutation ? "We couldn’t confirm the result of your request. Check your booking in your account before submitting another action." : "Your appointment details are temporarily unavailable. Try opening the reminder again shortly, or view your bookings in your account.") : status === 403 ? "We couldn’t verify where this request came from. Open your latest reminder directly, or sign in to manage your booking." : "This link may have expired, or the appointment may have changed. Open your latest reminder or sign in to check the current booking."}</p><a rel="noreferrer" class="button" href="/dashboard/bookings">Check my bookings</a>`,
  );
}
