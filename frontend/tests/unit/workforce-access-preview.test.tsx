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
  expect(screen.getByText(/Other grant sources stay private/)).toBeTruthy();
  expect(screen.getByText(/supplies no access before it starts/)).toBeTruthy();
  fireEvent.click(screen.getByText("Access retained (1)", { exact: true }));
  expect(screen.getByText("Supplied by: Another active responsibility.")).toBeTruthy();
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
    screen.getByText(/Account baseline and separately granted permissions/),
  ).toBeTruthy();
  expect(screen.getByText("No currently active responsibility grants.")).toBeTruthy();
});
