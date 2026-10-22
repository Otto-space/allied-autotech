import type {
  InboxNotification,
  NotificationSummary,
} from "@/lib/api/notification-schemas";

// Resource identity, not notification type, determines the destination: a refund
// notification can refer to a booking rather than a refund record.
const customerResources: Record<
  string,
  { section: string; label: string; detail: string }
> = {
  BOOKING: {
    section: "/dashboard/bookings",
    detail: "/dashboard/bookings",
    label: "View booking",
  },
  ORDER: {
    section: "/dashboard/orders",
    detail: "/dashboard/orders",
    label: "View order",
  },
  PAYMENT: {
    section: "/dashboard/payments",
    detail: "/dashboard/payments",
    label: "View payment",
  },
  INVOICE: {
    section: "/dashboard/invoices",
    detail: "/dashboard/invoices",
    label: "View invoice",
  },
  VEHICLE_TRANSACTION: {
    section: "/dashboard/vehicle-transactions",
    detail: "/dashboard/vehicle-transactions",
    label: "View vehicle purchase",
  },
  ENQUIRY: {
    section: "/dashboard/support",
    detail: "/dashboard/support/enquiries",
    label: "View enquiry",
  },
  COMPLAINT: {
    section: "/dashboard/support",
    detail: "/dashboard/support/complaints",
    label: "View complaint",
  },
  REVIEW: {
    section: "/dashboard/reviews",
    detail: "/dashboard/reviews",
    label: "View review",
  },
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function customerNotificationDestination(
  item: Pick<
    InboxNotification,
    "resourceType" | "resourceId" | "category" | "supportMessageId"
  >,
) {
  const resource = customerResources[item.resourceType?.toUpperCase() ?? ""];
  if (resource && uuid.test(item.resourceId ?? ""))
    return {
      href: `${resource.detail}/${item.resourceId}${["ENQUIRY", "COMPLAINT"].includes(item.resourceType?.toUpperCase() ?? "") && uuid.test(item.supportMessageId ?? "") ? `?messageId=${item.supportMessageId}#support-entry-${item.supportMessageId}` : ""}`,
      label: resource.label,
    };
  if (!item.resourceType && !item.resourceId && item.category === "SECURITY")
    return { href: "/dashboard/security", label: "Review account security" };
  return null;
}
export function notificationNavigationCounts(
  summary: NotificationSummary | undefined,
  customer: boolean,
): Record<string, number> {
  if (!summary) return {};
  const counts: Record<string, number> = {
    [customer ? "/dashboard/notifications" : "/admin/notifications"]: summary.unreadCount,
  };
  if (customer)
    for (const group of summary.groups) {
      const section =
        customerResources[group.resourceType?.toUpperCase() ?? ""]?.section ??
        (group.category === "SECURITY" ? "/dashboard/security" : undefined);
      if (section) counts[section] = (counts[section] ?? 0) + group.count;
    }
  return counts;
}
