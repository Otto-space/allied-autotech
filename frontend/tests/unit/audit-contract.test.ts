import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditActions,
  auditEntities,
  parseAuditEvents,
  currentAuditRecord,
} from "@/lib/api/audit-schemas";
import {
  auditFilterSchema,
  auditQuery,
  emptyAuditFilters,
} from "@/lib/forms/audit-filters";
const document = JSON.parse(
  readFileSync(
    new URL("../../../backend/docs/api/allied-autotech.openapi.json", import.meta.url),
    "utf8",
  ),
);
const parameters = document.paths["/admin/audit"].get.parameters as {
  name: string;
  schema: { enum?: string[] };
}[];
const id = "d0000000-0000-4000-8000-000000000001";
describe("Audit enum contract coverage", () => {
  it("keeps every action and entity option from the exported backend contract", () => {
    expect([...auditActions].sort()).toEqual(
      parameters.find((p) => p.name === "action")!.schema.enum!.toSorted(),
    );
    expect([...auditEntities].sort()).toEqual(
      parameters.find((p) => p.name === "entityType")!.schema.enum!.toSorted(),
    );
  });
  it("accepts mixed failed-login, booking-slot and service-category events and submits their exact filters", () => {
    const values = [
      { action: "LOGIN_FAILED", entityType: "USER" },
      { action: "CREATE", entityType: "BOOKING_SLOT" },
      { action: "UPDATE", entityType: "SERVICE_CATEGORY" },
    ] as const;
    const page = parseAuditEvents({
      items: values.map((v) => ({
        ...v,
        id,
        userId: null,
        entityId: id,
        requestId: null,
        oldValues: null,
        newValues: { nested: [false, 0, null] },
        createdAt: "2026-01-01T00:00:00Z",
        user: null,
      })),
      nextCursor: id,
    });
    expect(page.items).toHaveLength(3);
    for (const item of page.items) {
      expect(
        auditQuery(
          auditFilterSchema.parse({
            ...emptyAuditFilters,
            action: item.action,
            entityType: item.entityType,
          }),
        ),
      ).toMatchObject({ action: item.action, entityType: item.entityType });
      expect(currentAuditRecord(item)).toBeUndefined();
    }
  });
  it("continues rejecting unknown actions and entity types", () => {
    for (const value of [{ action: "INVENTED" }, { entityType: "INVENTED" }])
      expect(
        auditFilterSchema.safeParse({ ...emptyAuditFilters, ...value }).success,
      ).toBe(false);
  });
});
