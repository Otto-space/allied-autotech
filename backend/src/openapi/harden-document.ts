import { errorCodes } from "../common/errors/error-codes.js";

type JsonObject = Record<string, unknown>;

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);
const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanize(value: string): string {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[-_{}]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function title(value: string): string {
  return humanize(value).replaceAll(/\b\w/g, (character) => character.toUpperCase());
}

function operationId(method: string, path: string): string {
  const segments = path.split("/").filter(Boolean);
  return [
    method.toLowerCase(),
    ...segments.map((segment) =>
      segment.startsWith("{")
        ? `By${title(segment.slice(1, -1)).replaceAll(" ", "")}`
        : title(segment).replaceAll(" ", ""),
    ),
  ].join("");
}

function accessFor(
  path: string,
  secured: boolean,
): {
  boundary: string;
  roles: string[];
} {
  if (path.startsWith("/public/")) return { boundary: "public", roles: ["PUBLIC"] };
  if (path.startsWith("/webhooks/"))
    return { boundary: "provider-webhook", roles: ["PAYMENT_PROVIDER"] };
  if (path.startsWith("/customers/"))
    return { boundary: "authenticated-customer", roles: ["CUSTOMER"] };
  if (path.startsWith("/staff/"))
    return {
      boundary: "mfa-verified-staff",
      roles: ["STAFF", "ADMIN", "SUPER_ADMIN"],
    };
  if (path.startsWith("/admin/"))
    return { boundary: "mfa-verified-admin", roles: ["ADMIN", "SUPER_ADMIN"] };
  if (path.startsWith("/internal/"))
    return { boundary: "internal-operator", roles: ["INTERNAL"] };
  return secured
    ? { boundary: "authenticated-user", roles: ["AUTHENTICATED"] }
    : { boundary: "unauthenticated", roles: ["PUBLIC"] };
}

function parameterDescription(name: string, location: string): string {
  const field = humanize(name);
  if (name.toLowerCase() === "x-csrf-token")
    return "Session-bound CSRF token obtained from POST /auth/csrf; keep it in memory only.";
  if (name.toLowerCase() === "idempotency-key")
    return "Unique retry key for this logical mutation. Reuse it only with the identical request.";
  if (name.toLowerCase().includes("signature"))
    return "Provider-generated webhook signature verified against the exact raw request bytes.";
  if (location === "path")
    return `Identifier selecting the ${field.replace(/ id$/u, "")} resource.`;
  if (name === "cursor") return "Opaque cursor returned by the preceding page.";
  if (name === "limit") return "Maximum number of records to return, bounded by the API.";
  return `${title(field)} used to constrain this request.`;
}

function fieldDescription(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "expectedversion" || lower === "expectedrevision")
    return "Last server version observed by the client; stale writes are rejected.";
  if (lower === "idempotencykey")
    return "Retry key that must be reused only with an identical logical request.";
  if (lower.includes("password"))
    return "Sensitive password value sent only over HTTPS and never logged or persisted by the client.";
  if (lower === "email") return "Normalized account email address.";
  if (lower.includes("phone"))
    return "Customer or business phone number in international format.";
  if (lower === "rating")
    return "Whole-number customer rating from 1 (lowest) to 5 (highest).";
  if (lower.includes("amount") && lower.includes("kobo"))
    return "Integer amount in Nigerian kobo; the server remains authoritative.";
  if (lower.includes("price") && lower.includes("kobo"))
    return "Integer price in Nigerian kobo; client-calculated values are never authoritative.";
  if (lower === "acceptnonrefundabledeposit")
    return "Must be literal true to record acceptance of the non-refundable 30% booking deposit.";
  if (lower === "bookingpolicyversion")
    return "Exact booking-policy version most recently presented to the customer.";
  if (lower === "status")
    return "Requested or filtered lifecycle state from the documented enum.";
  if (lower === "cursor") return "Opaque cursor returned by the previous page.";
  if (lower === "limit")
    return "Maximum page size, subject to the documented server bound.";
  if (lower.endsWith("id"))
    return `Identifier of the ${humanize(name).replace(/ id$/u, "")} resource; ownership is resolved server-side.`;
  if (lower.endsWith("at") || lower.includes("date") || lower.includes("time"))
    return "ISO 8601 timestamp interpreted and validated by the server.";
  if (lower.includes("reason") || lower.includes("note") || lower.includes("message"))
    return "Plain-text business context; HTML is not accepted or rendered as trusted markup.";
  if (lower.includes("token") || lower.includes("code") || lower.includes("challenge"))
    return "Sensitive single-purpose value; submit once and never log or persist it in browser storage.";
  if (lower.includes("url") || lower.includes("uri"))
    return "HTTPS location validated against the operation's server-side allowlist.";
  if (lower.startsWith("is") || lower.startsWith("has") || lower.startsWith("allow"))
    return `Boolean control for ${humanize(name)}; authorization is still enforced server-side.`;
  return `${title(name)} validated by this operation's strict request contract.`;
}

function syntheticValue(name: string, schema: JsonObject): unknown {
  if (Array.isArray(schema["enum"]) && schema["enum"].length > 0)
    return schema["enum"][0];
  const lower = name.toLowerCase();
  if (schema["format"] === "uuid") return "00000000-0000-4000-8000-000000000001";
  if (schema["format"] === "date-time") return "2030-01-15T10:00:00.000Z";
  if (schema["format"] === "email" || lower.includes("email"))
    return "customer@example.test";
  if (schema["format"] === "uri" || lower.includes("url"))
    return "https://example.test/continue";
  if (lower.includes("password")) return "correct horse battery staple";
  if (lower.includes("token")) return "synthetic-token-value-not-a-real-secret";
  if (lower.includes("phone")) return "+2348000000000";
  if (lower.includes("amount") || lower.endsWith("kobo")) return "300000";
  if (lower.includes("currency")) return "NGN";
  if (lower.includes("date") || lower.endsWith("at")) return "2030-01-15T10:00:00.000Z";
  if (schema["type"] === "integer" || schema["type"] === "number")
    return typeof schema["minimum"] === "number" ? schema["minimum"] : 1;
  if (schema["type"] === "boolean") return true;
  return `synthetic-${lower.replaceAll(/[^a-z0-9]+/g, "-") || "value"}`;
}

function annotateSchema(schema: unknown, fieldName = "value"): void {
  if (!isObject(schema) || typeof schema["$ref"] === "string") return;
  if (typeof schema["description"] !== "string")
    schema["description"] = fieldDescription(fieldName);
  const properties = schema["properties"];
  if (isObject(properties)) {
    for (const [name, child] of Object.entries(properties)) annotateSchema(child, name);
  }
  if (isObject(schema["items"])) annotateSchema(schema["items"], `${fieldName} item`);
  for (const keyword of ["oneOf", "anyOf", "allOf"]) {
    const alternatives = schema[keyword];
    if (Array.isArray(alternatives))
      alternatives.forEach((alternative) => annotateSchema(alternative, fieldName));
  }
}

function exampleFromSchema(schema: unknown, fieldName = "value", depth = 0): unknown {
  if (!isObject(schema) || depth > 8) return null;
  if (schema["example"] !== undefined) return schema["example"];
  if (schema["const"] !== undefined) return schema["const"];
  if (Array.isArray(schema["enum"]) && schema["enum"].length > 0)
    return schema["enum"][0];
  const alternatives = schema["oneOf"] ?? schema["anyOf"];
  if (Array.isArray(alternatives) && alternatives.length > 0)
    return exampleFromSchema(alternatives[0], fieldName, depth + 1);
  if (schema["type"] === "array") {
    return [exampleFromSchema(schema["items"], `${fieldName} item`, depth + 1)];
  }
  const properties = schema["properties"];
  if (schema["type"] === "object" || isObject(properties)) {
    if (!isObject(properties)) return {};
    const required = new Set(Array.isArray(schema["required"]) ? schema["required"] : []);
    return Object.fromEntries(
      Object.entries(properties)
        .filter(([name]) => required.has(name) || Object.keys(properties).length <= 8)
        .map(([name, child]) => [name, exampleFromSchema(child, name, depth + 1)]),
    );
  }
  return syntheticValue(fieldName, schema);
}

function projectionSchema(description: string): JsonObject {
  return {
    type: "object",
    description,
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Public or authorized resource identifier.",
      },
      status: {
        type: "string",
        description: "Current server-owned lifecycle state when applicable.",
      },
    },
    additionalProperties: true,
  };
}

function replacementDataSchema(
  path: string,
  method: string,
  summary: string,
): JsonObject {
  const lower = summary.toLowerCase();
  if (path === "/auth/csrf")
    return {
      type: "object",
      description: "Rotated session-bound CSRF material returned exactly once.",
      properties: {
        csrfToken: {
          type: "string",
          description: "CSRF token to retain in memory only.",
        },
      },
      required: ["csrfToken"],
      additionalProperties: false,
    };
  if (path.endsWith("/paystack") || path.endsWith("/monnify"))
    return {
      type: "object",
      description: "Short-lived hosted-checkout authorization for the owned payment.",
      properties: {
        attemptId: { type: "string", format: "uuid", description: "Payment attempt ID." },
        authorizationUrl: {
          type: "string",
          format: "uri",
          description: "Allowlisted provider-hosted checkout URL.",
        },
        authorizationExpiresAt: {
          type: "string",
          format: "date-time",
          description: "Checkout authorization expiry.",
        },
        replayed: {
          type: "boolean",
          description: "Whether the idempotency key replayed an existing attempt.",
        },
      },
      required: ["attemptId", "authorizationUrl", "authorizationExpiresAt", "replayed"],
      additionalProperties: false,
    };
  if (path.startsWith("/webhooks/"))
    return {
      type: "object",
      description: "Idempotent webhook-ingestion result.",
      properties: {
        accepted: { type: "boolean", description: "Whether the event was accepted." },
        duplicate: {
          type: "boolean",
          description: "Whether the event was already processed.",
        },
        ignored: {
          type: "boolean",
          description: "Whether no eligible state transition existed.",
        },
      },
      required: ["accepted"],
      additionalProperties: false,
    };
  if (lower.includes("list") || lower.includes("search") || lower.includes("history"))
    return {
      type: "object",
      description: `Cursor-paginated result for: ${summary}.`,
      properties: {
        items: {
          type: "array",
          description: "Authorized resource projections for this page.",
          items: projectionSchema(`Safe item projection returned by ${summary}.`),
        },
        nextCursor: {
          type: ["string", "null"],
          format: "uuid",
          description: "Cursor for the next page, or null/omitted when exhausted.",
        },
      },
      required: ["items"],
      additionalProperties: false,
    };
  if (
    method === "delete" ||
    lower.includes("logout") ||
    lower.includes("resend") ||
    lower.includes("forgot") ||
    lower.includes("revoke") ||
    lower.includes("verify email") ||
    lower.includes("reset password")
  )
    return {
      type: "null",
      description: `No data field is returned for: ${summary}. Completion is expressed by the HTTP status and message.`,
    };
  return projectionSchema(`Authorized response projection for: ${summary}.`);
}

function ensureSuccessResponse(
  operation: JsonObject,
  path: string,
  method: string,
  summary: string,
): void {
  const responses = isObject(operation["responses"])
    ? operation["responses"]
    : (operation["responses"] = {} as JsonObject);
  const successCode =
    Object.keys(responses).find((code) => /^2\d\d$/u.test(code)) ?? "200";
  const response = isObject(responses[successCode])
    ? responses[successCode]
    : (responses[successCode] = { description: "Request completed successfully." });
  response["description"] = `Success: ${summary}.`;
  const content = isObject(response["content"])
    ? response["content"]
    : (response["content"] = {} as JsonObject);
  const media = isObject(content["application/json"])
    ? content["application/json"]
    : (content["application/json"] = {} as JsonObject);
  const schema = isObject(media["schema"])
    ? media["schema"]
    : (media["schema"] = {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          meta: {
            type: "object",
            properties: { requestId: { type: "string" } },
            required: ["requestId"],
          },
        },
        required: ["success", "message", "meta"],
      });
  const properties = isObject(schema["properties"])
    ? schema["properties"]
    : (schema["properties"] = {} as JsonObject);
  if (!isObject(properties["data"]) || Object.keys(properties["data"]).length === 0)
    properties["data"] = replacementDataSchema(path, method, summary);
  const required = new Set(Array.isArray(schema["required"]) ? schema["required"] : []);
  required.add("success");
  required.add("message");
  required.add("meta");
  schema["required"] = [...required];
  annotateSchema(schema, "response");
  const dataSchema = properties["data"];
  media["example"] = {
    success: true,
    message: summary,
    ...(isObject(dataSchema) && dataSchema["type"] === "null"
      ? {}
      : { data: exampleFromSchema(dataSchema, "data") }),
    meta: { requestId: "req_0000000000000001" },
  };
}

function errorResponse(description: string, code: string): JsonObject {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        example: {
          success: false,
          message: description,
          error: { code },
          meta: { requestId: "req_0000000000000001" },
        },
      },
    },
  };
}

function addErrorResponses(
  operation: JsonObject,
  path: string,
  method: string,
  secured: boolean,
): void {
  const responses = operation["responses"] as JsonObject;
  const candidates: Array<[string, string, string]> = [
    ["400", "The request is malformed.", "BAD_REQUEST"],
    ["422", "One or more request fields are invalid.", "VALIDATION_FAILED"],
    ["429", "The route-specific request limit was exceeded.", "RATE_LIMITED"],
    [
      "500",
      "An unexpected error occurred; no sensitive detail is disclosed.",
      "INTERNAL_ERROR",
    ],
  ];
  if (secured) {
    candidates.push(
      ["401", "A valid session and required assurance are missing.", "UNAUTHORIZED"],
      ["403", "The actor is not authorized for this resource or action.", "FORBIDDEN"],
    );
  }
  if (path.includes("{") || path.startsWith("/auth/email/") || path.includes("password"))
    candidates.push(["404", "The requested resource is not available.", "NOT_FOUND"]);
  if (MUTATION_METHODS.has(method))
    candidates.push([
      "409",
      "The request conflicts with current state or idempotency.",
      "CONFLICT",
    ]);
  if (path.includes("payments") || path.includes("webhooks"))
    candidates.push([
      "503",
      "A required provider or database is temporarily unavailable.",
      "PROVIDER_UNAVAILABLE",
    ]);
  for (const [status, description, code] of candidates)
    if (!isObject(responses[status]))
      responses[status] = errorResponse(description, code);
}

function errorResponseSchema(): JsonObject {
  return {
    type: "object",
    description: "Stable non-sensitive API error envelope.",
    properties: {
      success: { type: "boolean", const: false, description: "Always false for errors." },
      message: { type: "string", description: "Safe client-facing error message." },
      error: {
        type: "object",
        description: "Machine-readable failure details.",
        properties: {
          code: {
            type: "string",
            enum: Object.values(errorCodes),
            description: "Stable application error code.",
          },
          fields: {
            type: "object",
            description: "Optional validation messages keyed by field path.",
            additionalProperties: { type: "array", items: { type: "string" } },
          },
        },
        required: ["code"],
        additionalProperties: false,
      },
      meta: {
        type: "object",
        properties: {
          requestId: { type: "string", description: "Correlation ID for support." },
        },
        required: ["requestId"],
        additionalProperties: false,
      },
    },
    required: ["success", "message", "error", "meta"],
    additionalProperties: false,
  };
}

export function hardenOpenApiDocument<T>(document: T): T {
  if (!isObject(document)) return document;
  const root: JsonObject = document;
  const components = isObject(root["components"])
    ? root["components"]
    : (root["components"] = {} as JsonObject);
  const schemas = isObject(components["schemas"])
    ? components["schemas"]
    : (components["schemas"] = {} as JsonObject);
  schemas["ErrorResponse"] = errorResponseSchema();
  const paths = root["paths"];
  if (!isObject(paths)) return document;
  for (const [path, pathValue] of Object.entries(paths)) {
    if (!isObject(pathValue)) continue;
    for (const [method, operationValue] of Object.entries(pathValue)) {
      if (!HTTP_METHODS.has(method) || !isObject(operationValue)) continue;
      const summary =
        typeof operationValue["summary"] === "string"
          ? operationValue["summary"]
          : `${title(method)} ${title(path)}`;
      const secured =
        Array.isArray(operationValue["security"]) &&
        operationValue["security"].length > 0;
      const parameters = Array.isArray(operationValue["parameters"])
        ? operationValue["parameters"].filter(isObject)
        : [];
      const csrf = parameters.some(
        (parameter) => String(parameter["name"]).toLowerCase() === "x-csrf-token",
      );
      const idempotent = parameters.some(
        (parameter) => String(parameter["name"]).toLowerCase() === "idempotency-key",
      );
      const access = accessFor(path, secured);
      operationValue["operationId"] = operationId(method, path);
      operationValue["description"] = [
        `${summary}.`,
        `Access boundary: ${access.boundary}.`,
        secured
          ? "Requires the opaque session cookie."
          : "Does not accept browser bearer tokens.",
        csrf
          ? "Requires a current session-bound CSRF header."
          : "No CSRF token is required.",
        idempotent
          ? "Requires an Idempotency-Key; a key may only be replayed with the identical request."
          : "This operation has no idempotency-key contract.",
      ].join(" ");
      operationValue["x-access-boundary"] = access.boundary;
      operationValue["x-required-roles"] = access.roles;
      operationValue["x-csrf-required"] = csrf;
      operationValue["x-idempotency-required"] = idempotent;
      for (const parameter of parameters) {
        const name = String(parameter["name"] ?? "value");
        const location = String(parameter["in"] ?? "request");
        parameter["description"] = parameterDescription(name, location);
        if (isObject(parameter["schema"])) {
          annotateSchema(parameter["schema"], name);
          parameter["example"] = syntheticValue(name, parameter["schema"]);
        }
      }
      const requestBody = operationValue["requestBody"];
      if (isObject(requestBody) && isObject(requestBody["content"])) {
        requestBody["required"] = true;
        const media = requestBody["content"]["application/json"];
        if (isObject(media) && isObject(media["schema"])) {
          annotateSchema(media["schema"], "request body");
          media["example"] = exampleFromSchema(media["schema"], "request body");
        }
      }
      ensureSuccessResponse(operationValue, path, method, summary);
      addErrorResponses(operationValue, path, method, secured);
    }
  }
  return document;
}
