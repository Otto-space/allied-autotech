import {
  CalendarDays,
  CarFront,
  CreditCard,
  Home,
  MessageSquare,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SessionState } from "./api/types";

type Role = SessionState["user"]["role"];
export type DashboardDestination = {
  href: string;
  label: string;
  roles?: readonly Role[];
};
export type DashboardGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  links: DashboardDestination[];
};
const administrators: readonly Role[] = ["ADMIN", "SUPER_ADMIN"];
const adminOnly = (href: string, label: string): DashboardDestination => ({
  href,
  label,
  roles: administrators,
});
const customerGroups: DashboardGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    links: [{ href: "/dashboard", label: "Overview" }],
  },
  {
    id: "bookings",
    label: "My bookings",
    icon: CalendarDays,
    links: [{ href: "/dashboard/bookings", label: "Bookings" }],
  },
  {
    id: "shop",
    label: "My orders",
    icon: Package,
    links: [
      { href: "/dashboard/orders", label: "Orders" },
      { href: "/dashboard/cart", label: "Cart" },
      { href: "/dashboard/saved", label: "Saved items" },
    ],
  },
  {
    id: "vehicles",
    label: "My vehicles",
    icon: CarFront,
    links: [
      { href: "/dashboard/vehicles", label: "My vehicles" },
      { href: "/dashboard/inspections", label: "Inspections" },
      { href: "/dashboard/vehicle-transactions", label: "Vehicle purchases" },
    ],
  },
  {
    id: "finance",
    label: "Payments & invoices",
    icon: CreditCard,
    links: [
      { href: "/dashboard/payments", label: "Payments" },
      { href: "/dashboard/invoices", label: "Invoices" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: MessageSquare,
    links: [
      { href: "/dashboard/support", label: "Customer care" },
      { href: "/dashboard/reviews", label: "Reviews" },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: Settings,
    links: [
      { href: "/dashboard/profile", label: "Profile" },
      { href: "/dashboard/security", label: "Security" },
      { href: "/dashboard/notifications", label: "Notifications" },
    ],
  },
];
const operationalGroups: DashboardGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    links: [{ href: "/admin", label: "Overview" }],
  },
  {
    id: "service",
    label: "Service Centre",
    icon: CalendarDays,
    links: [
      { href: "/admin/bookings", label: "Workshop bookings" },
      { href: "/admin/booking-slots", label: "Appointment slots" },
      adminOnly("/admin/services", "Services"),
    ],
  },
  {
    id: "shop",
    label: "Shop",
    icon: Package,
    links: [
      { href: "/admin/orders", label: "Order fulfilment" },
      { href: "/admin/inventory", label: "Parts inventory" },
      adminOnly("/admin/products", "Parts catalogue"),
      adminOnly("/admin/categories", "Part categories"),
      adminOnly("/admin/promotions", "Promotions"),
    ],
  },
  {
    id: "marketplace",
    label: "Vehicle Marketplace",
    icon: CarFront,
    links: [
      { href: "/admin/vehicles", label: "Vehicle stock" },
      { href: "/admin/inspections", label: "Vehicle inspections" },
      { href: "/admin/vehicle-sales", label: "Vehicle sales" },
    ],
  },
  {
    id: "support",
    label: "Customers & Support",
    icon: MessageSquare,
    links: [
      { href: "/admin/support", label: "Customer care" },
      adminOnly("/admin/reviews", "Review moderation"),
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: CreditCard,
    links: [
      adminOnly("/admin/payments", "Payment records"),
      adminOnly("/admin/invoices", "Invoices"),
      adminOnly("/admin/refunds", "Refund requests"),
      adminOnly("/admin/payment-exceptions", "Payment exceptions"),
      adminOnly("/admin/payment-disputes", "Payment disputes"),
    ],
  },
  {
    id: "team",
    label: "Team & Access",
    icon: Users,
    links: [
      adminOnly("/admin/staff", "Staff directory"),
      adminOnly("/admin/staff/invite", "Promotions & invitations"),
      adminOnly("/admin/audit", "Audit log"),
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    links: [
      { href: "/admin/security", label: "My account security" },
      { href: "/admin/notifications", label: "My notifications" },
      adminOnly("/admin/branches", "Branches"),
      adminOnly("/admin/processing-jobs", "Processing jobs"),
    ],
  },
];

export function dashboardNavigation(role: Role): DashboardGroup[] {
  if (!["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"].includes(role)) return [];
  return (role === "CUSTOMER" ? customerGroups : operationalGroups)
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !link.roles || link.roles.includes(role)),
    }))
    .filter((group) => group.links.length > 0);
}

export function isDashboardDestination(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/admin" && href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}
