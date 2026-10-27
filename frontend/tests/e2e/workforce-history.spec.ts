import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";

for (const width of [320, 390, 768, 1440])
  test(`unsupported history stays readable and separate from current grants at ${width}`, async ({
    page,
  }) => {
    const f = await workStaffDetailFixture(page, "SUPER_ADMIN");
    const stamp = "2026-10-26T10:00:00.000Z";
    const known = {
      id: id(951),
      userId: f.member.id,
      template: "MECHANICAL_TECHNICIAN",
      templateVersion: 1,
      branchId: id(101),
      scope: "ASSIGNED",
      temporary: false,
      startsAt: stamp,
      expiresAt: null,
      reason: "Synthetic current assignment",
      assignedByUserId: id(302),
      createdAt: stamp,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
    };
    const oldTemplate = ("RETIRED_" + "DIAGNOSTICS_".repeat(7)).slice(0, 80);
    f.workforce = {
      ...f.workforce,
      access: {
        userId: f.member.id,
        position: "RETIRED_WORKSHOP_ROLE",
        version: 0,
        enabledAt: stamp,
        delegatedTemplates: [],
        delegatedBranchIds: [],
        delegationPolicyVersion: 1,
      },
      management: {
        ...f.workforce.management,
        canEnroll: true,
        canAssign: true,
        canRevoke: true,
      },
      assignments: [
        known,
        {
          ...known,
          id: id(952),
          template: oldTemplate,
          templateVersion: 7,
          reason: "Synthetic unsupported definition",
        },
        {
          ...known,
          id: id(953),
          scope: "LEGACY_ZONE",
          reason: "Synthetic unsupported scope",
        },
      ],
      activeAssignmentIds: [known.id],
      assignmentDefinitions: {
        [known.id]: f.workforce.templates["MECHANICAL_TECHNICIAN"]!,
        [id(952)]: null,
        [id(953)]: null,
      },
      effectiveAccess: {
        baseline: "MANAGED",
        visibility: "FULL",
        evaluatedAt: stamp,
        responsibilityGrantsOnly: true,
        grants: ["JOBS_READ", "JOBS_UPDATE"].map((capability) => ({
          capability,
          label:
            capability === "JOBS_READ" ? "View workshop jobs" : "Record workshop work",
          branch: { id: id(101), name: "Stadium Road workshop" },
          scope: "ASSIGNED",
          sources: [
            {
              assignmentId: known.id,
              label: "Mechanical Technician",
              scope: "ASSIGNED",
              kind: "ASSIGNMENT",
            },
          ],
        })),
      },
    };
    const writes: string[] = [],
      errors: string[] = [],
      external: string[] = [];
    page.on("request", (request) => {
      if (!/^(GET|HEAD|OPTIONS)$/.test(request.method()))
        writes.push(new URL(request.url()).pathname);
      if (
        /^https?:/.test(request.url()) &&
        !["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)
      )
        external.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/admin/staff/${f.member.id}`);
    const panel = page.locator(".workforce-panel");
    await expect(
      panel.getByRole("heading", { name: "Responsibilities & temporary cover" }),
    ).toBeVisible();
    await panel.getByText("Update job position", { exact: true }).click();
    await expect(
      panel.getByRole("combobox", { name: "Job position", exact: true }),
    ).toHaveValue("");
    await panel.getByText("Update job position", { exact: true }).click();
    await expect(
      panel.getByRole("heading", { name: /Unrecognised responsibility/ }),
    ).toBeVisible();
    await expect(panel.getByText(/Unrecognised scope: LEGACY_ZONE/)).toBeVisible();
    const unknown = panel.locator(".wf-assignments > li").filter({
      has: page.getByRole("heading", { name: /Unrecognised responsibility/ }),
    });
    await unknown.getByText("Assignment details", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(unknown.getByText(oldTemplate, { exact: true })).toBeVisible();
    await expect(unknown.getByText(/assignment grants no access/)).toBeVisible();
    await expect(panel.locator(".wf-effective")).toContainText("View workshop jobs");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".workforce-panel")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await unknown.getByText("Assignment details", { exact: true }).focus();
    await expect(page.locator(".skip-link").first()).not.toBeInViewport();
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-workforce-history-${width}.png`),
      });
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
