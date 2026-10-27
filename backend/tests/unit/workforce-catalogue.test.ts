import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assignmentAllows,
  currentWorkforceTemplateVersion,
  definitionForAssignment,
  supportedAssignmentPolicies,
  workforceTemplateVersions,
} from "../../src/modules/organization/workforce-catalogue.js";

describe("immutable reviewed workforce definitions", () => {
  it("pins the complete initial scope/action/label mapping instead of silently editing historical grants", () => {
    expect(currentWorkforceTemplateVersion).toBe(2);
    expect(
      createHash("sha256")
        .update(JSON.stringify(workforceTemplateVersions[1]))
        .digest("hex"),
    ).toBe("02c1b5da9d172ee163aebd0a66d070bdb4d290d7d165483f8fd43a2f1bb7ff05");
    expect(Object.isFrozen(workforceTemplateVersions)).toBe(true);
    for (const definition of Object.values(workforceTemplateVersions[1])) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.actions)).toBe(true);
    }
  });
  it("does not interpret unknown versions, templates, inherited properties or malformed scope using today's catalogue", () => {
    for (const assignment of [
      { template: "OPERATIONS", templateVersion: 99, scope: "BRANCH" },
      { template: "OPERATIONS", templateVersion: 0, scope: "BRANCH" },
      { template: "OPERATIONS", templateVersion: NaN, scope: "BRANCH" },
      { template: "constructor", templateVersion: 1, scope: "BRANCH" },
      { template: "MECHANICAL_TECHNICIAN", templateVersion: 1, scope: "BRANCH" },
      { template: "INVENTED_OWNER", templateVersion: 1, scope: "BRANCH" },
    ]) {
      expect(definitionForAssignment(assignment)).toBeUndefined();
      expect(assignmentAllows(assignment, "FINANCE_READ")).toBe(false);
    }
  });
  it("keeps fitment authorship and independent review distinct and supplies exact SQL scope/version combinations", () => {
    expect(
      assignmentAllows(
        { template: "OPERATIONS", templateVersion: 1, scope: "BRANCH" },
        "FITMENT_AUTHOR",
      ),
    ).toBe(true);
    expect(
      assignmentAllows(
        { template: "OPERATIONS", templateVersion: 1, scope: "BRANCH" },
        "FITMENT_REVIEW",
      ),
    ).toBe(false);
    expect(
      assignmentAllows(
        { template: "WORKSHOP_LEAD", templateVersion: 1, scope: "BRANCH" },
        "FITMENT_REVIEW",
      ),
    ).toBe(true);
    expect(supportedAssignmentPolicies()).toHaveLength(20);
    for (const pair of supportedAssignmentPolicies())
      expect(definitionForAssignment(pair)).toBeDefined();
  });
  it("keeps granular Care duties independent and out of historical version-one grants", () => {
    for (const [template, action] of [
      ["CARE_VIEWER", "CARE_CASE_VIEW"],
      ["CARE_RESPONDER", "CARE_PUBLIC_REPLY"],
      ["CARE_ASSIGNER", "CARE_CASE_ASSIGN"],
      ["CARE_LIVE_AGENT", "CARE_LIVE_ACCEPT"],
    ] as const) {
      const row = { template, templateVersion: 2, scope: "BRANCH" };
      expect(definitionForAssignment(row)?.actions).toEqual([action]);
      expect(assignmentAllows({ ...row, templateVersion: 1 }, action)).toBe(false);
      expect(
        assignmentAllows(
          { template: "CUSTOMER_SERVICE", templateVersion: 1, scope: "BRANCH" },
          action,
        ),
      ).toBe(false);
    }
    for (const [key, definition] of Object.entries(workforceTemplateVersions[1]))
      expect(
        workforceTemplateVersions[2][key as keyof (typeof workforceTemplateVersions)[1]],
      ).toBe(definition);
  });
});
