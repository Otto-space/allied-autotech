export const messages: Readonly<Record<string, string>> = {
  BACKEND_NOT_CONFIGURED: "Online services are not connected yet.",
  AUTHENTICATION_FAILED: "The email or password could not be verified.",
  SECURITY_PASSWORD_REJECTED:
    "Your current password could not be verified. Go back and enter it again.",
  UNAUTHORIZED: "Please sign in to continue.",
  SESSION_EXPIRED: "Your session has expired. Please sign in to continue.",
  MFA_REQUIRED: "Complete the security check to continue.",
  CSRF_INVALID:
    "Your security session changed. Refresh this page before submitting again.",
  TOKEN_INVALID: "This link is invalid or has expired. Request a new link.",
  ACCOUNT_LOCKED:
    "Sign-in is temporarily unavailable for this account. Try again later or contact support.",
  FORBIDDEN: "Your account does not have permission for this action.",
  NOT_FOUND: "This record is unavailable or you no longer have access to it.",
  VALIDATION_FAILED: "Check the highlighted fields and submit again.",
  BAD_REQUEST: "The request could not be accepted. Check your information.",
  MALFORMED_JSON: "The request could not be accepted. Refresh and try again.",
  PAYLOAD_TOO_LARGE: "The submitted content is too large.",
  CONFLICT:
    "This record has changed or is no longer available. Refresh its status before continuing.",
  STALE_VERSION: "This record has changed. Refresh it and review the latest details.",
  PRECONDITION_UNAVAILABLE:
    "The current record could not be checked. No change was submitted. Refresh it before trying again.",
  IDEMPOTENCY_CONFLICT:
    "This submission has already been used with different details. Check the current status before starting again.",
  PAYMENT_ATTEMPT_PENDING:
    "This payment already has an attempt awaiting confirmation or review. Check its status before making another payment.",
  PAYMENT_TARGET_PENDING:
    "A payment already exists for this purchase or invoice. Open Payments and check the existing request before paying again.",
  INSUFFICIENT_STOCK:
    "There is not enough available stock for this quantity. Refresh availability and review the quantity before trying again.",
  INVALID_TRANSITION: "This action is no longer available. Refresh the current status.",
  SCHEDULE_CONFLICT:
    "This appointment time is no longer available. Please choose another time.",
  RATE_LIMITED: "Too many requests. Please wait a little before trying again.",
  DATABASE_UNAVAILABLE:
    "The service is temporarily unavailable. Please try again shortly.",
  PROVIDER_UNAVAILABLE:
    "The external service is temporarily unavailable. Check the current status before trying again.",
  REQUEST_TIMEOUT:
    "We did not receive confirmation in time. Check the current status before submitting again.",
  NETWORK_ERROR:
    "The connection was interrupted. Check your connection and the current status before submitting again.",
  INVALID_RESPONSE:
    "We could not read the service response. Please try refreshing the page.",
};

export function errorMessage(code: string, status: number): string {
  return (
    messages[code] ??
    (status === 401
      ? messages.SESSION_EXPIRED
      : status === 403
        ? messages.FORBIDDEN
        : "The request could not be completed. Please try again shortly.")
  );
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function fieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const fields: Record<string, string[]> = {};
  for (const path of Object.keys(value).slice(0, 40)) {
    if (!/^(body|query|params)\.[a-zA-Z0-9_.]{1,100}$/.test(path)) continue;
    // Never echo arbitrary validation text, which may contain rejected input.
    fields[path] = ["Check this field and enter a valid value."];
  }
  return Object.keys(fields).length ? fields : undefined;
}
