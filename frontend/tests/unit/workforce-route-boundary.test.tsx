// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/admin" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.path,
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/app/components/workforce-job-detail", () => ({
  WorkforceJobDetail: ({ id }: { id: string }) => {
    const [draft, setDraft] = React.useState(id);
    return (
      <input
        aria-label="Synthetic record draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  },
}));
vi.mock("@/app/components/workforce-booking-detail", () => ({
  WorkforceBookingDetail: ({ id }: { id: string }) => {
    const [draft, setDraft] = React.useState(id);
    return (
      <input
        aria-label="Synthetic record draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  },
}));
import { WorkforceWorkspace } from "@/app/components/workforce-workspace";
import { parseWorkforceAccess } from "@/lib/api/workforce-schemas";
afterEach(cleanup);
const id = (n: number) => `a7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
it.each(["jobs", "bookings"])(
  "changing %s detail through client navigation never retains the previous record draft",
  (section) => {
    const access = parseWorkforceAccess({
      managed: true,
      userId: id(1),
      staffId: id(2),
      position: "OPERATIONS",
      department: null,
      version: 0,
      assignments: [],
      permissions: ["JOBS_READ", "BOOKINGS_READ"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: "2026-10-26T10:00:00Z",
    });
    route.path = `/admin/workforce/${section}/${id(3)}`;
    const view = render(
      <WorkforceWorkspace access={access} refreshAccess={() => undefined} />,
    );
    fireEvent.change(screen.getByLabelText("Synthetic record draft"), {
      target: { value: "Unsent first-record context" },
    });
    route.path = `/admin/workforce/${section}/${id(4)}`;
    view.rerender(<WorkforceWorkspace access={access} refreshAccess={() => undefined} />);
    expect(
      (screen.getByLabelText("Synthetic record draft") as HTMLInputElement).value,
    ).toBe(id(4));
  },
);
