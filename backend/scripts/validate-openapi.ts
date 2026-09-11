import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publicApiPaths } from "../src/common/contracts/public-api.js";
import { createOpenApiDocument } from "../src/openapi/document.js";
import { createApiHandbook } from "../src/openapi/handbook.js";

type JsonObject = Record<string, unknown>;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "allied-autotech.openapi.json",
);
const handbookPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "endpoint-handbook.md",
);
const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
const root = document as unknown;
const failures: string[] = [];

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectAt(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new Error(`OpenAPI document is missing ${label}`);
  return value;
}

function resolveLocalReference(reference: string): boolean {
  if (!reference.startsWith("#/")) return false;
  let current: unknown = root;
  for (const encodedSegment of reference.slice(2).split("/")) {
    const segment = encodedSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !Object.hasOwn(current, segment)) return false;
    current = current[segment];
  }
  return true;
}

function inspect(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(inspect);
    return;
  }
  if (!isObject(value)) return;
  if (typeof value["$ref"] === "string" && !resolveLocalReference(value["$ref"])) {
    failures.push(`Unresolved OpenAPI reference: ${value["$ref"]}`);
  }
  Object.values(value).forEach(inspect);
}

const components = objectAt(objectAt(root, "document")["components"], "components");
const securitySchemes = objectAt(components["securitySchemes"], "security schemes");
const paths = objectAt(objectAt(root, "document")["paths"], "paths");
const httpMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const mutationMethods = new Set(["post", "put", "patch", "delete"]);
const operationIds = new Set<string>();

function successResponse(operation: JsonObject): JsonObject | undefined {
  const responses = operation["responses"];
  if (!isObject(responses)) return undefined;
  const success = Object.entries(responses).find(([status]) => /^2\d\d$/u.test(status));
  return success && isObject(success[1]) ? success[1] : undefined;
}

function hasHeader(operation: JsonObject, expected: string): boolean {
  if (!Array.isArray(operation["parameters"])) return false;
  return operation["parameters"].some(
    (parameter) =>
      isObject(parameter) &&
      parameter["in"] === "header" &&
      String(parameter["name"]).toLowerCase() === expected,
  );
}

for (const [path, pathValue] of Object.entries(paths)) {
  if (!isObject(pathValue)) continue;
  for (const [method, operationValue] of Object.entries(pathValue)) {
    if (!httpMethods.has(method) || !isObject(operationValue)) continue;
    const label = `${method.toUpperCase()} ${path}`;
    const id = operationValue["operationId"];
    if (typeof id !== "string" || id.length < 3)
      failures.push(`Missing stable operationId on ${label}`);
    else if (operationIds.has(id))
      failures.push(`Duplicate operationId ${id} on ${label}`);
    else operationIds.add(id);
    if (
      typeof operationValue["description"] !== "string" ||
      operationValue["description"].trim().length < 20
    )
      failures.push(`Missing useful description on ${label}`);
    if (!Array.isArray(operationValue["x-required-roles"]))
      failures.push(`Missing role/access declaration on ${label}`);
    if (typeof operationValue["x-csrf-required"] !== "boolean")
      failures.push(`Missing CSRF declaration on ${label}`);
    if (typeof operationValue["x-idempotency-required"] !== "boolean")
      failures.push(`Missing idempotency declaration on ${label}`);
    const secured =
      Array.isArray(operationValue["security"]) && operationValue["security"].length > 0;
    if (
      secured &&
      mutationMethods.has(method) &&
      !hasHeader(operationValue, "x-csrf-token")
    )
      failures.push(`Cookie-authenticated mutation lacks CSRF header on ${label}`);
    if (
      operationValue["x-idempotency-required"] === true &&
      !hasHeader(operationValue, "idempotency-key")
    )
      failures.push(`Idempotent operation lacks Idempotency-Key header on ${label}`);
    if (Array.isArray(operationValue["parameters"])) {
      for (const parameter of operationValue["parameters"]) {
        if (!isObject(parameter)) continue;
        if (typeof parameter["description"] !== "string")
          failures.push(`Undescribed parameter on ${label}`);
        if (parameter["example"] === undefined)
          failures.push(`Parameter lacks a synthetic example on ${label}`);
      }
    }
    const requestBody = operationValue["requestBody"];
    if (isObject(requestBody)) {
      const content = requestBody["content"];
      const media = isObject(content) ? content["application/json"] : undefined;
      if (!isObject(media) || !isObject(media["schema"]))
        failures.push(`Request body lacks an application/json schema on ${label}`);
      else if (media["example"] === undefined)
        failures.push(`Request body lacks a synthetic example on ${label}`);
    }
    const success = successResponse(operationValue);
    const successContent = success?.["content"];
    const successMedia = isObject(successContent)
      ? successContent["application/json"]
      : undefined;
    const successSchema = isObject(successMedia) ? successMedia["schema"] : undefined;
    if (!isObject(successMedia) || !isObject(successSchema))
      failures.push(`Success response lacks an application/json schema on ${label}`);
    else {
      const properties = successSchema["properties"];
      const data = isObject(properties) ? properties["data"] : undefined;
      if (!isObject(data) || Object.keys(data).length === 0)
        failures.push(
          `Success response has an empty or unexplained data schema on ${label}`,
        );
      if (successMedia["example"] === undefined)
        failures.push(`Success response lacks a synthetic example on ${label}`);
    }
    const documentedResponses = isObject(operationValue["responses"])
      ? operationValue["responses"]
      : {};
    for (const requiredError of ["422", "429", "500"])
      if (!isObject(documentedResponses[requiredError]))
        failures.push(`Missing documented ${requiredError} error on ${label}`);
    if (!Array.isArray(operationValue["security"])) continue;
    for (const requirement of operationValue["security"]) {
      if (!isObject(requirement)) continue;
      for (const scheme of Object.keys(requirement)) {
        if (!Object.hasOwn(securitySchemes, scheme)) {
          failures.push(
            `Unknown security scheme ${scheme} on ${method.toUpperCase()} ${path}`,
          );
        }
      }
    }
  }
}

for (const path of [
  publicApiPaths.branches,
  publicApiPaths.branch,
  publicApiPaths.services,
  publicApiPaths.service,
]) {
  const operation = objectAt(objectAt(paths[path], path)["get"], `GET ${path}`);
  if (Array.isArray(operation["security"]) && operation["security"].length > 0) {
    failures.push(`Public operation unexpectedly requires authentication: GET ${path}`);
  }
}

inspect(root);

const serialized = `${JSON.stringify(document, null, 2)}\n`;
let artifact: string;
try {
  artifact = readFileSync(artifactPath, "utf8");
} catch (error: unknown) {
  throw new Error("The private OpenAPI artifact is missing; run npm run openapi:export", {
    cause: error,
  });
}
if (artifact !== serialized) {
  failures.push("The private OpenAPI artifact is stale; run npm run openapi:export");
}
let handbook: string;
try {
  handbook = readFileSync(handbookPath, "utf8");
} catch (error: unknown) {
  throw new Error("The endpoint handbook is missing; run npm run openapi:export", {
    cause: error,
  });
}
if (handbook !== createApiHandbook(document)) {
  failures.push("The endpoint handbook is stale; run npm run openapi:export");
}

if (failures.length > 0) {
  failures.forEach((failure) => process.stderr.write(`${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(
    `OpenAPI validation passed for ${String(Object.keys(paths).length)} paths.\n`,
  );
}
