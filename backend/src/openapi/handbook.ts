type JsonObject = Record<string, unknown>;

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
const GROUP_ORDER = [
  "Public API",
  "Authentication",
  "Customer API",
  "Staff API",
  "Administration",
  "Payment webhooks",
  "Operational",
] as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function groupFor(path: string): (typeof GROUP_ORDER)[number] {
  if (path.startsWith("/public/")) return "Public API";
  if (path.startsWith("/auth/")) return "Authentication";
  if (path.startsWith("/customers/")) return "Customer API";
  if (path.startsWith("/staff/")) return "Staff API";
  if (path.startsWith("/admin/")) return "Administration";
  if (path.startsWith("/webhooks/")) return "Payment webhooks";
  return "Operational";
}

function schemaType(schema: unknown): string {
  if (!isObject(schema)) return "unknown";
  if (typeof schema["$ref"] === "string")
    return schema["$ref"].split("/").at(-1) ?? "object";
  if (Array.isArray(schema["enum"])) return schema["enum"].map(String).join(" / ");
  if (Array.isArray(schema["type"])) return schema["type"].join(" / ");
  if (schema["type"] === "array") return `array<${schemaType(schema["items"])}>`;
  const base = typeof schema["type"] === "string" ? schema["type"] : "object";
  return typeof schema["format"] === "string" ? `${base} (${schema["format"]})` : base;
}

function compact(value: unknown): string {
  return `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function requestFields(operation: JsonObject): string[] {
  const body = operation["requestBody"];
  if (!isObject(body) || !isObject(body["content"])) return [];
  const media = body["content"]["application/json"];
  if (!isObject(media) || !isObject(media["schema"])) return [];
  const schema = media["schema"];
  const properties = schema["properties"];
  if (!isObject(properties)) return [];
  const required = new Set(Array.isArray(schema["required"]) ? schema["required"] : []);
  return [
    "| Field | Type | Required | Purpose |",
    "| --- | --- | --- | --- |",
    ...Object.entries(properties).map(([name, value]) => {
      const description =
        isObject(value) && typeof value["description"] === "string"
          ? value["description"]
          : "Validated request value.";
      return `| \`${name}\` | ${schemaType(value)} | ${required.has(name) ? "Yes" : "No"} | ${description.replaceAll("|", "\\|")} |`;
    }),
  ];
}

function parameterRows(operation: JsonObject): string[] {
  if (!Array.isArray(operation["parameters"]) || operation["parameters"].length === 0)
    return [];
  return [
    "| Parameter | Location | Type | Required | Purpose |",
    "| --- | --- | --- | --- | --- |",
    ...operation["parameters"].filter(isObject).map((parameter) => {
      const schema = parameter["schema"];
      const description =
        typeof parameter["description"] === "string"
          ? parameter["description"]
          : "Validated request parameter.";
      return `| \`${String(parameter["name"])}\` | ${String(parameter["in"])} | ${schemaType(schema)} | ${parameter["required"] === true ? "Yes" : "No"} | ${description.replaceAll("|", "\\|")} |`;
    }),
  ];
}

function responseDetails(operation: JsonObject): {
  status: string;
  example: unknown;
  errors: string;
} {
  const responses = isObject(operation["responses"]) ? operation["responses"] : {};
  const success = Object.entries(responses).find(([status]) => /^2\d\d$/u.test(status));
  const successResponse = success && isObject(success[1]) ? success[1] : {};
  const content = isObject(successResponse["content"]) ? successResponse["content"] : {};
  const media = isObject(content["application/json"]) ? content["application/json"] : {};
  const errors = Object.entries(responses)
    .filter(([status]) => /^[45]\d\d$/u.test(status))
    .map(
      ([status, response]) =>
        `${status} ${isObject(response) ? String(response["description"] ?? "Request failed.") : "Request failed."}`,
    )
    .join("; ");
  return {
    status: success?.[0] ?? "200",
    example: media["example"] ?? {},
    errors,
  };
}

function operationMarkdown(method: string, path: string, operation: JsonObject): string {
  const parameters = parameterRows(operation);
  const fields = requestFields(operation);
  const requestBody = isObject(operation["requestBody"])
    ? operation["requestBody"]
    : undefined;
  const bodyContent =
    requestBody && isObject(requestBody["content"]) ? requestBody["content"] : undefined;
  const bodyMedia =
    bodyContent && isObject(bodyContent["application/json"])
      ? bodyContent["application/json"]
      : undefined;
  const response = responseDetails(operation);
  const roles = Array.isArray(operation["x-required-roles"])
    ? operation["x-required-roles"].join(", ")
    : "See authorization policy";
  const authentication =
    Array.isArray(operation["security"]) && operation["security"].length > 0
      ? "Opaque session cookie"
      : path.startsWith("/webhooks/")
        ? "Provider signature plus authoritative verification"
        : "None";
  return [
    `### ${method.toUpperCase()} \`${path}\``,
    "",
    `- Operation ID: \`${String(operation["operationId"])}\``,
    `- Purpose: ${String(operation["description"])}`,
    `- Roles: ${roles}`,
    `- Authentication: ${authentication}`,
    `- CSRF: ${operation["x-csrf-required"] === true ? "Required in `X-CSRF-Token`" : "Not required"}`,
    `- Idempotency: ${operation["x-idempotency-required"] === true ? "Required in `Idempotency-Key`" : "Not required"}`,
    ...(parameters.length > 0 ? ["", "Parameters:", "", ...parameters] : []),
    ...(fields.length > 0 ? ["", "JSON request fields:", "", ...fields] : []),
    ...(bodyMedia
      ? ["", "Synthetic request example:", compact(bodyMedia["example"] ?? {})]
      : []),
    "",
    `Success: HTTP ${response.status}.`,
    compact(response.example),
    "",
    `Relevant errors: ${response.errors || "No operation-specific error response."}`,
    "",
  ].join("\n");
}

const HANDBOOK_INTRODUCTION = `# Allied AutoTech private API handbook

This handbook is generated from the same hardened OpenAPI document as the private JSON artifact. The canonical base path is \`/api/v1\`. Hosted staging and production must keep Swagger and \`/openapi.json\` disabled; run the backend locally with \`API_DOCS_ENABLED=true\` when interactive Swagger is needed.

## Browser security contract

- Send relative same-origin requests such as \`fetch("/api/v1/auth/session", { credentials: "include", cache: "no-store" })\`. Vercel forwards \`/api/v1/*\` to the DigitalOcean API.
- Authentication uses an opaque \`HttpOnly\` cookie. JavaScript must never read, copy, persist, or replace it, and must not add browser bearer/JWT storage.
- After login or any session rotation, call \`POST /api/v1/auth/csrf\`. Keep the returned CSRF value in memory only and send it as \`X-CSRF-Token\` on every authenticated mutation.
- Use a cryptographically random \`Idempotency-Key\` for operations marked idempotent. Retrying the same logical request reuses the key and exact body; a different body requires a new key.
- Money values ending in \`Kobo\` are base-10 integer strings. Never calculate authoritative prices, discounts, deposits, refunds, invoice totals, or currencies in the browser.
- Authenticated responses are \`Cache-Control: no-store\`. Render error messages as text, keep \`requestId\` for support, and never render provider payloads as HTML.

## Pagination

List routes use bounded cursor pagination. Pass the returned \`nextCursor\` as \`cursor\`; never construct or modify cursors. Treat a missing/null cursor as the final page.

## Customer workflows

### Registration, verification, login, MFA, recovery and logout

1. Submit customer registration. The generic accepted response intentionally does not confirm whether an email already exists.
2. Verification links put the raw token in the frontend URL fragment. The frontend reads it once, posts it to \`/auth/email/verify\`, clears the fragment, and never logs or persists it.
3. Login sets the opaque cookie. If \`mfaRequired\` is true, show only the MFA challenge/logout UI until a TOTP, WebAuthn, or recovery-code challenge succeeds.
4. Obtain a fresh CSRF value after login/MFA/session rotation. Password change and factor administration require the documented reauthentication and assurance.
5. Forgot/reset flows remain enumeration-safe. Reset tokens follow the same URL-fragment rule. Logout requires CSRF and clears the local in-memory CSRF value.

### Branches, services, published slots and booking requests

1. Read public branches, services, published slots and the current booking policy.
2. Submit the slot, current policy version and an idempotency key. New bookings are REQUESTED with no booking deposit.
3. Staff with BOOKING_CONFIRM records resource review; the server enforces approved branch capacity/calendar and overlaps before confirmation.
4. One transactional email reminder is enqueued one hour before the appointment. Confirmation less than one hour ahead uses an immediate reminder fallback. GET links only render a screen; the signed POST confirms attendance or cancels free.
5. Rescheduling invalidates earlier links/reminders and returns the appointment to staff review. No response never auto-cancels or incurs a fee. Historical deposit records remain protected.

### Orders, invoices, vehicles and payments

- Checkout sends product identifiers/quantities and accepts only server-calculated price, promotion, inventory and currency results.
- Invoices are immutable snapshots. Never alter totals or assume an unpaid invoice is settled because checkout returned successfully.
- Vehicle documents, condition reports, handovers and payment evidence use authorized short-lived access; never expose or persist object keys.
- Manual payment submission does not settle a payment. It creates a review requiring an independent approver.

### Reviews, notifications and support

- Customers can submit rated overall-business, product, service and eligible transaction reviews. Public review results expose moderated anonymous projections only.
- Fetch and update notification state through the customer routes; preferences affect optional operational messages; essential messages remain enabled and marketing execution stays disabled.
- Support chat uses authenticated five-second cursor polling. Stop polling when hidden/offline, resume with the last cursor, and never request another customer's conversation.

## Staff, administration and four-eyes controls

Staff/admin operations require an MFA-verified session and default-deny role, branch, ownership and lifecycle policies. A manual-payment submitter cannot approve that payment, and a refund requester cannot approve the same refund. The UI must present the server's conflict/forbidden response rather than trying to bypass separation of duties.

## Webhook restrictions

Paystack calls the DigitalOcean API origin directly; Monnify remains disabled, not Vercel. Browser code must never invoke webhook routes. The API verifies exact raw bytes, signature policy, reference, amount, currency, state and provider truth; duplicate, late or mismatched events are idempotently recorded or escalated as anomalies.

## Never do this client-side

- Never store session cookies, CSRF values, verification/reset tokens, MFA secrets, checkout state or authorization URLs in localStorage/sessionStorage.
- Never embed provider secret keys, webhook secrets, storage credentials or private object keys.
- Never trust a redirect query string, client-calculated total, client-supplied customer ID, role, status or resource owner.
- Never send webhook traffic through frontend rewrites or parse it before backend signature verification.
- Never expose hosted API docs publicly or use real customer/payment data in fixtures.
`;

export function createApiHandbook(document: unknown): string {
  if (!isObject(document) || !isObject(document["paths"]))
    throw new Error("Cannot generate the API handbook from an invalid OpenAPI document");
  const grouped = new Map<string, string[]>();
  for (const group of GROUP_ORDER) grouped.set(group, []);
  for (const [path, pathValue] of Object.entries(document["paths"])) {
    if (!isObject(pathValue)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathValue[method];
      if (!isObject(operation)) continue;
      grouped.get(groupFor(path))?.push(operationMarkdown(method, path, operation));
    }
  }
  return `${HANDBOOK_INTRODUCTION.trim()}\n\n${GROUP_ORDER.map(
    (group) => `## ${group}\n\n${grouped.get(group)?.join("\n") ?? ""}`,
  ).join("\n\n")}\n`;
}
