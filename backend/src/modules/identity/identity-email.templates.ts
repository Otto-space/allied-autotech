import { renderBrandEmail } from "../../common/email/brand-template.js";
import type { IdentityEmailPayload } from "./identity.types.js";
export function renderIdentityEmail(payload: IdentityEmailPayload) {
  if (payload.template === "verify-email")
    return renderBrandEmail({
      title: "Verify your Allied AutoTech email",
      eyebrow: "Welcome to Allied AutoTech",
      message: "Verify your email to finish creating your Allied AutoTech account.",
      action: { label: "Verify email", url: payload.link },
      note: "This link expires in 24 hours. If you did not create this account, you can ignore this email.",
    });
  if (payload.template === "privileged-invitation")
    return renderBrandEmail({
      title: "Your Allied AutoTech administrator invitation",
      eyebrow: "Your team invitation",
      message:
        "You have been invited to become an Allied AutoTech administrator. Sign in to your existing staff account and complete MFA before accepting. Opening the link does not change your access.",
      action: { label: "Review administrator invitation", url: payload.link },
      note: "This private link expires and can be accepted only once. Ignore this message if you were not expecting it.",
    });
  return renderBrandEmail({
    title: "Reset your Allied AutoTech password",
    eyebrow: "Account security",
    message: "A password reset was requested for your Allied AutoTech account.",
    action: { label: "Reset password", url: payload.link },
    note: "This link expires in 30 minutes. Ignore this message if you did not request it.",
  });
}
