import type {
  InboxNotification,
  NotificationSummary,
} from "@/lib/api/notification-schemas";
import { browseEnquiriesOnly, restrictedLaunchPage } from "@/lib/public-launch";

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
export type StaffNotificationAccess = { managed: boolean; links: string[] };
const staffResources: Record<string, { section: string; path: string }> = {
  BOOKING: { section: "/admin/bookings", path: "/admin/bookings/" },
  ORDER: { section: "/admin/orders", path: "/admin/orders/" },
  INVOICE: { section: "/admin/invoices", path: "/admin/invoices/" },
  PAYMENT: { section: "/admin/payments", path: "/admin/payments?selected=" },
  REFUND: { section: "/admin/refunds", path: "/admin/refunds?refundId=" },
  DISPUTE: {
    section: "/admin/payment-disputes",
    path: "/admin/payment-disputes?expanded=",
  },
  VEHICLE_TRANSACTION: { section: "/admin/vehicle-sales", path: "/admin/vehicle-sales/" },
  ENQUIRY: { section: "/admin/support", path: "/admin/support/enquiries/" },
  COMPLAINT: { section: "/admin/support", path: "/admin/support/complaints/" },
};
function staffResource(type: string | null, access: StaffNotificationAccess) {
  const kind = type?.toUpperCase() ?? "";
  if (access.managed) {
    if (kind === "WORKFORCE_JOB" && access.links.includes("/admin/workforce/jobs"))
      return { section: "/admin/workforce/jobs", path: "/admin/workforce/jobs/" };
    const queue = (
      {
        ENQUIRY: "enquiries",
        COMPLAINT: "complaints",
        ORDER: "orders",
        PAYMENT: "finance",
      } as Record<string, string>
    )[kind];
    const section = queue ? `/admin/workforce/${queue}` : undefined;
    return section && access.links.includes(section)
      ? { section, path: `${section}?selected=` }
      : undefined;
  }
  if (
    kind === "DISPUTE" &&
    !access.links.includes("/admin/payment-disputes") &&
    access.links.includes("/admin/payment-disputes/work")
  )
    return {
      section: "/admin/payment-disputes/work",
      path: "/admin/payment-disputes/work?selected=",
    };
  const resource = staffResources[kind];
  return resource && access.links.includes(resource.section) ? resource : undefined;
}
export function staffNotificationDestination(
  item: Pick<
    InboxNotification,
    "resourceType" | "resourceId" | "category" | "supportMessageId" | "destination"
  >,
  access: StaffNotificationAccess,
) {
  if (item.destination !== undefined) return item.destination;
  const resource = staffResource(item.resourceType, access);
  if (resource && uuid.test(item.resourceId ?? "")) {
    const support =
      ["ENQUIRY", "COMPLAINT"].includes(item.resourceType ?? "") &&
      uuid.test(item.supportMessageId ?? "");
    return {
      href: `${resource.path}${item.resourceId}${support && !access.managed ? `?messageId=${item.supportMessageId}#support-entry-${item.supportMessageId}` : ""}`,
      label: "View update",
    };
  }
  if (!item.resourceType && !item.resourceId && item.category === "SECURITY")
    return { href: "/admin/security", label: "Review account security" };
  return null;
}
export function customerNotificationDestination(
  item: Pick<
    InboxNotification,
    "resourceType" | "resourceId" | "category" | "supportMessageId" | "destination"
  >,
) {
  const releaseDestination = (target: { href: string; label: string } | null) =>
    target && browseEnquiriesOnly() && restrictedLaunchPage(target.href.split(/[?#]/)[0])
      ? { href: "/contact", label: "Contact about this update" }
      : target;
  if (item.destination !== undefined) return releaseDestination(item.destination);
  const resource = customerResources[item.resourceType?.toUpperCase() ?? ""];
  if (resource && uuid.test(item.resourceId ?? ""))
    return releaseDestination({
      href: `${resource.detail}/${item.resourceId}${["ENQUIRY", "COMPLAINT"].includes(item.resourceType?.toUpperCase() ?? "") && uuid.test(item.supportMessageId ?? "") ? `?messageId=${item.supportMessageId}#support-entry-${item.supportMessageId}` : ""}`,
      label: resource.label,
    });
  if (!item.resourceType && !item.resourceId && item.category === "SECURITY")
    return { href: "/dashboard/security", label: "Review account security" };
  return null;
}
export function notificationNavigationCounts(
  summary: NotificationSummary | undefined,
  customer: boolean,
  access?: StaffNotificationAccess,
): Record<string, number> {
  if (!summary) return {};
  const counts: Record<string, number> = {
    [customer ? "/dashboard/notifications" : "/admin/notifications"]: summary.unreadCount,
  };
  if (summary.destinations) {
    const securityCount = summary.groups
      .filter((group) => !group.resourceType && group.category === "SECURITY")
      .reduce((sum, group) => sum + group.count, 0);
    if (securityCount)
      counts[customer ? "/dashboard/security" : "/admin/security"] = securityCount;
    for (const destination of summary.destinations) {
      if (
        customer
          ? destination.section.startsWith("/dashboard/")
          : access?.links.includes(destination.section)
      )
        counts[destination.section] = destination.count;
    }
    return counts;
  }
  for (const group of summary.groups) {
    const section =
      (customer
        ? customerResources[group.resourceType?.toUpperCase() ?? ""]?.section
        : access
          ? staffResource(group.resourceType, access)?.section
          : undefined) ??
      (!group.resourceType && group.category === "SECURITY"
        ? customer
          ? "/dashboard/security"
          : "/admin/security"
        : undefined);
    if (section) counts[section] = (counts[section] ?? 0) + group.count;
  }
  return counts;
}

export function notificationNavigationLinks(summary: NotificationSummary | undefined) {
  return Object.fromEntries(
    (summary?.destinations ?? []).map((item) => [item.section, item.href]),
  );
}
