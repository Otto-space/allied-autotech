import { expect, it } from "vitest";
import { Home, CalendarDays } from "lucide-react";
import {
  withOwnerWorkshopPolicies,
  isOwnerWorkshopPolicyRoute,
  type DashboardGroup,
} from "@/lib/dashboard-navigation";
it("adds owner policy links without changing job duties or the original navigation", () => {
  const groups: DashboardGroup[] = [
    {
      id: "overview",
      label: "Overview",
      icon: Home,
      links: [{ href: "/admin", label: "Overview" }],
    },
    {
      id: "workshop",
      label: "Workshop",
      icon: CalendarDays,
      links: [{ href: "/admin/workforce/jobs", label: "My jobs" }],
    },
  ];
  const result = withOwnerWorkshopPolicies(groups, "SUPER_ADMIN");
  expect(result[1]!.links.map((l) => l.href)).toEqual([
    "/admin/workforce/jobs",
    "/admin/booking-capacity",
    "/admin/booking-resources",
  ]);
  expect(groups[1]!.links).toHaveLength(1);
  expect(withOwnerWorkshopPolicies(result, "SUPER_ADMIN")[1]!.links).toHaveLength(3);
  for (const role of ["CUSTOMER", "STAFF", "ADMIN"] as const)
    expect(withOwnerWorkshopPolicies(groups, role)).toBe(groups);
});
it("lets a verified managed owner reach policy authoring without inventing a booking responsibility", () => {
  const result = withOwnerWorkshopPolicies([], "SUPER_ADMIN");
  expect(result.flatMap((g) => g.links.map((l) => l.href))).toEqual([
    "/admin/booking-capacity",
    "/admin/booking-resources",
  ]);
  expect(JSON.stringify(result)).not.toContain("/admin/workforce/bookings");
});

it("recognises only the exact independent owner policy pages, never a job or broader admin prefix", () => {
  for (const path of ["/admin/booking-capacity", "/admin/booking-resources"])
    expect(isOwnerWorkshopPolicyRoute("SUPER_ADMIN", path)).toBe(true);
  for (const role of ["STAFF", "ADMIN", "CUSTOMER"] as const)
    expect(isOwnerWorkshopPolicyRoute(role, "/admin/booking-resources")).toBe(false);
  for (const path of [
    "/admin",
    "/admin/workforce/jobs",
    "/admin/booking-resources/other",
    "/admin/booking-resources?other=true",
  ])
    expect(isOwnerWorkshopPolicyRoute("SUPER_ADMIN", path)).toBe(false);
});
