import type { IdentityEmailPayload } from "./identity.types.js";

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

export function renderIdentityEmail(payload: IdentityEmailPayload) {
  const link = escapeHtml(payload.link);
  if (payload.template === "verify-email") {
    return {
      subject: "Verify your Allied AutoTech email",
      text: `Verify your email using this link: ${payload.link}`,
      html: `<p>Verify your email to finish creating your Allied AutoTech account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
    };
  }

  if (payload.template === "privileged-invitation") {
    return {
      subject: "Your Allied AutoTech administrator invitation",
      text: `You have been invited to become an administrator. Sign in to your existing staff account, complete MFA and explicitly accept using this private link: ${payload.link}`,
      html: `<p>You have been invited to become an Allied AutoTech administrator.</p><p>Sign in to your existing staff account and complete MFA before accepting. Opening the link does not change your access.</p><p><a href="${link}">Review administrator invitation</a></p><p>This private link expires and can be accepted only once. Ignore this message if you were not expecting it.</p>`,
    };
  }

  return {
    subject: "Reset your Allied AutoTech password",
    text: `Reset your password using this link: ${payload.link}`,
    html: `<p>A password reset was requested for your Allied AutoTech account.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. Ignore this message if you did not request it.</p>`,
  };
}
