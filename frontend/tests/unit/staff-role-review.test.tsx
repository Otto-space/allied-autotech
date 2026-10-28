// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StaffAccessForm } from "@/app/components/staff-access-form";
import type { MutationProposal } from "@/app/components/mutation-review";
import { directoryRow, id } from "../fixtures/work-staff-directory";
import { staffWorkforceRecord } from "../fixtures/work-staff-detail";
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: state.request,
}));
vi.mock("@/app/components/admin-branch-picker", () => ({
  AdminBranchPicker: ({
    id: fieldId,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (id: string, label: string) => void;
  }) => (
    <input
      id={fieldId}
      value={value}
      onChange={(e) => onChange(e.target.value, "Fixture approved branch")}
    />
  ),
}));
const member = () => ({ ...directoryRow(), role: "ADMIN" as const });
beforeEach(() => {
  state.request.mockReset();
});
afterEach(cleanup);
function setup() {
  const onReview = vi.fn<(proposal: MutationProposal) => void>();
  render(
    <StaffAccessForm
      member={member()}
      superAdmin
      disabled={false}
      uncertain={false}
      onReview={onReview}
    />,
  );
  fireEvent.change(screen.getByLabelText("Account change"), {
    target: { value: "role" },
  });
  fireEvent.change(screen.getByLabelText("New active branch"), {
    target: { value: id(102) },
  });
  return onReview;
}
it("requires the operator's reason before looking up dependencies or offering a role change", async () => {
  const review = setup();
  fireEvent.click(screen.getByRole("button", { name: "Review account change" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("at least 10"),
  );
  expect(review).not.toHaveBeenCalled();
  expect(state.request).not.toHaveBeenCalled();
});
it("a failed dependency read offers recovery and cannot open a partial role review", async () => {
  const review = setup();
  state.request.mockRejectedValue(Error("Network unavailable"));
  fireEvent.change(screen.getByLabelText("Reason for role change"), {
    target: { value: "Reviewed management responsibility transition" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review account change" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "could not verify the responsibilities",
    ),
  );
  expect(review).not.toHaveBeenCalled();
  expect(state.request).toHaveBeenCalledTimes(1);
});
it("reviews removed and retained authority and submits both reviewed revisions with the reason", async () => {
  const review = setup(),
    workforce = staffWorkforceRecord(),
    u = member();
  workforce.access = {
    userId: u.id,
    position: "WORKSHOP_LEAD",
    enabledAt: "2026-10-19T08:00:00.000Z",
    version: 7,
    delegatedTemplates: ["CUSTOMER_SERVICE", "ADMIN_INVITE"],
    delegatedBranchIds: [id(101)],
  };
  state.request.mockResolvedValueOnce({ data: workforce });
  const reason = "Reviewed management responsibility transition";
  fireEvent.change(screen.getByLabelText("Reason for role change"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review account change" }));
  await waitFor(() => expect(review).toHaveBeenCalledOnce());
  const proposal = review.mock.calls[0]![0];
  expect(proposal.description).toContain("removed atomically");
  expect(proposal.facts).toContainEqual({
    label: "Removed management authority",
    value: "2 delegation entries across 1 approved branches",
  });
  expect(proposal.facts).toContainEqual({ label: "Reason", value: reason });
  // Review reads only. The consequential request exists solely behind its confirm action.
  expect(state.request).toHaveBeenCalledTimes(1);
  state.request.mockResolvedValueOnce({ data: u }).mockResolvedValueOnce({
    data: {
      ...u,
      role: "STAFF",
      staffProfile: { ...u.staffProfile!, branchId: id(102) },
    },
  });
  await proposal.submit();
  expect(state.request.mock.calls[2]).toEqual([
    `/admin/staff/${u.id}/role`,
    {
      method: "PATCH",
      csrf: true,
      body: {
        role: "STAFF",
        branchId: id(102),
        expectedRevision: [
          u.updatedAt,
          u.role,
          u.status,
          u.staffProfile!.updatedAt,
          u.staffProfile!.branchId,
        ].join(":"),
        expectedWorkforceVersion: 7,
        reason,
      },
    },
  ]);
});

it("preserves the status-change contract without a role reason or workforce lookup", async () => {
  const onReview = vi.fn<(proposal: MutationProposal) => void>(),
    u = member();
  render(
    <StaffAccessForm
      member={u}
      superAdmin
      disabled={false}
      uncertain={false}
      onReview={onReview}
    />,
  );
  fireEvent.change(screen.getByLabelText("New account status"), {
    target: { value: "SUSPENDED" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review account change" }));
  await waitFor(() => expect(onReview).toHaveBeenCalledOnce());
  expect(state.request).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Reason for role change")).toBeNull();
  state.request
    .mockResolvedValueOnce({ data: u })
    .mockResolvedValueOnce({ data: { id: u.id, status: "SUSPENDED" } });
  await onReview.mock.calls[0]![0].submit();
  expect(state.request.mock.calls[1]).toEqual([
    `/admin/staff/${u.id}/status`,
    {
      method: "PATCH",
      csrf: true,
      body: {
        status: "SUSPENDED",
        expectedRevision: [
          u.updatedAt,
          u.role,
          u.status,
          u.staffProfile!.updatedAt,
          u.staffProfile!.branchId,
        ].join(":"),
      },
    },
  ]);
});
