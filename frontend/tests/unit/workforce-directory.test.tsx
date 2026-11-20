// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkforceDirectory } from "@/app/components/workforce-directory";
import {
  parseWorkforceDirectory,
  workforceDirectoryQuerySchema,
} from "@/lib/api/workforce-directory-schemas";

const state = vi.hoisted(() => ({
  pathname: "/admin/workforce/access",
  search: "",
  role: "SUPER_ADMIN",
  resource: {} as Record<string, unknown>,
  requestPath: null as string | null,
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push: state.push }),
}));
vi.mock("@/app/components/dashboard-shell", () => ({
  useAccountSession: () => ({ user: { role: state.role } }),
}));
vi.mock("@/lib/api/use-resource", () => ({
  useResource: (path: string | null) => {
    state.requestPath = path;
    return { ...state.resource, refresh: state.refresh };
  },
}));
vi.mock("@/app/components/workforce-access-panel", () => ({
  WorkforceAccessPanel: ({ userId }: { userId: string }) => (
    <p>Reviewed account {userId}</p>
  ),
}));
const id = (n: number) => `a4800000-0000-4000-8000-${String(n).padStart(12, "0")}`;
vi.mock("@/app/components/admin-branch-picker", () => ({
  AdminBranchPicker: ({
    id: inputId,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All branches</option>
      <option value={id(2)}>Fixture branch</option>
    </select>
  ),
}));
const person = {
  userId: id(1),
  name: "Ada Scope",
  email: "ada@example.invalid",
  role: "STAFF",
  status: "ACTIVE",
  verified: true,
  managed: true,
  position: "CUSTOMER_SERVICE",
  version: 1,
  accountBranch: { id: id(2), name: "Fixture branch", isActive: true },
  responsibilities: [
    {
      assignmentId: id(3),
      template: "CUSTOMER_SERVICE",
      branch: { id: id(2), name: "Fixture branch" },
      scope: "BRANCH",
      temporary: false,
      expiresAt: null,
    },
  ],
  canInspect: true,
  responsibilitiesMore: false,
};
const data = () => ({
  items: [structuredClone(person)],
  nextCursor: id(1),
  generatedAt: "2026-10-26T18:00:00.000Z",
});
beforeEach(() => {
  state.pathname = "/admin/workforce/access";
  state.search = "";
  state.role = "SUPER_ADMIN";
  state.resource = { data: parseWorkforceDirectory(data()), loading: false };
  state.push.mockClear();
  state.refresh.mockClear();
});
afterEach(cleanup);

it("shows separate account role, recorded position and independently scoped responsibilities", () => {
  render(<WorkforceDirectory />);
  expect(screen.getByRole("columnheader", { name: "Account level" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Job position" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Workforce accounts" }).tabIndex).toBe(0);
  expect(
    screen.getByRole("link", { name: "View person: Ada Scope" }).getAttribute("href"),
  ).toBe(`/admin/workforce/access/${id(1)}`);
  expect(screen.getByText("Branch records", { exact: false })).toBeTruthy();
});
it("submits server-side URL filters without carrying the previous page cursor", () => {
  state.search = `q=old&cursor=${id(4)}`;
  render(<WorkforceDirectory />);
  fireEvent.change(screen.getByLabelText("Find a person"), {
    target: { value: "  Ada Scope  " },
  });
  fireEvent.change(screen.getByLabelText("Job position"), {
    target: { value: "CUSTOMER_SERVICE" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search people" }));
  expect(state.push).toHaveBeenCalledWith(
    "/admin/workforce/access?q=Ada+Scope&position=CUSTOMER_SERVICE",
  );
  const next = screen.getByRole("link", { name: "Next page" }).getAttribute("href")!;
  expect(new URL(next, "http://fixture.invalid").searchParams.get("q")).toBe("old");
  expect(new URL(next, "http://fixture.invalid").searchParams.get("cursor")).toBe(id(1));
});
it("shows an email-only identity once and gives its person link a clear name", () => {
  const response = data();
  response.items[0]!.name = person.email;
  state.resource = { data: parseWorkforceDirectory(response), loading: false };
  render(<WorkforceDirectory />);
  expect(screen.getAllByText(person.email, { exact: true })).toHaveLength(1);
  expect(screen.getByRole("link", { name: `View person: ${person.email}` })).toBeTruthy();
});
it("removes one applied filter while preserving the others and resets pagination", () => {
  state.search = `q=Ada&status=ACTIVE&branchId=${id(2)}&cursor=${id(4)}`;
  render(<WorkforceDirectory />);
  const remove = screen.getByRole("link", { name: "Remove Search: Ada filter" });
  expect(remove.getAttribute("href")).toBe(
    `/admin/workforce/access?status=ACTIVE&branchId=${id(2)}`,
  );
  fireEvent.click(screen.getByRole("button", { name: "Search people" }));
  expect(state.push).toHaveBeenCalledWith(
    `/admin/workforce/access?q=Ada&status=ACTIVE&branchId=${id(2)}`,
  );
});
it("flags existing open-ended temporary cover without implying it was revoked", () => {
  const response = data();
  response.items[0]!.responsibilities[0]!.temporary = true;
  state.resource = { data: parseWorkforceDirectory(response), loading: false };
  render(<WorkforceDirectory />);
  expect(
    screen.getByText("No end date recorded. Review this existing temporary cover."),
  ).toBeTruthy();
  expect(
    screen
      .getByText("No end date recorded. Review this existing temporary cover.")
      .closest("li")?.textContent,
  ).toContain("Customer Service Officer");
});
it("keeps filtered directory context on detail/back navigation and rejects malformed account references", () => {
  state.search = "q=Ada";
  state.pathname += `/${id(1)}`;
  const view = render(<WorkforceDirectory />);
  expect(screen.getByText(`Reviewed account ${id(1)}`)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to People" }).getAttribute("href")).toBe(
    "/admin/workforce/access?q=Ada",
  );
  state.pathname = "/admin/workforce/access/not-an-account";
  view.rerender(<WorkforceDirectory />);
  expect(screen.getByRole("alert").textContent).toContain("invalid");
  expect(screen.queryByText(`Reviewed account ${id(1)}`)).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Open account status and role controls" }),
  ).toBeNull();
});
it("does not offer owner-only tier controls to a delegated administrator", () => {
  state.role = "ADMIN";
  const view = render(<WorkforceDirectory />);
  expect(screen.queryByLabelText("Account level")).toBeNull();
  state.pathname += `/${id(1)}`;
  view.rerender(<WorkforceDirectory />);
  expect(
    screen.queryByRole("link", { name: "Open account status and role controls" }),
  ).toBeNull();
});
it("limits delegated branch choices to the server response and clears them when access is uncertain", () => {
  state.role = "ADMIN";
  const response = {
    ...data(),
    managementBranches: [{ id: id(2), name: "Fixture branch", isActive: true }],
  };
  state.resource = { data: parseWorkforceDirectory(response), loading: false };
  const view = render(<WorkforceDirectory />);
  const branch = screen.getByLabelText("Account branch") as HTMLSelectElement;
  expect([...branch.options].map((option) => option.text)).toEqual([
    "All permitted branches",
    "Fixture branch",
  ]);
  fireEvent.change(branch, { target: { value: id(2) } });
  fireEvent.click(screen.getByRole("button", { name: "Search people" }));
  expect(state.push).toHaveBeenLastCalledWith(
    `/admin/workforce/access?branchId=${id(2)}`,
  );
  state.resource = {
    data: parseWorkforceDirectory(response),
    refreshError: "Current access unavailable",
  };
  view.rerender(<WorkforceDirectory />);
  expect((screen.getByLabelText("Account branch") as HTMLSelectElement).disabled).toBe(
    true,
  );
  expect(screen.queryByRole("option", { name: "Fixture branch" })).toBeNull();
});
it.each(["loading", "refreshError", "error", "invalidFilter"])(
  "hides previously loaded private rows during %s",
  (kind) => {
    if (kind === "invalidFilter") state.search = "role=CUSTOMER";
    else
      state.resource[kind] =
        kind === "loading" ? true : "Permission changed. Refresh your access.";
    render(<WorkforceDirectory />);
    expect(screen.queryByText("Ada Scope")).toBeNull();
    expect(screen.queryByRole("region", { name: "Workforce accounts" })).toBeNull();
    if (kind === "invalidFilter") expect(state.requestPath).toBeNull();
  },
);
it("distinguishes an empty permitted result from a failed request and provides clear recovery", () => {
  state.resource = {
    data: { ...data(), items: [], nextCursor: undefined },
    loading: false,
  };
  render(<WorkforceDirectory />);
  expect(screen.getByText(/No people are available within/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Refresh people" }));
  expect(state.refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe(
    "/admin/workforce/access",
  );
});
it("rejects customer tiers, unknown positions and forged cursors instead of widening query scope", () => {
  for (const query of [
    { role: "CUSTOMER" },
    { position: "OWNER" },
    { cursor: "first" },
    { q: "unsafe\nterm" },
  ])
    expect(workforceDirectoryQuerySchema.safeParse(query).success).toBe(false);
  expect(() =>
    parseWorkforceDirectory({ ...data(), items: [{ ...person, role: "CUSTOMER" }] }),
  ).toThrow();
});
