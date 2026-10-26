// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkforceWorkspace } from "@/app/components/workforce-workspace";
import { workforceNavigation } from "@/lib/workforce-navigation";
import { parseWorkforceAccess } from "@/lib/api/workforce-schemas";
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/fitment" }));
vi.mock("@/app/components/work-parts-fitment", () => ({
  WorkPartsFitment: () => <h1>Permitted fitment workspace</h1>,
}));
afterEach(cleanup);
const id = (n: number) => `af000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function access(permissions: string[]) {
  return parseWorkforceAccess({
    managed: true,
    userId: id(1),
    staffId: id(2),
    position: "OPERATIONS",
    department: "Strategy",
    version: 1,
    assignments: [],
    permissions,
    canManageAssignments: false,
    canInviteAdmins: false,
    serverTime: "2026-10-26T18:00:00.000Z",
  });
}
it("does not mount or advertise fitment from a person's job title without an effective grant", () => {
  const a = access([]);
  render(<WorkforceWorkspace access={a} refreshAccess={() => undefined} />);
  expect(screen.getByRole("heading", { name: "Access unavailable" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Permitted fitment workspace" }),
  ).toBeNull();
  expect(
    workforceNavigation(a)
      .flatMap((g) => g.links)
      .some((l) => l.href === "/admin/fitment"),
  ).toBe(false);
});
it.each(["FITMENT_AUTHOR", "FITMENT_REVIEW"])(
  "uses the same %s capability for the visible destination and its direct-page guard",
  (capability) => {
    const a = access([capability]);
    a.position = "MECHANICAL_TECHNICIAN";
    render(<WorkforceWorkspace access={a} refreshAccess={() => undefined} />);
    expect(
      screen.getByRole("heading", { name: "Permitted fitment workspace" }),
    ).toBeTruthy();
    expect(
      workforceNavigation(a)
        .flatMap((g) => g.links)
        .filter((l) => l.href === "/admin/fitment"),
    ).toHaveLength(1);
  },
);
