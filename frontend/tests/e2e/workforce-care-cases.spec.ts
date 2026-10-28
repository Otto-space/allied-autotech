import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import { careCasesFixture } from "../fixtures/workforce-care-cases";
import { verifyConsole } from "../fixtures/preview-console";
type Kind = "enquiries" | "complaints";
const body = "Fixture unsent public reply: please share the missing vehicle details.",
  reason = "Fixture internal reason: reviewed same-branch colleague coverage.";
const prefix = (kind: Kind) => (kind === "enquiries" ? "wfe" : "wfc");
async function observe(page: Page, allowFixtureFailures = false) {
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
    if (m.type() === "error") {
      const syntheticFailure =
        allowFixtureFailures &&
        /\/api\/v1\/staff\/workforce\/(?:enquiries|complaints)/.test(m.location().url) &&
        /^Failed to load resource:/.test(m.text()) &&
        /409|503|408|429|ERR_FAILED/.test(m.text());
      if (!syntheticFailure) errors.push(m.text());
    }
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(r.url()).hostname)
    )
      external.push(r.url());
  });
  return async () => {
    expect(external).toEqual([]);
    await verifyConsole(page, errors, warnings);
  };
}
async function audit(page: Page, selector = "main") {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(selector)
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
async function open(page: Page, state: Awaited<ReturnType<typeof careCasesFixture>>) {
  await page.goto(`/admin/workforce/${state.kind}?selected=${state.row.id}`);
  await expect(
    page.getByRole("heading", { name: state.row.subject, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conversation", exact: true }),
  ).toBeVisible();
}
async function assignment(page: Page, kind: Kind) {
  await page.getByRole("button", { name: "Change assignee", exact: true }).click();
  await page
    .locator(`#${prefix(kind)}-staff`)
    .getByRole("radio", { name: /Fixture Responder/ })
    .check();
  await page
    .getByLabel(kind === "enquiries" ? "Reassignment reason" : "Assignment reason", {
      exact: true,
    })
    .fill(reason);
  await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Internal assignment reason");
  await expect(page.getByRole("dialog")).toContainText(reason);
}

for (const width of [320, 390, 768, 1440])
  for (const kind of ["enquiries", "complaints"] as const)
    for (const role of ["STAFF", "ADMIN"] as const)
      test(`${role} view-only ${kind} at ${width}px shows the case without reply or assignment controls`, async ({
        page,
      }) => {
        const state = await careCasesFixture(page, kind, ["CARE_VIEWER"], role),
          finish = await observe(page);
        await page.setViewportSize({ width, height: 1000 });
        await open(page, state);
        await expect(page.locator(".care-context")).toContainText(
          kind === "enquiries" ? "care-fixture@example.test" : "Fixture customer",
        );
        await expect(
          page.getByText(/Your current responsibilities allow viewing/),
        ).toBeVisible();
        await expect(page.locator(`#${prefix(kind)}-body`)).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Change assignee", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Write a reply", exact: true }),
        ).toHaveCount(0);
        if (kind === "enquiries")
          await expect(page.locator('#wfe-type option[value="GENERAL"]')).toHaveCount(1);
        expect(state.writes).toEqual([]);
        expect(state.f.writes).toEqual([]);
        expect(
          state.f.base.requests.some((p) =>
            /^\/admin\/(?:customers|support|staff)/.test(p),
          ),
        ).toBe(false);
        await audit(page);
        if (role === "STAFF" && [390, 1440].includes(width))
          await page.screenshot({
            path: path.join(os.tmpdir(), `allied-care-view-${kind}-${width}.png`),
          });
        await finish();
      });

for (const kind of ["enquiries", "complaints"] as const)
  for (const sample of [
    { role: "STAFF" as const, width: 390 },
    { role: "ADMIN" as const, width: 390 },
    { role: "STAFF" as const, width: 1440 },
  ])
    test(`${sample.role} ${kind} at ${sample.width}px reviews assignment separately and retains the unsent reply`, async ({
      page,
    }) => {
      const state = await careCasesFixture(
          page,
          kind,
          ["CARE_VIEWER", "CARE_RESPONDER", "CARE_ASSIGNER"],
          sample.role,
        ),
        finish = await observe(page);
      await page.setViewportSize({ width: sample.width, height: 1000 });
      await open(page, state);
      const reply = page.locator(`#${prefix(kind)}-body`);
      await reply.fill(body);
      await page.getByRole("button", { name: "Review reply", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("Customer-visible reply");
      await expect(page.getByRole("dialog")).toContainText(body);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Go back", exact: true })
        .press("Enter");
      await expect(reply).toHaveValue(body);
      await assignment(page, kind);
      const dialog = page.getByRole("dialog");
      await expect(dialog).not.toContainText(body);
      expect(state.writes).toHaveLength(0);
      expect(state.f.writes).toHaveLength(0);
      await audit(page, "dialog");
      if (sample.role === "STAFF")
        await page.screenshot({
          path: path.join(os.tmpdir(), `allied-care-assign-${kind}-${sample.width}.png`),
        });
      await dialog.getByRole("button", { name: "Go back", exact: true }).press("Enter");
      await expect(page.locator(`#${prefix(kind)}-reason`)).toHaveValue(reason);
      await expect(reply).toHaveValue(body);
      await page
        .getByRole("button", { name: "Review reassignment", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true })
        .press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(reply).toHaveValue(body);
      expect(state.writes).toHaveLength(1);
      expect(state.writes[0].body).toMatchObject({ staffId: state.candidate.id, reason });
      await expect(page.locator(`#${prefix(kind)}-reason`)).toHaveValue("");
      await page.getByRole("button", { name: "Review reply", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText(body);
      await expect(page.getByRole("dialog")).not.toContainText(reason);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true })
        .press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(reply).toHaveValue("");
      expect(state.writes).toHaveLength(1);
      expect(state.f.writes).toHaveLength(1);
      expect(state.f.writes[0].body.body).toBe(body);
      expect(state.f.writes[0].body).not.toHaveProperty("reason");
      await expect(page).toHaveURL(new RegExp(`selected=${state.row.id}`));
      await audit(page);
      await finish();
    });

for (const kind of ["enquiries", "complaints"] as const)
  for (const mode of ["lost", "malformed", "timeout", "throttled"] as const)
    test(`${kind} ${mode} assignment stays blocked through reload until explicit reconciliation`, async ({
      page,
    }) => {
      const state = await careCasesFixture(
          page,
          kind,
          ["CARE_VIEWER", "CARE_RESPONDER", "CARE_ASSIGNER"],
          "ADMIN",
        ),
        finish = await observe(page, true);
      await page.setViewportSize({ width: 390, height: 1000 });
      await open(page, state);
      await assignment(page, kind);
      state.mode = mode;
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "The outcome could not be confirmed.",
      );
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Confirm change", exact: true }),
      ).toBeDisabled();
      state.mode = "normal";
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: `Review an earlier ${kind === "enquiries" ? "enquiry" : "complaint"} change`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeDisabled();
      expect(state.writes).toHaveLength(1);
      expect(state.f.writes).toHaveLength(0);
      expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(
        reason,
      );
      await page
        .getByRole("button", {
          name: `Inspect current ${kind === "enquiries" ? "enquiry" : "complaint"}`,
          exact: true,
        })
        .click();
      await page.getByRole("checkbox", { name: /independently reconciled/ }).check();
      await page
        .getByRole("button", { name: "Finish reconciliation", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Review reply", exact: true }),
      ).toBeEnabled();
      expect(state.writes).toHaveLength(1);
      expect(state.f.writes).toHaveLength(0);
      await audit(page);
      await finish();
    });

for (const kind of ["enquiries", "complaints"] as const) {
  test(`${kind} rejected assignment keeps editable fields and requires a new review`, async ({
    page,
  }) => {
    const state = await careCasesFixture(page, kind, ["CARE_VIEWER", "CARE_ASSIGNER"]),
      finish = await observe(page, true);
    await page.setViewportSize({ width: 390, height: 1000 });
    await open(page, state);
    await assignment(page, kind);
    state.mode = "rejected";
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm change", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Go back", exact: true })
      .click();
    await expect(page.locator(`#${prefix(kind)}-reason`)).toHaveValue(reason);
    await expect(
      page.getByRole("heading", { name: /Review an earlier .* change/ }),
    ).toHaveCount(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm change", exact: true }),
    ).toBeEnabled();
    expect(state.writes).toHaveLength(1);
    await finish();
  });
  test(`${kind} failed candidate loading keeps the reason and never opens a save review`, async ({
    page,
  }) => {
    const state = await careCasesFixture(page, kind, ["CARE_VIEWER", "CARE_ASSIGNER"]),
      finish = await observe(page, true);
    state.mode = "candidate-failure";
    await page.setViewportSize({ width: 390, height: 1000 });
    await open(page, state);
    await page.getByRole("button", { name: "Change assignee", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Retry staff options", exact: true }),
    ).toBeVisible();
    await page.locator(`#${prefix(kind)}-reason`).fill(reason);
    await page.getByRole("button", { name: "Review reassignment", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`#${prefix(kind)}-reason`)).toHaveValue(reason);
    expect(state.writes).toHaveLength(0);
    state.mode = "normal";
    await page.getByRole("button", { name: "Retry staff options", exact: true }).click();
    await expect(
      page
        .locator(`#${prefix(kind)}-staff`)
        .getByRole("radio", { name: /Fixture Responder/ }),
    ).toBeVisible();
    await finish();
  });
  test(`${kind} assignment revocation disposes an open review and its protected action draft`, async ({
    page,
  }) => {
    const state = await careCasesFixture(
        page,
        kind,
        ["CARE_VIEWER", "CARE_ASSIGNER"],
        "ADMIN",
      ),
      finish = await observe(page);
    await page.setViewportSize({ width: 390, height: 1000 });
    await open(page, state);
    await assignment(page, kind);
    state.revoke("CARE_CASE_ASSIGN");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`#${prefix(kind)}-reason`)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: state.row.subject, exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(0);
    await finish();
  });
}
