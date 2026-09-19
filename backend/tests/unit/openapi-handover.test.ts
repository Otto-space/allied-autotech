import { describe, expect, it } from "vitest";

import { createOpenApiDocument } from "../../src/openapi/document.js";
import { createApiHandbook } from "../../src/openapi/handbook.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("private API handover contract", () => {
  it("fully describes every operation and generates one handbook entry per operation", () => {
    const document = createOpenApiDocument({
      sessionCookieName: "__Host-aat_session",
    }) as unknown as JsonObject;
    const paths = document["paths"] as JsonObject;
    const identifiers = new Set<string>();
    let operationCount = 0;

    for (const [path, pathValue] of Object.entries(paths)) {
      if (!isObject(pathValue)) continue;
      for (const [method, operation] of Object.entries(pathValue)) {
        if (
          !isObject(operation) ||
          !["get", "post", "put", "patch", "delete"].includes(method)
        )
          continue;
        operationCount += 1;
        const id = operation["operationId"];
        expect(id, `${method.toUpperCase()} ${path}`).toEqual(expect.any(String));
        expect(identifiers.has(String(id)), String(id)).toBe(false);
        identifiers.add(String(id));
        expect(operation["description"], String(id)).toEqual(expect.any(String));
        expect(operation["x-required-roles"], String(id)).toEqual(expect.any(Array));
        expect(operation["x-csrf-required"], String(id)).toEqual(expect.any(Boolean));
        expect(operation["x-idempotency-required"], String(id)).toEqual(
          expect.any(Boolean),
        );

        const responses = operation["responses"] as JsonObject;
        const success = Object.entries(responses).find(([status]) =>
          /^2\d\d$/u.test(status),
        );
        expect(success, String(id)).toBeDefined();
        const response = success?.[1] as JsonObject;
        const content = response["content"] as JsonObject;
        const media = content["application/json"] as JsonObject;
        const schema = media["schema"] as JsonObject;
        const properties = schema["properties"] as JsonObject;
        expect(
          Object.keys(properties["data"] as JsonObject).length,
          String(id),
        ).toBeGreaterThan(0);
        expect(media["example"], String(id)).toBeDefined();
      }
    }

    const handbook = createApiHandbook(document);
    const handbookOperations = handbook.match(
      /^### (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) `/gmu,
    );
    expect(operationCount).toBe(231);
    expect(handbookOperations).toHaveLength(operationCount);
    expect(handbook).toContain("Never do this client-side");
    expect(handbook).toContain("Provider signature plus authoritative verification");
  });
});
