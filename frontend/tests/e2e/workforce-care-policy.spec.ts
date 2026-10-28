import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { workStaffDetailFixture, id } from "../fixtures/work-staff-detail";
import { workforceTemplateVersions } from "../../../backend/src/modules/organization/workforce-catalogue";
import { workforceActionLabels } from "../../../backend/src/modules/organization/workforce-effective-access";
import { verifyConsole } from "../fixtures/preview-console";

for (const width of [320, 390, 768, 1440])
  for (const version of [1, 2] as const)
    test(`reviewed Care catalogue ${version} stays separate from positions at ${width}px`, async ({
      page,
    }) => {
      const f = await workStaffDetailFixture(
        page,
        version === 2 ? "SUPER_ADMIN" : "ADMIN",
      );
      const w = f.workforce,
        catalogue = workforceTemplateVersions[version],
        template = version === 2 ? "CARE_VIEWER" : "CUSTOMER_SERVICE",
        definition = catalogue[template as keyof typeof catalogue],
        errors: string[] = [],
        warnings: string[] = [],
        previews: Record<string, unknown>[] = [],
        writes: string[] = [];
      w.templatesVersion = version;
      w.templates = Object.fromEntries(
        Object.entries(catalogue).map(([key, value]) => [
          key,
          { ...value, actions: [...value.actions] },
        ]),
      );
      w.access = {
        userId: w.userId,
        position: "MECHANICAL_TECHNICIAN",
        version: 0,
        enabledAt: "2026-10-19T08:00:00.000Z",
        delegatedTemplates: [],
        delegatedBranchIds: [],
        delegationPolicyVersion: 1,
      };
      Object.assign(w.management, {
        canEnroll: version === 2,
        canAssign: true,
        canRevoke: true,
        branchIds: version === 2 ? null : [id(101)],
        delegationCapabilities:
          version === 2
            ? null
            : definition.actions.map((capability) => ({
                capability,
                scope: definition.scope,
              })),
        templates: version === 2 ? Object.keys(catalogue) : ["CUSTOMER_SERVICE"],
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
        if (m.type() === "warning") warnings.push(m.text());
      });
      await page.route("**/api/v1/admin/branches?**", (route) =>
        route.fulfill({
          json: {
            success: true,
            message: "Synthetic branches",
            meta: { requestId: "care-policy-branches" },
            data: { items: w.branches },
          },
        }),
      );
      if (version === 1) {
        const ok = (data: unknown) => ({
          json: {
            success: true,
            data,
            message: "Isolated delegated manager",
            meta: { requestId: "care-policy-manager" },
          },
        });
        await page.route("**/api/v1/auth/session", (route) =>
          route.fulfill(
            ok({
              id: id(301),
              user: { id: id(302), email: "manager@example.test", role: "ADMIN" },
              workforceManaged: true,
              mfaRequired: true,
              mfaVerifiedAt: "2026-10-27T01:00:00.000Z",
              expiresAt: "2027-01-01T00:00:00.000Z",
              idleExpiresAt: "2027-01-01T00:00:00.000Z",
            }),
          ),
        );
        await page.route("**/api/v1/staff/workforce/access", (route) =>
          route.fulfill(
            ok({
              managed: true,
              userId: id(302),
              staffId: id(601),
              position: "OPERATIONS",
              department: "Strategy",
              version: 1,
              assignments: [],
              permissions: [],
              canManageAssignments: true,
              canInviteAdmins: false,
              serverTime: new Date().toISOString(),
            }),
          ),
        );
      }
      await page.route("**/api/v1/admin/workforce/accounts/**", async (route) => {
        if (route.request().method() === "GET") return route.fallback();
        if (!new URL(route.request().url()).pathname.endsWith("/access-preview")) {
          writes.push(route.request().method());
          return route.fulfill({ status: 405 });
        }
        const body = route.request().postDataJSON();
        previews.push(body);
        return route.fulfill({
          json: {
            success: true,
            message: "Isolated policy preview",
            meta: { requestId: "care-policy-preview" },
            data: {
              userId: w.userId,
              expectedVersion: 0,
              operation: "assign",
              evaluatedAt: new Date().toISOString(),
              scheduled: false,
              visibility: version === 2 ? "FULL" : "DELEGATED",
              fingerprint: "c".repeat(64),
              responsibilityGrantsOnly: true,
              added: definition.actions.map((capability) => ({
                capability,
                label: workforceActionLabels[capability],
                branch: { id: id(101), name: "Stadium Road workshop" },
                scope: definition.scope,
                sources: [
                  {
                    assignmentId: null,
                    label: definition.label,
                    scope: definition.scope,
                    kind: "PROPOSED",
                  },
                ],
              })),
              removed: [],
              retained: [],
            },
          },
        });
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/admin/workforce/access/${f.member.id}`);
      if (version === 2) {
        const position = page.getByLabel("Job position", { exact: true });
        await page.getByText("Update job position", { exact: true }).click();
        await expect(position).toBeVisible();
        for (const key of [
          "CARE_VIEWER",
          "CARE_RESPONDER",
          "CARE_ASSIGNER",
          "CARE_LIVE_AGENT",
          "CEO_MD",
        ])
          await expect(position.locator(`option[value="${key}"]`)).toHaveCount(0);
      }
      await page.getByText("Assign responsibility", { exact: true }).click();
      const form = page
        .locator("form")
        .filter({ has: page.locator("#workforce-template") });
      await expect(
        form
          .getByLabel("Responsibility", { exact: true })
          .locator('option[value="CARE_VIEWER"]'),
      ).toHaveCount(version === 2 ? 1 : 0);
      await form.getByLabel("Responsibility", { exact: true }).selectOption(template);
      await form.getByLabel("Branch", { exact: true }).selectOption(id(101));
      await form.getByLabel("Starts at (your device time)").fill("2026-10-27T01:00");
      await form
        .getByLabel("Reason", { exact: true })
        .fill("Reviewed synthetic branch Care duty");
      await form
        .getByLabel("Your current password", { exact: true })
        .fill("Synthetic proof only");
      await form
        .getByRole("button", { name: "Review responsibility assignment" })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(definition.label);
      await expect(dialog).toContainText(workforceActionLabels[definition.actions[0]]);
      expect(previews).toHaveLength(1);
      expect(previews[0].expectedTemplateVersion).toBe(version);
      expect(previews[0]).not.toHaveProperty("currentPassword");
      expect(writes).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      if (version === 2 && [390, 1440].includes(width)) {
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-care-policy-review-${width}.png`),
        });
        await dialog
          .getByText(workforceActionLabels[definition.actions[0]], { exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-care-policy-access-${width}.png`),
        });
      }
      const back = dialog.getByRole("button", { name: "Go back", exact: true });
      await back.focus();
      await back.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(form.getByLabel("Reason", { exact: true })).toHaveValue(
        "Reviewed synthetic branch Care duty",
      );
      await expect(form.getByLabel("Responsibility", { exact: true })).toHaveValue(
        template,
      );
      expect(writes).toEqual([]);
      await verifyConsole(page, errors, warnings);
    });
