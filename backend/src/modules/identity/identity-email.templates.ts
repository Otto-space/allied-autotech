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
      subject: "Your Allied AutoTech staff invitation",
      text: `Accept your staff invitation using this link: ${payload.link}`,
      html: `<p>You have been invited to an Allied AutoTech staff account.</p><p><a href="${link}">Accept invitation</a></p><p>This private, single-use link expires in 24 hours. Ignore this message if you were not expecting it.</p>`,
    };
  }

  return {
    subject: "Reset your Allied AutoTech password",
    text: `Reset your password using this link: ${payload.link}`,
    html: `<p>A password reset was requested for your Allied AutoTech account.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. Ignore this message if you did not request it.</p>`,
  };
}
