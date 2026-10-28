import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import os from "node:os";
import path from "node:path";
import { allieHandoffFixture } from "../fixtures/allie-handoff";
import { verifyConsole } from "../fixtures/preview-console";

const summary =
  "Synthetic editable summary: please help me check the missing fitment evidence.";
function observe(page: Page) {
  const errors: string[] = [],
    warnings: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Expected fixture failure statuses are asserted by their recovery journeys.
    if (
      m.type() === "error" &&
      !m.text().startsWith("Failed to load resource") &&
      !m.text().includes("net::ERR_FAILED")
    )
      errors.push(m.text());
    if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== "127.0.0.1")
      external.push(r.url());
  });
  return { errors, warnings, external };
}
async function open(page: Page, editable = true) {
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Customer Care · leave a message" }).click();
  if (editable)
    await expect(
      panel.getByRole("button", { name: "Review message", exact: true }),
    ).toBeEnabled();
  return panel;
}
async function fill(page: Page) {
  const panel = await open(page);
  await panel
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Synthetic part question");
  await panel.getByRole("textbox", { name: /Your issue summary/ }).fill(summary);
  await panel.getByRole("radio", { name: "Synthetic workshop", exact: true }).check();
  return panel;
}
for (const width of [360, 390, 768, 1024, 1440])
  test(`explicit queued handoff review, edit, exact save and canonical link at ${width}px`, async ({
    page,
  }) => {
    const state = await allieHandoffFixture(page),
      seen = observe(page);
    state.help.data.flags.ai = false;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/help");
    await expect(page).toHaveTitle(/Help centre/i);
    const panel = await fill(page);
    await panel
      .getByRole("button", { name: "Review message", exact: true })
      .press("Enter");
    await expect(
      panel.getByRole("heading", { name: "Review your message" }),
    ).toBeFocused();
    await expect(panel.getByLabel("Exact message to Customer Care")).toContainText(
      summary,
    );
    await expect(panel).toContainText("Customer Care · Synthetic workshop");
    expect(state.created).toBe(0);
    await panel.getByRole("button", { name: "Go back and edit" }).click();
    await expect(panel.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
      summary,
    );
    await panel.getByRole("button", { name: "Review message", exact: true }).click();
    await expect(
      panel.getByRole("heading", { name: "Review your message" }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".allie-dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-handoff-review-${width}.png`),
    });
    const storage = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain(summary);
    expect(storage).not.toContain('"token"');
    await panel
      .getByRole("button", { name: "Send message to Customer Care" })
      .press("Enter");
    await expect(
      panel.getByRole("heading", { name: "Your message is saved" }),
    ).toBeFocused();
    await expect(
      panel.getByRole("link", { name: "Open your Customer Care conversation" }),
    ).toHaveAttribute("href", /\/dashboard\/support\/enquiries\/[a-f0-9-]{36}$/);
    expect(state.created).toBe(1);
    expect(state.help.unexpected).toEqual([]);
    expect(seen.external).toEqual([]);
    await verifyConsole(page, seen.errors, seen.warnings);
  });
test("lost acknowledgement survives reload and recovers a single saved request", async ({
  page,
}) => {
  const state = await allieHandoffFixture(page);
  state.loseSave = true;
  await page.goto("/help");
  const panel = await fill(page);
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await panel.getByRole("button", { name: "Send message to Customer Care" }).click();
  await expect(panel.getByRole("alert")).toContainText("could not be verified");
  await page.reload();
  await open(page, false);
  await expect(
    page.getByRole("heading", { name: "Your message is saved" }),
  ).toBeVisible();
  expect(state.created).toBe(1);
  expect(
    state.writes.filter((x) => x.path === "/customers/support/handoff"),
  ).toHaveLength(1);
  expect(state.help.unexpected).toEqual([]);
});
for (const kind of ["enquiries", "complaints"] as const)
  test(`explicitly appends to an owned ${kind} choice, never creates a second case`, async ({
    page,
  }) => {
    const state = await allieHandoffFixture(page);
    await page.goto("/help");
    const panel = await open(page);
    await panel
      .getByRole("combobox", { name: "Support destination" })
      .selectOption(kind === "enquiries" ? "ENQUIRY" : "COMPLAINT");
    await panel
      .getByRole("radio", { name: `Synthetic existing ${kind}`, exact: true })
      .check();
    if (kind === "enquiries")
      await expect(
        panel.getByRole("radio", { name: /Synthetic closed request/ }),
      ).toBeDisabled();
    await panel.getByRole("textbox", { name: /Your issue summary/ }).fill(summary);
    await panel.getByRole("button", { name: "Review message", exact: true }).click();
    await expect(panel).toContainText(`Synthetic existing ${kind}`);
    await panel.getByRole("button", { name: "Send message to Customer Care" }).click();
    await expect(
      panel.getByRole("heading", { name: "Your message is saved" }),
    ).toBeVisible();
    expect(state.created).toBe(0);
    expect(state.replies).toBe(1);
    expect(state.help.unexpected).toEqual([]);
  });
test("back to help and closing the widget preserve the manual summary without browser payload storage", async ({
  page,
}) => {
  const state = await allieHandoffFixture(page);
  await page.goto("/help");
  const panel = await fill(page);
  await panel.getByRole("button", { name: "Back to help · keep my draft" }).click();
  await panel.getByRole("button", { name: "Customer Care · leave a message" }).click();
  await expect(panel.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    summary,
  );
  await page.keyboard.press("Escape");
  await open(page);
  await expect(page.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    summary,
  );
  expect(state.writes).toEqual([]);
  expect(state.help.unexpected).toEqual([]);
});
test("stale recovered context is removed and requires cancellation before a new review", async ({
  page,
}) => {
  const state = await allieHandoffFixture(page);
  await page.goto("/help");
  const panel = await fill(page);
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Review your message" })).toBeVisible();
  state.stale = true;
  await page.reload();
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  await page.getByRole("button", { name: "Customer Care · leave a message" }).click();
  await expect(
    page.getByRole("button", { name: "Review message", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Stale help excerpts were removed/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel old operation and edit" }).click();
  await expect(page.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    summary,
  );
  await expect(
    page.getByRole("button", { name: "Review message", exact: true }),
  ).toBeEnabled();
  expect(state.created).toBe(0);
});
for (const role of ["PUBLIC", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)
  test(`${role} never gets a customer transcript-forwarding form`, async ({ page }) => {
    const state = await allieHandoffFixture(page, role);
    await page.goto("/help");
    await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
    const panel = page.getByRole("dialog");
    await expect(
      panel.getByRole("button", { name: "Customer Care · leave a message" }),
    ).toHaveCount(0);
    if (role === "PUBLIC")
      await expect(
        panel.getByRole("link", { name: "Leave a message for Customer Care" }),
      ).toHaveAttribute("href", "/contact");
    else await expect(panel).toContainText("Workforce guidance is not forwarded");
    expect(state.writes).toEqual([]);
    expect(state.help.unexpected).toEqual([]);
  });

test("shares only a deliberately selected help question and preserves an unsent AI follow-up", async ({
  page,
}) => {
  const state = await allieHandoffFixture(page);
  await page.goto("/help");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Start help conversation" }).click();
  const question = panel.getByRole("textbox", { name: "Your help question" });
  await question.fill("Find compatible parts");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(
    panel.getByText(
      "A name match does not confirm compatibility. Check the evidence for your vehicle.",
      { exact: true },
    ),
  ).toBeVisible();
  await question.fill("My unsent follow-up stays separate");
  await panel.getByRole("button", { name: "Customer Care · leave a message" }).click();
  await panel
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Selected question only");
  await panel.getByRole("textbox", { name: /Your issue summary/ }).fill(summary);
  await panel.getByRole("radio", { name: "Synthetic workshop", exact: true }).check();
  await expect(
    panel.getByRole("checkbox", { name: /Your help question/ }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("checkbox", { name: /AI-generated guidance/ }),
  ).not.toBeChecked();
  await panel.getByRole("checkbox", { name: /Your help question/ }).check();
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  const exact = panel.getByLabel("Exact message to Customer Care");
  await expect(exact).toContainText("Find compatible parts");
  await expect(exact).not.toContainText("A name match");
  await expect(exact).not.toContainText("My unsent follow-up");
  await panel.getByRole("button", { name: "Send message to Customer Care" }).click();
  await expect(
    panel.getByRole("heading", { name: "Your message is saved" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Back to help", exact: true }).click();
  await panel
    .getByRole("button", { name: "Start help conversation", exact: true })
    .click();
  await expect(question).toHaveValue("My unsent follow-up stays separate");
  expect(state.help.writes.filter((x) => x.path.endsWith("/turns"))).toHaveLength(1);
  expect(state.help.writes.some((x) => JSON.stringify(x.body).includes(summary))).toBe(
    false,
  );
  expect(state.created).toBe(1);
  expect(state.help.unexpected).toEqual([]);
});

test("failed preview preserves the draft and cancels before a fresh attempt", async ({
  page,
}) => {
  const state = await allieHandoffFixture(page);
  state.failPreview = true;
  await page.goto("/help");
  const panel = await fill(page);
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("could not be verified");
  await expect(
    panel.getByRole("button", { name: "Review message", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel old operation and edit" }).click();
  await expect(panel.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    summary,
  );
  state.failPreview = false;
  await panel.getByRole("button", { name: "Review message", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Review your message" })).toBeVisible();
  expect(state.created).toBe(0);
  expect(state.help.unexpected).toEqual([]);
});
