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
        expect(responses["503"], `${method.toUpperCase()} ${path}`).toBeDefined();
        const success = Object.entries(responses).find(([status]) =>
          /^2\d\d$/u.test(status),
        );
        expect(success, String(id)).toBeDefined();
        const response = success?.[1] as JsonObject;
        const content = response["content"] as JsonObject;
        if (content["text/html"]) {
          expect(path).toBe("/public/booking-response");
          const html = content["text/html"] as JsonObject;
          expect(html["schema"]).toMatchObject({ type: "string" });
          expect(html["example"]).toEqual(expect.any(String));
          expect(operation["description"]).toContain("GET never mutates");
          continue;
        }
        const media = content["application/json"] as JsonObject;
        if (content["application/pdf"]) {
          expect(media).toBeUndefined();
          expect(content["application/pdf"]).toMatchObject({
            schema: { type: "string", format: "binary" },
          });
          expect(operation["description"]).toContain("Ownership is checked");
          continue;
        }
        if (content["image/webp"]) {
          expect(media).toBeUndefined();
          expect(content["image/webp"]).toMatchObject({
            schema: { type: "string", format: "binary" },
          });
          expect(operation["description"]).toContain("no-store");
          continue;
        }
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
    for (const path of [
      "/customers/invoices/{invoiceId}/document",
      "/customers/invoices/{invoiceId}/download",
      "/customers/payments/{paymentId}/receipt/document",
      "/customers/payments/{paymentId}/receipt",
    ]) {
      expect(paths[path], path).toBeDefined();
    }
    expect(operationCount).toBe(314);
    expect(handbookOperations).toHaveLength(operationCount);
    expect(handbook).toContain("Never do this client-side");
    expect(handbook).toContain("Provider signature plus authoritative verification");
    expect(handbook).toContain("application/pdf");
  });

  it("preserves optional creation retry rules while keeping reservation keys mandatory", () => {
    const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
    for (const path of [
      "/customers/vehicle-inspections",
      "/customers/vehicle-transactions",
    ]) {
      const operation = document.paths[path]?.post;
      expect(operation).toMatchObject({ "x-idempotency-required": false });
      expect(operation?.description).toContain("optional Idempotency-Key");
      expect(operation?.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "idempotency-key",
            required: false,
            description: expect.stringContaining("24 hours"),
          }),
        ]),
      );
      expect(operation?.responses["409"]).toMatchObject({
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
        },
      });
    }
    expect(
      document.paths["/customers/vehicle-transactions/{transactionId}/reserve"]?.post,
    ).toMatchObject({ "x-idempotency-required": true });
  });
  it("documents bounded saved-vehicle pages, customer access and invalid cursor recovery", () => {
    const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
    const operation = document.paths["/customers/saved-vehicles/page"]?.get;
    expect(operation?.security).toEqual([{ sessionCookie: [] }]);
    expect(operation?.description).toContain("cross-customer cursors return 422");
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "limit",
          in: "query",
          schema: expect.objectContaining({
            default: "12",
            pattern: "^(?:[1-9]|[1-4][0-9]|50)$",
          }),
        }),
        expect.objectContaining({
          name: "cursor",
          in: "query",
          schema: expect.objectContaining({ maxLength: 101 }),
        }),
      ]),
    );
    expect(operation?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            properties: {
              data: {
                properties: {
                  items: {
                    type: "array",
                    maxItems: 50,
                    items: {
                      properties: {
                        vehicleListing: { properties: { priceKobo: { type: "string" } } },
                      },
                    },
                  },
                  nextCursor: { type: "string", maxLength: 101 },
                },
              },
            },
          },
        },
      },
    });
    expect(operation?.responses["422"]).toBeDefined();
    expect(document.paths["/customers/saved-vehicles"]?.get).toBeDefined();
  });
  it.each(["/public/vehicles", "/public/catalog/products"])(
    "publishes typed anonymous discovery totals and bounded options for %s",
    (prefix) => {
      const document = createOpenApiDocument({ sessionCookieName: "__Host-aat_session" });
      const discovery = document.paths[`${prefix}/discovery`]?.get;
      const facets =
        document.paths[
          prefix === "/public/vehicles" ? `${prefix}/facets` : "/public/catalog/facets"
        ]?.get;
      expect(discovery?.security).toBeUndefined();
      expect(facets?.security).toBeUndefined();
      expect(discovery?.responses["200"]).toMatchObject({
        content: {
          "application/json": {
            schema: {
              properties: {
                data: {
                  properties: {
                    totalMatches: { type: "integer", minimum: 0 },
                    items: { maxItems: 50 },
                  },
                },
              },
            },
          },
        },
      });
      expect(facets?.responses["200"]).toMatchObject({
        content: {
          "application/json": {
            schema: {
              properties: {
                data: {
                  properties: {
                    items: {
                      maxItems: 50,
                      items: {
                        properties: {
                          value: { type: "string" },
                          label: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(discovery?.description).toContain("repeatable-read");
      expect(facets?.description).toContain("literal case-insensitive prefix");
      expect(discovery?.responses["422"]).toBeDefined();
      expect(facets?.responses["422"]).toBeDefined();
    },
  );
});
