import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = await readFile(
  path.join(root, "../backend/docs/api/allied-autotech.openapi.json"),
  "utf8",
);
const spec = JSON.parse(raw);
const methods = new Set(["get", "post", "put", "patch", "delete"]);
const overrides = JSON.parse(
  await readFile(path.join(root, "docs/api-coverage-status.json"), "utf8"),
);
async function sources(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const name = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...(await sources(name)));
    else if (/\.(tsx?|mjs)$/.test(name) && !name.endsWith(".d.ts"))
      result.push({
        name: path.relative(root, name).replaceAll("\\", "/"),
        content: await readFile(name, "utf8"),
      });
  }
  return result;
}
const files = [
  ...(await sources(path.join(root, "app"))),
  ...(await sources(path.join(root, "lib"))),
];
const inventory = [];
const operationalRoutes = [
  {
    method: "GET",
    path: "/api/v1/health",
    purpose: "Database readiness",
    success: "200 standard success envelope",
    errors: "503 DATABASE_UNAVAILABLE",
  },
  {
    method: "GET",
    path: "/api/v1/health/ready",
    purpose: "Database readiness",
    success: "200 standard success envelope",
    errors: "503 DATABASE_UNAVAILABLE",
  },
  {
    method: "GET",
    path: "/api/v1/health/live",
    purpose: "Process liveness",
    success: "200 standard success envelope",
    errors: "Shared rate-limit and infrastructure failures",
  },
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    purpose: "Conditional API documentation",
    success: "200 OpenAPI document only when API_DOCS_ENABLED",
    errors: "404 when disabled",
  },
  {
    method: "GET",
    path: "/api/v1/docs (and documentation assets)",
    purpose: "Conditional Swagger UI",
    success: "HTML/static assets only when API_DOCS_ENABLED",
    errors: "404 when disabled",
  },
].map((route) => ({
  ...route,
  audience: "operational",
  authentication: "No session required; documentation controlled by server environment",
  parameters: "No business request body or parameters",
  cache: "API router uses private, no-store; document explicitly uses no-store",
  screen: "None: infrastructure and developer tooling only",
  implementation: "Deliberately not called by customer UI",
  verification:
    "Inspected src/routes/index.ts and modules/health; baseline backend tests passed; isolated full suite in progress",
}));
for (const [route, operations] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!methods.has(method)) continue;
    const key = `${method.toUpperCase()} ${route}`;
    const audience =
      route.startsWith("/admin/operations") || route === "/admin/audit"
        ? "operational"
        : route.startsWith("/webhooks")
          ? "webhook"
          : route.startsWith("/public")
            ? "shared"
            : route.startsWith("/auth")
              ? "shared"
              : route.startsWith("/customers")
                ? "customer-facing"
                : "administrator-facing";
    const prefix = route.split("/{")[0];
    const candidates = files
      .filter((file) => file.content.includes(prefix))
      .map((file) => file.name);
    const status = overrides[key] ?? {
      implementation:
        audience === "webhook"
          ? "Excluded: direct provider-to-backend delivery; never called by a browser."
          : "Pending explicit integration audit",
      verification: "Not yet verified",
      screen: "Pending mapping",
    };
    inventory.push({
      operationId: operation.operationId,
      method: method.toUpperCase(),
      path: `/api/v1${route}`,
      purpose: operation.summary,
      audience,
      accessBoundary: operation["x-access-boundary"],
      roles: operation["x-required-roles"] ?? [],
      security: operation.security ?? [],
      csrf: operation["x-csrf-required"] ?? false,
      idempotency: operation["x-idempotency-required"] ?? false,
      parameters: operation.parameters ?? [],
      request: operation.requestBody?.content?.["application/json"]?.schema ?? null,
      responses: Object.fromEntries(
        Object.entries(operation.responses ?? {}).map(([code, response]) => [
          code,
          {
            description: response.description,
            schema: response.content?.["application/json"]?.schema ?? null,
          },
        ]),
      ),
      cache:
        "All browser API requests use no-store. Account-scoped data must be discarded on session change. Refresh the affected resource after a confirmed mutation; never optimistically confirm money or stock.",
      sourceCandidates: candidates,
      ...status,
    });
  }
}
await mkdir(path.join(root, "docs"), { recursive: true });
await writeFile(
  path.join(root, "docs/api-coverage.json"),
  JSON.stringify(
    {
      source: "../backend/docs/api/allied-autotech.openapi.json",
      sourceSha256: createHash("sha256").update(raw).digest("hex"),
      note: "Private contract inventory. Source candidates are search hints, not proof of consumption. Response schemas with additionalProperties may be incomplete; reconcile serializers. Operational routes outside OpenAPI are tracked in the Markdown inventory.",
      operations: inventory,
      operationalRoutes,
    },
    null,
    2,
  ) + "\n",
);
const rows = inventory.map(
  (item) =>
    `| ${item.method} \`${item.path}\` | ${item.audience} | ${item.screen} | ${item.implementation} | ${item.verification} |`,
);
const operationalRows = operationalRoutes
  .map(
    (route) =>
      `| ${route.method} \`${route.path}\` | ${route.purpose} | ${route.success}; ${route.errors} |`,
  )
  .join("\n");
await writeFile(
  path.join(root, "docs/api-coverage.md"),
  `# API coverage inventory\n\nGenerated by \`npm run api:inventory\`. ${inventory.length} OpenAPI operations plus ${operationalRoutes.length} operational route groups. Exact request validation, response schemas, status codes, permissions, CSRF, idempotency and caching are in [api-coverage.json](api-coverage.json), keyed by method/path. Detailed backend explanation: [endpoint handbook](../../backend/docs/api/endpoint-handbook.md).\n\nNo browser request is added solely for coverage. Pending means unfinished work, not a verified unavailable feature. Search candidates in JSON are deliberately not counted as integrations.\n\n| Endpoint | Audience | Screen | Implementation | Verification |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\n## Operational routes outside OpenAPI\n\nInspected in the backend router. No customer screen consumes these routes. Documentation is available only when API_DOCS_ENABLED; production documentation must remain disabled. No business request parameters or session are required. API responses use no-store.\n\n| Route | Purpose | Responses |\n| --- | --- | --- |\n${operationalRows}\n`,
);
console.log(`Inventoried ${inventory.length} operations.`);
