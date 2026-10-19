import { z } from "zod";
import { auditEventSchema, type AuditQuery } from "@/lib/api/audit-schemas";
export function auditLabel(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
const values = z.record(z.string(), z.json()).nullable();
const row = auditEventSchema.extend({ oldValues: values, newValues: values, user: auditEventSchema.shape.user.unwrap().strict().nullable() }).strict();
export function parseWorkAudit(value: unknown, query: AuditQuery) {
  const page = z.object({ items: z.array(row).max(25), nextCursor: z.uuid().optional() }).strict().parse(value);
  const ids = new Set<string>();
  for (const [index, event] of page.items.entries()) {
    if (ids.has(event.id) || (event.userId === null && event.user !== null)) throw Error("Invalid audit identity");
    ids.add(event.id);
    for (const key of ["userId", "entityId", "requestId", "action", "entityType"] as const)
      if (query[key] !== undefined && event[key] !== query[key]) throw Error("Unexpected audit scope");
    const time = Date.parse(event.createdAt), previous = page.items[index - 1];
    if ((query.from && time < Date.parse(query.from)) || (query.to && time > Date.parse(query.to)) || (previous && (time > Date.parse(previous.createdAt) || (time === Date.parse(previous.createdAt) && event.id >= previous.id)))) throw Error("Unexpected audit chronology");
  }
  if (page.nextCursor && (page.nextCursor !== page.items.at(-1)?.id || page.nextCursor === query.cursor)) throw Error("Unexpected audit cursor");
  return page;
}
