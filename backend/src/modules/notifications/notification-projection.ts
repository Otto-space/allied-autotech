import type { NotificationTarget, TargetReference } from "./notification-targets.js";

// Historical recipient ownership does not preserve access to private source text.
// Keep a dismissible, generic inbox row without disclosing its former reference.
export function projectNotification<
  T extends TargetReference & {
    title: string;
    message: string;
    type: string;
    category: string;
  },
>(row: T, targets: ReadonlyMap<string, NotificationTarget>) {
  const destination = targets.get(row.id) ?? null;
  if (!destination && (row.resourceType || row.resourceId || row.supportMessageId))
    return {
      ...row,
      type: "SYSTEM" as const,
      category: "OPERATIONAL" as const,
      title: "Update no longer available",
      message:
        "The related record is unavailable or your access has changed. You can still change this notification's read status.",
      resourceType: null,
      resourceId: null,
      supportMessageId: null,
      destination: null,
    };
  return { ...row, destination };
}
