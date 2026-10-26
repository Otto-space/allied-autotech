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
import {
  permittedWorkforceDestinations,
  workforceDestinationAllowed,
} from "./workforce-registry";

export function workforceNavigation(access: WorkforceAccess): DashboardGroup[] {
  const myWork =
    workforceDestinationAllowed(access, "jobs") &&
    !access.permissions.includes("JOBS_ASSIGN") &&
    !workforceDestinationAllowed(access, "bookings");
  const groups: { id: string; label: string; icon: DashboardGroup["icon"] }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "workshop", label: myWork ? "My work" : "Workshop", icon: CalendarDays },
    { id: "support", label: "Customers & Enquiries", icon: MessageSquare },
    { id: "catalogue", label: "Parts catalogue", icon: Package },
    { id: "orders", label: "Sales & Orders", icon: Package },
    { id: "finance", label: "Finance", icon: CreditCard },
    { id: "team", label: "Team & Access", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const eligible = permittedWorkforceDestinations(access);
  return groups
    .map((group) => ({
      ...group,
      links: eligible
        .filter((entry) => entry.group === group.id)
        .map((entry) => ({
          href: entry.href,
          label:
            entry.id === "jobs" && access.permissions.includes("JOBS_ASSIGN")
              ? "Workshop jobs"
              : entry.label,
        })),
    }))
    .filter((group) => group.links.length > 0);
}
