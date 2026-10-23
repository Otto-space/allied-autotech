import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderBrandEmail, type BrandEmail } from "../src/common/email/brand-template.js";

const directory = resolve("docs/email-branding");
await mkdir(directory, { recursive: true });
const templates: Record<string, BrandEmail> = {
  "verify-email": {
    title: "Verify your Allied AutoTech email",
    eyebrow: "Welcome to Allied AutoTech",
    message: "Verify your email to finish creating your Allied AutoTech account.",
    action: { label: "Verify email", url: "https://alliedautotech.com/verify-email" },
    note: "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
  },
  "reset-password": {
    title: "Reset your Allied AutoTech password",
    eyebrow: "Account security",
    message: "A password reset was requested for your Allied AutoTech account.",
    action: { label: "Reset password", url: "https://alliedautotech.com/reset-password" },
    note: "This link expires in 30 minutes. Ignore this message if you did not request it.",
  },
  "team-invitation": {
    title: "Your Allied AutoTech administrator invitation",
    eyebrow: "Your team invitation",
    message:
      "You have been invited to become an Allied AutoTech administrator. Sign in to your existing staff account and complete MFA before accepting. Opening the link does not change your access.",
    action: {
      label: "Review administrator invitation",
      url: "https://alliedautotech.com/staff/accept-invitation",
    },
    note: "This private link expires and can be accepted only once. Ignore this message if you were not expecting it.",
  },
  "support-reply": {
    title: "You have a new support reply",
    eyebrow: "Customer care · New reply",
    message:
      "Our team has replied to your conversation. Sign in to read the response and continue the conversation.",
    action: {
      label: "Read your reply",
      url: "https://alliedautotech.com/dashboard/support",
    },
  },
  "support-status": {
    title: "Your support request has an update",
    eyebrow: "Customer care · Status update",
    message:
      "The status of your support request has changed. Open your conversation to see the latest progress.",
    action: {
      label: "View request status",
      url: "https://alliedautotech.com/dashboard/support",
    },
  },
  "account-update": {
    title: "You have an account update",
    message:
      "There is a new update in your Allied AutoTech account. Sign in to review it securely.",
    action: {
      label: "View update",
      url: "https://alliedautotech.com/dashboard/notifications",
    },
  },
  "team-update": {
    title: "An update needs your attention",
    eyebrow: "Team workspace",
    message:
      "There is a new update in your staff inbox. Open it to review the details and next steps within your current responsibilities.",
    action: {
      label: "Open staff inbox",
      url: "https://alliedautotech.com/admin/notifications",
    },
  },
  "group-reply": {
    title: "A response from Allied AutoTech",
    eyebrow: "Allied AutoTech · Customer care",
    message:
      "Hello,\n\nThank you for contacting Allied AutoTech.\n\n[Write the response here before sending.]\n\nKind regards,\nThe Allied AutoTech team",
  },
  "group-welcome": {
    title: "Welcome to the Allied AutoTech team",
    eyebrow: "Team communications",
    message:
      "You have been added to an Allied AutoTech group. This group helps the team coordinate the work it is responsible for.\n\nUse the dashboard for customer records and operational actions. Contact your group manager if you believe you were added in error.",
    action: { label: "Open team workspace", url: "https://alliedautotech.com/admin" },
  },
  "group-acknowledgement": {
    title: "We’ve received your message",
    eyebrow: "Allied AutoTech · Thank you",
    message:
      "Thank you for contacting Allied AutoTech. Your message has reached our team. We will review it and respond through this conversation.\n\nPlease keep related information in the same email thread so our team can follow the conversation.",
    note: "This is an automatic acknowledgement. It does not confirm a booking, payment, refund or service completion.",
  },
};
const drafts = [];
for (const [name, input] of Object.entries(templates)) {
  const rendered = renderBrandEmail(input);
  await writeFile(resolve(directory, `${name}.html`), rendered.html);
  await writeFile(resolve(directory, `${name}.txt`), rendered.text);
  // Provider copies are drafts for review. Application delivery renders trusted
  // typed payloads in code; it does not interpolate arbitrary HTML variables.
  drafts.push({
    name: `Allied AutoTech / ${name}`,
    alias: `allied-${name}-v1`,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
await writeFile(
  resolve(directory, "resend-drafts.json"),
  JSON.stringify(drafts, null, 2) + "\n",
);
await writeFile(
  resolve(directory, "google-groups-footer.txt"),
  "Allied AutoTech\nBuilt on Trust. Driven by Quality.\n133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria.\nWebsite: https://alliedautotech.com\nCustomer care: https://alliedautotech.com/help\n",
);
await writeFile(
  resolve(directory, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Allied AutoTech email designs</title><body style="margin:40px;background:#f1f4f5;color:#06181f;font:16px Arial"><h1>Allied AutoTech email designs</h1><p>Review copies only. No messages have been sent.</p><ul>${Object.keys(
    templates,
  )
    .map(
      (name) =>
        `<li style="margin:16px 0"><a href="${name}.html">${name.replaceAll("-", " ")}</a></li>`,
    )
    .join("")}</ul></body></html>`,
);
console.log(
  `Exported ${drafts.length} reviewable email designs and Google Groups footer.`,
);
