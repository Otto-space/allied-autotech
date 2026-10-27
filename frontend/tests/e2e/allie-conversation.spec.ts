import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import os from "node:os";
import {
  allieConversationFixture,
  type AllieFixtureRole,
} from "../fixtures/allie-conversation";

function observe(page: Page) {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const knownFailure =
      message.text().startsWith("Failed to load resource") &&
      /\/api\/v1\/(?:auth\/session|(?:public\/)?learning\/assistant\/)/.test(
        message.location().url,
      );
    if (!knownFailure) errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)
    )
      external.push(request.url());
  });
  return { errors, external };
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "Allie", exact: true })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Start help conversation" }),
  ).toBeEnabled();
  return panel;
}
async function begin(page: Page) {
  const panel = await open(page);
  await panel.getByRole("button", { name: "Start help conversation" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("textbox", { name: "Your help question" })).toBeVisible();
  return panel;
}
const answer =
  "A name match does not confirm compatibility. Check the evidence for your vehicle.";
test("short mobile viewport keeps follow-up composer and keyboard send usable", async ({
  page,
}) => {
  const state = await allieConversationFixture(page),
    seen = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  const panel = await begin(page);
  const question = panel.getByRole("textbox", { name: "Your help question" });
  await question.fill("Find compatible parts");
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("button", { name: "Send question" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel.getByText(answer, { exact: true })).toBeVisible();
  await question.fill("What if the evidence is missing?");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(panel.locator(".allie-transcript > li")).toHaveCount(2);
  await expect(question).toHaveValue("");
  await question.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect(state.writes.filter((write) => write.path.endsWith("/turns"))).toHaveLength(2);
  expect(
    state.writes
      .filter((write) => write.path.endsWith("/turns"))
      .every(
        (write) =>
          Object.keys(write.body).sort().join(",") ===
          "expectedVersion,operationId,page,question",
      ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(os.tmpdir(), "allied-allie-composer-390.png"),
  });
  expect(seen.errors).toEqual([]);
  expect(state.unexpected).toEqual([]);
});
for (const width of [320, 360, 390, 768, 1024, 1440])
  test(`public Allie conversation, source, clear and keyboard at ${width}px`, async ({
    page,
  }) => {
    const state = await allieConversationFixture(page),
      seen = observe(page);
    await page.setViewportSize({ width, height: 1000 });
    if (width === 360) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/help");
    await expect(page).toHaveTitle(/Help centre/i);
    const panel = await begin(page);
    await panel
      .getByRole("textbox", { name: "Your help question" })
      .fill("Find compatible parts");
    await expect
      .poll(() => state.writes.filter((write) => write.path.endsWith("/turns")).length)
      .toBe(0);
    await panel.getByRole("button", { name: "Send question" }).click();
    await expect(panel.getByText(answer, { exact: true })).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "Find a part and understand compatibility · v2" }),
    ).toHaveAttribute("href", "/learn?article=parts-fitment");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".allie-dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if ([390, 1440].includes(width)) {
      await panel.getByText(answer, { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(os.tmpdir(), `allied-allie-conversation-${width}.png`),
      });
    }
    await panel.getByRole("button", { name: "Clear conversation" }).click();
    expect(
      state.writes.some(
        (write) =>
          write.path.endsWith(state.conversation.id) && !Object.keys(write.body).length,
      ),
    ).toBe(false);
    await panel.getByRole("button", { name: "Confirm clear" }).click();
    await expect(panel.getByText("Active help history cleared.")).toBeVisible();
    await expect(panel.getByText(answer, { exact: true })).toHaveCount(0);
    const storage = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    );
    expect(storage).not.toContain("Find compatible parts");
    expect(state.unexpected).toEqual([]);
    expect(seen.errors).toEqual([]);
    expect(seen.external).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Ask Allie", exact: true }).first(),
    ).toBeFocused();
  });
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as AllieFixtureRole[])
  test(`${role} uses its authenticated conversation boundary and reviewed source destination`, async ({
    page,
  }) => {
    const state = await allieConversationFixture(page, role),
      seen = observe(page);
    await page.goto("/help");
    const panel = await begin(page);
    await panel
      .getByRole("textbox", { name: "Your help question" })
      .fill("What does compatibility mean?");
    await panel.getByRole("button", { name: "Send question" }).click();
    await expect(panel.getByText(answer, { exact: true })).toBeVisible();
    expect(
      state.writes.some((write) => write.path.startsWith("/public/learning/assistant")),
    ).toBe(false);
    expect(state.writes.filter((write) => write.path.endsWith("/turns"))).toHaveLength(1);
    await panel
      .getByRole("link", { name: "Find a part and understand compatibility · v2" })
      .click();
    await expect(page).toHaveURL(/\/learn\?article=parts-fitment$/);
    await expect(panel).not.toBeVisible();
    expect(state.unexpected).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
test("stop prevents a late answer and supports explicit recovery without another question", async ({
  page,
}) => {
  const state = await allieConversationFixture(page);
  state.hold = true;
  await page.goto("/help");
  const panel = await begin(page);
  await panel
    .getByRole("textbox", { name: "Your help question" })
    .fill("Find compatible parts");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect.poll(() => !!state.release).toBe(true);
  await panel.getByRole("button", { name: "Stop generation" }).click();
  await expect(
    panel.getByText(/Generation stopped or had already finished/),
  ).toBeVisible();
  state.release!();
  await expect(panel.getByText(answer, { exact: true })).toHaveCount(0);
  expect(state.writes.filter((write) => write.path.endsWith("/turns"))).toHaveLength(1);
  expect(state.cancelled).toBe(true);
  expect(state.unexpected).toEqual([]);
});
test("an uncertain network result is checked and never blindly resent", async ({
  page,
}) => {
  const state = await allieConversationFixture(page);
  state.unknown = true;
  await page.goto("/help");
  const panel = await begin(page);
  await panel
    .getByRole("textbox", { name: "Your help question" })
    .fill("Find compatible parts");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.getByRole("alert")).toContainText("could not verify the result");
  await expect(panel.getByRole("button", { name: "Send question" })).toBeDisabled();
  await panel.getByRole("button", { name: "Check conversation" }).click();
  await expect(panel.getByText(answer, { exact: true })).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Your help question" })).toHaveValue(
    "",
  );
  expect(state.writes.filter((write) => write.path.endsWith("/turns"))).toHaveLength(1);
});
test("quota fallback preserves reviewed help and no additional model request", async ({
  page,
}) => {
  const state = await allieConversationFixture(page);
  state.quota = true;
  await page.goto("/help");
  const panel = await begin(page);
  await panel
    .getByRole("textbox", { name: "Your help question" })
    .fill("Find compatible parts");
  await panel.getByRole("button", { name: "Send question" }).click();
  await expect(panel.getByRole("alert")).toContainText("temporary usage limit");
  await panel.getByRole("button", { name: "Reviewed help", exact: true }).click();
  await panel.getByLabel("What do you need help with?").fill("parts");
  await panel.getByRole("button", { name: "Find reviewed help" }).click();
  await expect(
    panel.getByRole("heading", { name: "Find a part and understand compatibility" }),
  ).toBeVisible();
  expect(state.writes.filter((write) => write.path.endsWith("/turns"))).toHaveLength(1);
});
test("current-access invalidation closes protected help and discards the unsent question", async ({
  page,
}) => {
  const state = await allieConversationFixture(page, "STAFF");
  await page.goto("/help");
  let panel = await begin(page);
  await panel
    .getByRole("textbox", { name: "Your help question" })
    .fill("Unsent restricted work question");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("aat:workforce-access-changed")),
  );
  await expect(panel).not.toBeVisible();
  state.data.accessKey = "b".repeat(64);
  panel = await open(page);
  await panel.getByRole("button", { name: "Resume conversation 1" }).click();
  await expect(panel.getByRole("textbox", { name: "Your help question" })).toHaveValue(
    "",
  );
  expect(
    (await page.locator("body").innerText()).includes("Unsent restricted work question"),
  ).toBe(false);
  expect(state.writes.some((write) => write.path.endsWith("/turns"))).toBe(false);
});
test("disabled AI keeps reviewed search and auth pages have no conversation launcher", async ({
  page,
}) => {
  const state = await allieConversationFixture(page);
  state.data.flags.ai = false;
  await page.goto("/help");
  await page.getByRole("button", { name: "Ask Allie", exact: true }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByLabel("What do you need help with?")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Start help conversation" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  state.data.flags.ai = true;
  await page.goto("/login");
  // The existing auth layout deliberately omits the floating launcher. Do not
  // invent a button or bypass that UI contract to make the scenario pass.
  await expect(page.getByRole("button", { name: "Ask Allie", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("textbox", { name: "Your help question" })).toHaveCount(0);
  expect(
    state.writes.filter((write) => write.path.includes("/learning/assistant")),
  ).toHaveLength(0);
});
