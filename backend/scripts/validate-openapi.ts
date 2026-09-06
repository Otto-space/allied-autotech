import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publicApiPaths } from "../src/common/contracts/public-api.js";
import { createOpenApiDocument } from "../src/openapi/document.js";

type JsonObject = Record<string, unknown>;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(
  scriptDirectory,
  "..",
  "docs",
  "api",
  "allied-autotech.openapi.json",
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

for (const [path, pathValue] of Object.entries(paths)) {
  if (!isObject(pathValue)) continue;
  for (const [method, operationValue] of Object.entries(pathValue)) {
    if (!httpMethods.has(method) || !isObject(operationValue)) continue;
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

if (failures.length > 0) {
  failures.forEach((failure) => process.stderr.write(`${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(
    `OpenAPI validation passed for ${String(Object.keys(paths).length)} paths.\n`,
  );
}
