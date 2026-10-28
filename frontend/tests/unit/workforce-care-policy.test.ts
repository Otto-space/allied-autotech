import { expect, it } from "vitest";
import { workforceBody } from "@/lib/admin/work-staff-workforce";
import { workforceTemplateSchema } from "@/lib/api/workforce-schemas";
import { workforcePositionSchema } from "@/lib/api/workforce-positions";
import { workforceDirectoryQuerySchema } from "@/lib/api/workforce-directory-schemas";
import { id } from "../fixtures/work-staff-detail";

const proof = {
  currentPassword: "Synthetic local proof",
  reason: "Reviewed synthetic duty",
  expectedVersion: 0,
};
it("keeps new duties out of positions and preserves the CEO promotion restriction", () => {
  for (const template of [
    "CARE_VIEWER",
    "CARE_RESPONDER",
    "CARE_ASSIGNER",
    "CARE_LIVE_AGENT",
  ]) {
    expect(workforceTemplateSchema.safeParse(template).success).toBe(true);
    expect(workforcePositionSchema.safeParse(template).success).toBe(false);
    expect(workforceDirectoryQuerySchema.safeParse({ position: template }).success).toBe(
      false,
    );
    expect(() => workforceBody("enroll", { ...proof, position: template })).toThrow();
  }
  expect(workforcePositionSchema.safeParse("CEO_MD").success).toBe(true);
  expect(() => workforceBody("enroll", { ...proof, position: "CEO_MD" })).toThrow();
  expect(workforceBody("enroll", { ...proof, position: "ACCOUNTANT" }).position).toBe(
    "ACCOUNTANT",
  );
});
it("sends explicit pinned versions for reviewed new assignments and delegation", () => {
  const body = workforceBody("assign", {
    ...proof,
    template: "CARE_VIEWER",
    expectedTemplateVersion: 2,
    branchId: id(101),
    temporary: false,
    startsAt: "2026-10-27T08:00:00.000Z",
    expiresAt: null,
  });
  expect(body.template).toBe("CARE_VIEWER");
  expect(body.expectedTemplateVersion).toBe(2);
  const delegation = workforceBody("delegate", {
    ...proof,
    templates: workforceTemplateSchema.options,
    branchIds: [id(101)],
    allowAdminInvitations: false,
    expectedPolicyVersion: 2,
  });
  expect(delegation.templates).toHaveLength(12);
  expect(delegation.expectedPolicyVersion).toBe(2);
});
