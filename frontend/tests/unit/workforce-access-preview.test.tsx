// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkforceAccessPanel } from "@/app/components/workforce-access-panel";
import {
  WorkforceAccessChange,
  WorkforceEffectiveAccess,
} from "@/app/components/workforce-effective-access";
import {
  workforceAccessPreviewSchema,
  parseWorkforceAccessPreview,
} from "@/lib/api/workforce-effective-access";
import { parseWorkforceAccount } from "@/lib/api/workforce-schemas";
import { verifyWorkforceReceipt } from "@/lib/admin/work-staff-workforce";
import { staffWorkforceRecord, id } from "../fixtures/work-staff-detail";
const state = vi.hoisted(() => ({
  request: vi.fn(),
  review: vi.fn(),
  resource: {} as Record<string, unknown>,
  refresh: vi.fn(),
  sessionId: "fixture-session",
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: state.request,
}));
vi.mock("@/lib/api/use-resource", () => ({
  useResource: () => ({ ...state.resource, refresh: state.refresh }),
}));
vi.mock("@/app/components/dashboard-shell", () => ({
  useAccountSession: () => ({
    id: state.sessionId,
    user: { id: "d1000000-0000-4000-8000-000000000302", role: "SUPER_ADMIN" },
  }),
  useOwnStaffPermissions: () => ({}),
}));
vi.mock("@/app/components/staff-change-coordinator", () => ({
  useStaffChangeCoordinator: () => ({
    locked: false,
    reviewing: false,
    pending: false,
    epoch: 0,
    review: state.review,
  }),
  StaffChangeCoordinator: () => null,
}));
vi.mock("@/app/components/admin-branch-picker", () => ({
  AdminBranchPicker: ({
    id: inputId,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (id: string, label: string) => void;
  }) => (
    <select
      id={inputId}
      value={value}
      onChange={(e) => onChange(e.target.value, "Stadium Road workshop")}
    >
      <option value="">Choose branch</option>
      <option value="d1000000-0000-4000-8000-000000000101">Stadium Road workshop</option>
    </select>
  ),
}));
const stamp = "2026-10-26T10:00:00.000Z",
  fingerprint = "a".repeat(64),
  secret = "Synthetic proof that must not reach preview";
function record() {
  const r = staffWorkforceRecord();
  r.access = {
    userId: r.userId,
    position: "WORKSHOP_LEAD",
    enabledAt: stamp,
    version: 0,
    delegatedTemplates: [],
    delegatedBranchIds: [],
    delegationPolicyVersion: 1,
  };
  r.management.canAssign = true;
  r.management.canRevoke = true;
  r.templatesVersion = 1;
  r.assignmentDefinitions = {};
  r.effectiveAccess = {
    baseline: "MANAGED",
    visibility: "FULL",
    evaluatedAt: stamp,
    grants: [],
    responsibilityGrantsOnly: true,
  };
  return r;
}
function preview() {
  return workforceAccessPreviewSchema.parse({
    userId: record().userId,
    expectedVersion: 0,
    operation: "assign",
    evaluatedAt: stamp,
    scheduled: false,
    visibility: "FULL",
    fingerprint,
    added: [
      {
        capability: "JOBS_READ",
        label: "View workshop jobs",
        branch: { id: id(101), name: "Stadium Road workshop" },
        scope: "BRANCH",
        sources: [
          {
            assignmentId: null,
            label: "Workshop / Quality Service Lead",
            scope: "BRANCH",
            kind: "PROPOSED",
          },
        ],
      },
    ],
    removed: [],
    retained: [],
    responsibilityGrantsOnly: true,
  });
}
beforeEach(() => {
  state.request.mockReset();
  state.review.mockReset();
  state.refresh.mockReset();
  state.sessionId = "fixture-session";
  state.resource = { data: record(), loading: false, refreshing: false };
});
afterEach(cleanup);
it("keeps the selected person's current identity above access editing and clears it during uncertainty", () => {
  const account = record();
  state.resource = { data: account, loading: false, refreshing: false };
  const view = render(<WorkforceAccessPanel userId={account.userId} personPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Ada Okoro" })).toBeTruthy();
  expect(screen.getByText("Account level", { exact: true })).toBeTruthy();
  expect(screen.getByText("Account branch", { exact: true })).toBeTruthy();
  expect(screen.getByText("Active", { exact: true })).toBeTruthy();
  expect(
    within(screen.getByRole("complementary", { name: "Selected person" })).getByText(
      "Ada Okoro",
      { exact: true },
    ),
  ).toBeTruthy();
  state.resource = { data: account, loading: false, refreshing: true };
  view.rerender(<WorkforceAccessPanel userId={account.userId} personPage />);
  expect(screen.queryByRole("heading", { level: 1, name: "Ada Okoro" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1, name: "Person" })).toBeTruthy();
  state.resource = {
    data: account,
    loading: false,
    refreshError: "Current access unavailable",
  };
  view.rerender(<WorkforceAccessPanel userId={account.userId} personPage />);
  expect(screen.queryByRole("heading", { level: 1, name: "Ada Okoro" })).toBeNull();
  expect(screen.getByText(/Person details are unavailable/)).toBeTruthy();
  expect(
    within(screen.getByRole("complementary", { name: "Selected person" })).queryByText(
      "Ada Okoro",
      { exact: true },
    ),
  ).toBeNull();
});
it("groups real allowed actions by task and shows dates only for their visible sources", () => {
  const account = record();
  const workshop = {
    id: id(951),
    userId: account.userId,
    template: "WORKSHOP_LEAD",
    templateVersion: 1,
    branchId: id(101),
    scope: "BRANCH",
    temporary: true,
    startsAt: stamp,
    expiresAt: "2026-10-27T10:00:00.000Z",
    reason: "Reviewed temporary workshop cover",
    assignedByUserId: id(302),
    createdAt: stamp,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  };
  const technician = {
    ...workshop,
    id: id(952),
    template: "MECHANICAL_TECHNICIAN",
    scope: "ASSIGNED",
    temporary: false,
    expiresAt: null,
  };
  const view = preview().added[0]!;
  const source = {
    assignmentId: workshop.id,
    label: "Workshop / Quality Service Lead",
    scope: "BRANCH" as const,
    kind: "ASSIGNMENT" as const,
  };
  const value = {
    ...account.effectiveAccess!,
    grants: [
      { ...view, sources: [source] },
      {
        ...view,
        capability: "QUALITY_APPROVE",
        label: "Independently approve workshop quality",
        sources: [source],
      },
      {
        ...view,
        capability: "JOBS_ASSIGN",
        label: "Assign workshop jobs",
        sources: [source],
      },
      {
        ...view,
        capability: "JOBS_UPDATE",
        label: "Record workshop work",
        scope: "ASSIGNED" as const,
        sources: [
          {
            ...source,
            assignmentId: technician.id,
            label: "Mechanical Technician",
            scope: "ASSIGNED" as const,
          },
        ],
      },
    ],
  };
  render(
    <WorkforceEffectiveAccess
      value={value}
      assignments={[
        workshop,
        technician,
        { ...workshop, id: id(999), reason: "Hidden source reason must stay private" },
      ]}
    />,
  );
  fireEvent.click(
    screen.getByText("Allowed actions and why they are available (4)", { exact: true }),
  );
  for (const label of [
    "View",
    "Prepare and edit",
    "Independently review and approve",
    "Coordinate work",
  ])
    expect(screen.getByRole("region", { name: label })).toBeTruthy();
  expect(screen.getAllByText(/26 Oct 2026, 11:00 \(Lagos time\)/).length).toBeGreaterThan(
    0,
  );
  expect(
    screen.getAllByText(/ends 27 Oct 2026, 11:00 \(Lagos time\)/).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText(/Job duty: Mechanical Technician/)).toBeTruthy();
  expect(screen.queryByText(/Hidden source reason/)).toBeNull();
  expect(screen.queryByRole("region", { name: "Other allowed work" })).toBeNull();
});
it("does not describe earlier duties as active when the selected account is inactive", () => {
  const account = record();
  account.access = null;
  account.identity!.status = "SUSPENDED";
  account.management = {
    ...account.management,
    canEnroll: false,
    canAssign: false,
    canRevoke: false,
    canDelegate: false,
  };
  account.effectiveAccess!.baseline = "INACTIVE";
  state.resource = { data: account, loading: false, refreshing: false };
  render(<WorkforceAccessPanel userId={account.userId} personPage />);
  expect(
    screen.getByText(/cannot use responsibility access while inactive/),
  ).toBeTruthy();
  expect(screen.queryByText(/Legacy access is still active/)).toBeNull();
});
it("does not infer identity facts when a compatible older response omits them", () => {
  const account = record();
  delete account.identity;
  state.resource = {
    data: parseWorkforceAccount(account),
    loading: false,
    refreshing: false,
  };
  render(<WorkforceAccessPanel userId={account.userId} personPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Ada Okoro" })).toBeTruthy();
  expect(
    screen.getByText(/Account details are unavailable from this response/),
  ).toBeTruthy();
  expect(screen.queryByText("Active", { exact: true })).toBeNull();
});
function submit() {
  render(<WorkforceAccessPanel userId={record().userId} />);
  fireEvent.click(screen.getByText("Assign responsibility", { exact: true }));
  const form = screen
    .getByRole("button", { name: "Review responsibility assignment" })
    .closest("form")!;
  fireEvent.change(within(form).getByLabelText("Responsibility", { exact: true }), {
    target: { value: "WORKSHOP_LEAD" },
  });
  fireEvent.change(within(form).getByLabelText("Branch", { exact: true }), {
    target: { value: id(101) },
  });
  fireEvent.change(within(form).getByLabelText("Starts at (your device time)"), {
    target: { value: "2026-10-26T10:00" },
  });
  fireEvent.change(within(form).getByLabelText("Reason", { exact: true }), {
    target: { value: "Reviewed isolated workshop coverage" },
  });
  fireEvent.change(
    within(form).getByLabelText("Your current password", { exact: true }),
    { target: { value: secret } },
  );
  fireEvent.submit(form);
  return form;
}
function unrecognisedHistory() {
  const r = record();
  const assignment = {
    id: id(951),
    userId: r.userId,
    template: "RETIRED_DIAGNOSTICS",
    templateVersion: 7,
    branchId: id(101),
    scope: "LEGACY_ZONE",
    temporary: false,
    startsAt: stamp,
    expiresAt: null,
    reason: "Preserved synthetic historical responsibility",
    assignedByUserId: id(302),
    createdAt: stamp,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  };
  return {
    ...r,
    assignments: [assignment],
    assignmentDefinitions: { [assignment.id]: null },
  };
}
it("preserves unsupported historical template and scope text without accepting it as current access", () => {
  const value = unrecognisedHistory();
  const parsed = parseWorkforceAccount(value);
  expect(parsed.assignments[0]).toMatchObject({
    template: "RETIRED_DIAGNOSTICS",
    scope: "LEGACY_ZONE",
    templateVersion: 7,
  });
  expect(parsed.activeAssignmentIds).toEqual([]);
  expect(parsed.effectiveAccess?.grants).toEqual([]);
  expect(() =>
    parseWorkforceAccount({
      ...value,
      assignmentDefinitions: undefined,
      activeAssignmentIds: [value.assignments[0]!.id],
    }),
  ).toThrow();
  expect(() =>
    parseWorkforceAccount({ ...value, activeAssignmentIds: [value.assignments[0]!.id] }),
  ).toThrow();
});
it("shows unknown historical labels and scopes without silently calling them branch access", () => {
  state.resource = { data: unrecognisedHistory(), loading: false, refreshing: false };
  render(<WorkforceAccessPanel userId={record().userId} />);
  expect(
    screen.getByRole("heading", { name: /Unrecognised responsibility/ }),
  ).toBeTruthy();
  expect(screen.getByText(/Unrecognised scope: LEGACY_ZONE/)).toBeTruthy();
  expect(screen.getByText("RETIRED_DIAGNOSTICS", { exact: true })).toBeTruthy();
  expect(screen.getByText(/assignment grants no access/)).toBeTruthy();
  expect(state.request).not.toHaveBeenCalled();
});
it("verifies an unknown history revocation without accepting the template for assignment", () => {
  const current = parseWorkforceAccount(unrecognisedHistory());
  const row = current.assignments[0]!;
  const input = { reason: "Reviewed historical unsupported grant", expectedVersion: 0 };
  const receipt = {
    ...row,
    revokedAt: "2026-10-26T11:00:00.000Z",
    revokedByUserId: id(302),
    revocationReason: input.reason,
  };
  expect(
    verifyWorkforceReceipt(
      receipt,
      "revoke",
      current.userId,
      id(302),
      input,
      current,
      row.id,
    ),
  ).toMatchObject({ template: row.template, scope: row.scope });
  expect(() =>
    verifyWorkforceReceipt(
      { ...receipt, scope: "BRANCH" },
      "revoke",
      current.userId,
      id(302),
      input,
      current,
      row.id,
    ),
  ).toThrow();
  expect(() =>
    verifyWorkforceReceipt(receipt, "assign", current.userId, id(302), input, current),
  ).toThrow();
});
it("fetches a credential-free server preview before opening a change review", async () => {
  let finish!: (v: unknown) => void;
  state.request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const form = submit();
  expect(state.review).not.toHaveBeenCalled();
  expect(
    (within(form).getByLabelText("Reason", { exact: true }) as HTMLTextAreaElement).value,
  ).toBe("Reviewed isolated workshop coverage");
  expect(
    (within(form).getByLabelText("Responsibility", { exact: true }) as HTMLSelectElement)
      .value,
  ).toBe("WORKSHOP_LEAD");
  expect(screen.getByRole("status").textContent).toContain(
    "Checking what access will change",
  );
  expect(
    (
      within(form).getByLabelText("Your current password", {
        exact: true,
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  const [path, options] = state.request.mock.calls[0]!;
  expect(path).toMatch(/\/access-preview$/);
  expect(JSON.stringify(options.body)).not.toContain(secret);
  expect(options.body).not.toHaveProperty("currentPassword");
  expect(options.body).not.toHaveProperty("reason");
  expect(options.body).not.toHaveProperty("temporary");
  await act(async () => finish({ data: preview() }));
  await waitFor(() => expect(state.review).toHaveBeenCalledTimes(1));
  const proposal = state.review.mock.calls[0]![0];
  expect(proposal.workforceAccessChange.fingerprint).toBe(fingerprint);
  expect(JSON.stringify(proposal.facts)).not.toContain(secret);
});
it("rejects a preview for another target without opening review or submitting an assignment", async () => {
  state.request.mockResolvedValue({ data: { ...preview(), userId: id(999) } });
  submit();
  await screen.findByRole("alert");
  expect(state.review).not.toHaveBeenCalled();
  expect(state.request).toHaveBeenCalledTimes(1);
});
it("rejects a changed preview before a mutation and does not label it an unknown save outcome", async () => {
  state.request.mockResolvedValueOnce({ data: preview() });
  submit();
  await waitFor(() => expect(state.review).toHaveBeenCalledTimes(1));
  const proposal = state.review.mock.calls[0]![0];
  state.request
    .mockResolvedValueOnce({ data: record() })
    .mockResolvedValueOnce({ data: { ...preview(), fingerprint: "b".repeat(64) } });
  await expect(proposal.submit()).rejects.toMatchObject({ status: 409 });
  expect(
    state.request.mock.calls.every(([path]) => !String(path).endsWith("/assignments")),
  ).toBe(true);
});
it("binds the accepted preview to the save payload and still verifies the returned receipt", async () => {
  state.request.mockResolvedValueOnce({ data: preview() });
  submit();
  await waitFor(() => expect(state.review).toHaveBeenCalledTimes(1));
  const proposal = state.review.mock.calls[0]![0];
  state.request
    .mockResolvedValueOnce({ data: record() })
    .mockResolvedValueOnce({ data: preview() })
    .mockImplementationOnce(async (_path, options) => ({
      data: {
        id: id(777),
        userId: record().userId,
        template: options.body.template,
        templateVersion: 1,
        branchId: options.body.branchId,
        scope: "BRANCH",
        temporary: options.body.temporary,
        startsAt: options.body.startsAt,
        expiresAt: options.body.expiresAt,
        reason: options.body.reason,
        assignedByUserId: id(302),
        createdAt: stamp,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
      },
    }));
  await expect(proposal.submit()).resolves.toBeUndefined();
  expect(state.request.mock.calls.at(-1)![1].body.expectedAccessPreview).toBe(
    fingerprint,
  );
});
it("aborts a late preview on unmount so another account cannot inherit its review", async () => {
  let finish!: (v: unknown) => void;
  state.request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  submit();
  const signal = state.request.mock.calls[0]![1].signal as AbortSignal;
  cleanup();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ data: preview() }));
  expect(state.review).not.toHaveBeenCalled();
});
it("shows scope and retained source explanations without calling a responsibility change a role change", () => {
  const value = preview();
  value.scheduled = true;
  value.retained = [
    {
      ...value.added[0]!,
      sources: [
        {
          assignmentId: null,
          label: "Another active responsibility",
          scope: "BRANCH",
          kind: "OTHER",
        },
      ],
    },
  ];
  value.visibility = "DELEGATED";
  render(<WorkforceAccessChange value={value} />);
  expect(
    screen.getByRole("region", { name: "Responsibility access change" }),
  ).toBeTruthy();
  expect(screen.getByText(/Other access sources stay private/)).toBeTruthy();
  expect(screen.getByText(/supplies no access before it starts/)).toBeTruthy();
  fireEvent.click(screen.getByText("Access retained (1)", { exact: true }));
  expect(
    screen.getByText("Why this access is available: Another active responsibility."),
  ).toBeTruthy();
});
it("rejects a fabricated current grant source, globalised branch and preview context", () => {
  const r = record(),
    source = {
      id: id(700),
      userId: r.userId,
      template: "WORKSHOP_LEAD" as const,
      templateVersion: 1,
      branchId: id(101),
      scope: "BRANCH" as const,
      temporary: false,
      startsAt: stamp,
      expiresAt: null,
      reason: "Reviewed fixture",
      assignedByUserId: id(302),
      createdAt: stamp,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
    };
  r.assignments = [source];
  r.activeAssignmentIds = [source.id];
  r.assignmentDefinitions = { [source.id]: r.templates.WORKSHOP_LEAD! };
  r.effectiveAccess!.grants = [
    {
      ...preview().added[0]!,
      sources: [
        {
          assignmentId: source.id,
          label: "Workshop / Quality Service Lead",
          scope: "BRANCH",
          kind: "ASSIGNMENT",
        },
      ],
    },
  ];
  expect(parseWorkforceAccount(r).effectiveAccess!.grants).toHaveLength(1);
  const originalBranch = r.effectiveAccess!.grants[0]!.branch;
  r.effectiveAccess!.grants[0]!.branch = { id: id(999), name: "Foreign branch" };
  expect(() => parseWorkforceAccount(r)).toThrow();
  r.effectiveAccess!.grants[0]!.branch = originalBranch;
  r.effectiveAccess!.grants[0]!.sources[0]!.assignmentId = id(999);
  expect(() => parseWorkforceAccount(r)).toThrow();
  expect(() =>
    parseWorkforceAccessPreview(preview(), {
      userId: r.userId,
      expectedVersion: 1,
      operation: "assign",
    }),
  ).toThrow();
});
it("validates private retained access against the server-declared delegation scope", () => {
  const r = record();
  r.management.branchIds = [id(101)];
  r.management.delegationCapabilities = [{ capability: "JOBS_READ", scope: "ASSIGNED" }];
  const value = preview();
  value.operation = "revoke";
  value.visibility = "DELEGATED";
  value.retained = [
    {
      ...value.added[0]!,
      sources: [
        {
          assignmentId: null,
          label: "Another active responsibility",
          scope: "BRANCH",
          kind: "OTHER",
        },
      ],
    },
  ];
  value.added = [];
  const context = {
    userId: r.userId,
    expectedVersion: 0,
    operation: "revoke" as const,
    account: r,
    input: { assignmentId: id(700) },
  };
  expect(() => parseWorkforceAccessPreview(value, context)).toThrow();
  value.retained[0]!.scope = "ASSIGNED";
  value.retained[0]!.sources[0]!.scope = "ASSIGNED";
  expect(parseWorkforceAccessPreview(value, context).retained[0]!.scope).toBe("ASSIGNED");
  value.retained[0]!.branch = { id: id(999), name: "Foreign branch" };
  expect(() => parseWorkforceAccessPreview(value, context)).toThrow();
});
it("states the inactive and account-baseline boundaries beside the current breakdown", () => {
  const value = record().effectiveAccess!;
  value.baseline = "INACTIVE";
  render(<WorkforceEffectiveAccess value={value} />);
  expect(screen.getByText(/while inactive or unverified/)).toBeTruthy();
  expect(
    screen.getByText(/account-level permissions are not itemized here/),
  ).toBeTruthy();
  expect(screen.getByText("No currently active responsibility grants.")).toBeTruthy();
});
