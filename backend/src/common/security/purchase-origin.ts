import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

/** Host-only purchase cookies require links to return to the same approved
 * browser origin. Never derive it from Host, a body field or a return URL. */
export function trustedPurchaseOrigin(value: string): string {
  try {
    const origin = new URL(value).origin;
    if (env.FRONTEND_URL.some((allowed) => new URL(allowed).origin === origin))
      return origin;
  } catch {
    /* Reject malformed origins using the same public error. */
  }
  throw new AppError({
    code: "CSRF_INVALID",
    statusCode: 403,
    message: "Purchase origin validation failed",
  });
}
