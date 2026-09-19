import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";

import {
  changePasswordBodySchema,
  emailBodySchema,
  factorDeleteBodySchema,
  loginBodySchema,
  mfaChallengeOptionsBodySchema,
  mfaChallengeVerifyBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  tokenBodySchema,
  totpVerifyBodySchema,
  webauthnOptionsBodySchema,
  webauthnVerifyBodySchema,
} from "./identity.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});

function registerPost(
  registry: OpenAPIRegistry,
  path: string,
  summary: string,
  requestSchema: ZodType | undefined,
  secured: boolean,
  statusCode: "200" | "201" | "202" = "200",
): void {
  const enrollment =
    /^\/auth\/mfa\/(totp\/(setup|verify)|webauthn\/(options|verify))$/.test(path);
  registry.registerPath({
    method: "post",
    path,
    tags: ["Identity"],
    summary,
    ...(enrollment
      ? {
          description:
            "Requires a current session and CSRF token. A session without MFA verification may enroll only when the account has no active MFA factor and no unused recovery code. Otherwise verify an existing MFA method first (403 MFA_REQUIRED). Eligibility is rechecked atomically during activation. Factor activation, replacement recovery codes, audit and session rotation commit together. A session rotated or revoked after middleware is rejected.",
        }
      : {}),
    ...(secured ? { security: [{ sessionCookie: [] }] } : {}),
    ...(requestSchema === undefined
      ? secured
        ? { request: { headers: z.object({ "x-csrf-token": z.string().min(32) }) } }
        : {}
      : {
          request: {
            ...(secured
              ? { headers: z.object({ "x-csrf-token": z.string().min(32) }) }
              : {}),
            body: {
              required: true,
              content: { "application/json": { schema: requestSchema } },
            },
          },
        }),
    responses: {
      ...(enrollment
        ? {
            "403": {
              description:
                "Existing MFA verification required, or CSRF validation failed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description:
                "Session unavailable, expired, revoked or changed during enrollment",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          }
        : {}),
      [statusCode]: {
        description: "Request completed",
        content: { "application/json": { schema: responseSchema } },
      },
    },
  });
}

export function registerIdentityOpenApi(
  registry: OpenAPIRegistry,
  sessionCookieName: string,
): void {
  registry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: sessionCookieName,
  });

  registerPost(
    registry,
    "/auth/register",
    "Register a customer",
    registerBodySchema,
    false,
    "202",
  );
  registerPost(registry, "/auth/email/verify", "Verify an email", tokenBodySchema, false);
  registerPost(
    registry,
    "/auth/email/resend",
    "Resend verification",
    emailBodySchema,
    false,
    "202",
  );
  registerPost(registry, "/auth/login", "Create a session", loginBodySchema, false);
  registerPost(registry, "/auth/logout", "Revoke the current session", undefined, true);
  registerPost(registry, "/auth/csrf", "Rotate the CSRF token", undefined, true);
  registerPost(
    registry,
    "/auth/password/forgot",
    "Request password recovery",
    emailBodySchema,
    false,
    "202",
  );
  registerPost(
    registry,
    "/auth/password/reset",
    "Reset a password",
    resetPasswordBodySchema,
    false,
  );
  registerPost(
    registry,
    "/auth/password/change",
    "Change a password",
    changePasswordBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/totp/setup",
    "Start TOTP enrollment",
    undefined,
    true,
    "201",
  );
  registerPost(
    registry,
    "/auth/mfa/totp/verify",
    "Complete TOTP enrollment",
    totpVerifyBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/webauthn/options",
    "Create WebAuthn registration options",
    webauthnOptionsBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/webauthn/verify",
    "Complete WebAuthn registration",
    webauthnVerifyBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/challenge/options",
    "Create MFA authentication options",
    mfaChallengeOptionsBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/challenge/verify",
    "Verify an MFA challenge",
    mfaChallengeVerifyBodySchema,
    true,
  );
  registerPost(
    registry,
    "/auth/mfa/recovery-codes/regenerate",
    "Regenerate recovery codes",
    undefined,
    true,
  );

  for (const [method, path, summary] of [
    ["get", "/auth/session", "Get current session"],
    ["get", "/auth/sessions", "List active sessions"],
    ["delete", "/auth/sessions", "Revoke other sessions"],
    ["delete", "/auth/sessions/{sessionId}", "Revoke an owned session"],
    ["get", "/auth/mfa/factors", "List safe MFA factor metadata"],
    ["delete", "/auth/mfa/factors/{factorId}", "Revoke an MFA factor"],
  ] as const) {
    registry.registerPath({
      method,
      path,
      tags: ["Identity"],
      summary,
      security: [{ sessionCookie: [] }],
      ...(path.includes("{sessionId}")
        ? {
            request: {
              params: z.object({ sessionId: z.uuid() }),
              headers: z.object({ "x-csrf-token": z.string().min(32) }),
            },
          }
        : path.includes("{factorId}")
          ? {
              request: {
                params: z.object({ factorId: z.uuid() }),
                headers: z.object({ "x-csrf-token": z.string().min(32) }),
                body: {
                  required: true,
                  content: { "application/json": { schema: factorDeleteBodySchema } },
                },
              },
            }
          : method === "delete"
            ? { request: { headers: z.object({ "x-csrf-token": z.string().min(32) }) } }
            : {}),
      responses: {
        "200": {
          description: "Request completed",
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
  }
}
