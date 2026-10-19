import {
  Home,
  CalendarDays,
  MessageSquare,
  Package,
  CreditCard,
  Settings,
  Users,
} from "lucide-react";
import type { DashboardGroup } from "./dashboard-navigation";
import type { WorkforceAccess } from "./api/workforce-schemas";
export function workforceNavigation(access: WorkforceAccess): DashboardGroup[] {
  const can = (permission: string) => access.permissions.includes(permission);
  const group = (
    id: string,
    label: string,
    icon: DashboardGroup["icon"],
    links: Array<{ href: string; label: string; allowed: boolean }>,
  ): DashboardGroup => ({
    id,
    label,
    icon,
    links: links.filter((l) => l.allowed).map(({ href, label }) => ({ href, label })),
  });
  return [
    group("overview", "Overview", Home, [
      { href: "/admin", label: "Overview", allowed: true },
    ]),
    group(
      "workshop",
      can("JOBS_READ") && !can("JOBS_ASSIGN") && !can("BOOKINGS_READ")
        ? "My work"
        : "Workshop",
      CalendarDays,
      [
        {
          href: "/admin/workforce/jobs",
          label: can("JOBS_ASSIGN") ? "Workshop jobs" : "My jobs",
          allowed: can("JOBS_READ"),
        },
        {
          href: "/admin/workforce/bookings",
          label: "Bookings",
          allowed: can("BOOKINGS_READ"),
        },
      ],
    ),
    group("support", "Customers & Enquiries", MessageSquare, [
      {
        href: "/admin/workforce/enquiries",
        label: "Enquiries",
        allowed: can("CUSTOMER_ENQUIRIES") || can("SALES_ENQUIRIES"),
      },
      {
        href: "/admin/workforce/complaints",
        label: "Complaints",
        allowed: can("COMPLAINTS"),
      },
    ]),
    group("orders", "Sales & Orders", Package, [
      {
        href: "/admin/workforce/orders",
        label: "Order progress",
        allowed: can("ORDERS_READ"),
      },
    ]),
    group("finance", "Finance", CreditCard, [
      {
        href: "/admin/workforce/finance",
        label: "Payment records",
        allowed: can("FINANCE_READ"),
      },
    ]),
    group("team", "Team & Access", Users, [
      {
        href: "/admin/workforce/access",
        label: "Responsibility assignments",
        allowed: access.canManageAssignments,
      },
    ]),
    group("settings", "Settings", Settings, [
      { href: "/admin/security", label: "My account security", allowed: true },
    ]),
  ].filter((g) => g.links.length);
}
