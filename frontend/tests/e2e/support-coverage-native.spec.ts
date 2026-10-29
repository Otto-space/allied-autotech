/** Actual loopback browser/CSRF/API/restricted database; no page.route mocks. */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyConsole } from "../fixtures/preview-console";

test.skip(
  process.env.RUN_COVERAGE_BROWSER_TESTS !== "true",
  "Requires the isolated coverage harness",
);
test.use({ trace: "off" }); // Real synthetic session cookies must not enter traces.
test.setTimeout(180_000);
const origin = "http://127.0.0.1:3171";
test.beforeEach(async ({ request }) => {
  const id = identity();
  const response = await request.get(origin + "/api/v1/public/branches?limit=100");
  expect(response.status()).toBe(200);
  const branches = (await response.json()).data.items as { id: string }[];
  expect(branches.map((branch) => branch.id)).toEqual(
    expect.arrayContaining([id.home, id.other]),
  );
});
type Identity = {
  cookie: string;
  staffCookie: string;
  adminCookie: string;
  home: string;
  other: string;
};
function identity(): Identity {
  if (process.env.PLAYWRIGHT_BASE_URL !== origin)
    throw Error("Native coverage tests require the dedicated loopback preview");
  return JSON.parse(
    fs.readFileSync(path.join(os.tmpdir(), "allied-coverage-browser.local.json"), "utf8"),
  );
}
async function signIn(context: BrowserContext, cookie: string) {
  const separator = cookie.indexOf("=");
  await context.addCookies([
    {
      name: cookie.slice(0, separator),
      value: cookie.slice(separator + 1),
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function open(page: Page, branch: string) {
  await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
  await page
    .getByText("Conversation queue and your availability", { exact: true })
    .click();
  await page.getByText("Branch support coverage (owner)", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(branch);
}
async function confirm(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .press("Enter");
}
async function review(page: Page) {
  const button = page.getByRole("button", {
    name: "Review support coverage",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("dialog")).toContainText("Africa/Lagos");
}
test("reviewed coverage survives actual saved/unsaved transport loss without duplicate changes", async ({
  page,
  context,
  request,
}) => {
  const id = identity();
  await signIn(context, id.cookie);
  const root = `/api/v1/admin/workforce/support-chat/coverage/${id.home}`;
  const exceptions: string[] = [],
    unexpectedConsole: string[] = [],
    external: string[] = [],
    warnings: string[] = [],
    deniedQueues: number[] = [];
  const puts: { key: string | undefined; csrf: boolean }[] = [];
  page.on("pageerror", (e) => exceptions.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (m.type() === "warning") {
      warnings.push(m.text());
      return;
    }
    const deliberateTransport =
      m.type() === "error" &&
      m.location().url === origin + root &&
      /^Failed to load resource: the server responded with a status of (500|502|503)/.test(
        m.text(),
      );
    const deniedQueue =
      m
        .location()
        .url.startsWith(origin + "/api/v1/staff/workforce/support-chat/channels?") &&
      m.text() ===
        "Failed to load resource: the server responded with a status of 403 (Forbidden)";
    if (!deliberateTransport && !deniedQueue) unexpectedConsole.push(m.text());
  });
  page.on("response", (response) => {
    if (
      response.url().startsWith(origin + "/api/v1/staff/workforce/support-chat/channels?")
    )
      deniedQueues.push(response.status());
  });
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (/^https?:/.test(url.protocol) && url.hostname !== "127.0.0.1")
      external.push(url.hostname);
    if (url.pathname === root && req.method() === "PUT")
      puts.push({
        key: req.headers()["idempotency-key"],
        csrf: !!req.headers()["x-csrf-token"],
      });
  });
  const evidence = async () => {
    const result = await request.get("http://127.0.0.1:5021/__coverage-test-evidence");
    expect(result.status()).toBe(200);
    return result.json();
  };
  await page.setViewportSize({ width: 390, height: 1000 });
  await open(page, id.home);
  await expect(
    page.getByRole("group", { name: "Support window 1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add support window", exact: true })
    .press("Enter");
  const window = page.getByRole("group", { name: "Support window 1", exact: true });
  await window.getByRole("combobox", { name: "Day", exact: true }).selectOption("1");
  await window.getByLabel("Start time", { exact: true }).fill("09:17");
  await window.getByLabel("End time", { exact: true }).fill("17:41");
  await page.getByLabel(/Allow joins during these hours/).check();
  await page.getByLabel(/Maximum concurrent conversations/).selectOption("2");
  await page
    .getByLabel(/Private audit reason/)
    .fill("Synthetic approved native coverage plan");
  await review(page);
  expect((await evidence()).puts).toBe(0);
  await expect(page.getByRole("dialog")).toContainText("Monday 09:17–17:41");
  await confirm(page);
  await expect(
    page.getByText(/Support coverage saved\. This did not release/),
  ).toBeVisible();
  expect((await evidence()).version).toBe(1);
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(id.other);
  await expect(window.getByLabel("End time", { exact: true })).toHaveValue("24:00");
  await page
    .getByLabel(/Private audit reason/)
    .fill("Retained second branch native draft");
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(id.home);
  await page
    .getByLabel(/Private audit reason/)
    .fill("Reviewed saved transport interruption");
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(id.other);
  await expect(page.getByLabel(/Private audit reason/)).toHaveValue(
    "Retained second branch native draft",
  );
  await page
    .getByRole("combobox", { name: "Coverage branch", exact: true })
    .selectOption(id.home);
  await expect(page.getByLabel(/Private audit reason/)).toHaveValue(
    "Reviewed saved transport interruption",
  );
  await review(page);
  await confirm(page);
  const check = page.getByRole("button", {
    name: "Check saved coverage action",
    exact: true,
  });
  await expect(check).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const reminders = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(([key]) =>
      key.startsWith("aat:care-coverage:v1:"),
    ),
  );
  expect(reminders).toHaveLength(1);
  expect(Object.keys(JSON.parse(reminders[0][1]))).toEqual(["operationKey"]);
  expect(JSON.stringify(reminders)).not.toContain("transport interruption");
  expect((await evidence()).version).toBe(2);
  await open(page, id.home);
  await expect(check).toBeVisible();
  await check.click();
  await expect(
    page.getByText("The earlier coverage change was saved. No change was resent.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await evidence()).puts).toBe(2);
  await page
    .getByLabel(/Private audit reason/)
    .fill("Reviewed unsaved transport interruption");
  await review(page);
  await confirm(page);
  await expect(check).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await check.click();
  await expect(page.getByText(/No saved outcome is confirmed yet/)).toBeVisible();
  expect((await evidence()).version).toBe(2);
  await page
    .getByRole("button", { name: "Review pending cancellation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not disable or undo existing coverage",
  );
  await confirm(page);
  await expect(page.getByText(/The unsaved coverage change is cancelled/)).toBeVisible();
  await review(page);
  await confirm(page);
  await expect(
    page.getByText(/Support coverage saved\. This did not release/),
  ).toBeVisible();
  const final = await evidence();
  expect(final).toMatchObject({
    puts: 4,
    recoveryReads: 2,
    cancellations: 1,
    version: 3,
    auditCount: 3,
    policyEnabled: true,
    droppedSaved: true,
    droppedUnsaved: true,
    inventoryUnchanged: true,
    bookingsUnchanged: true,
    messagesUnchanged: true,
    liveEnabled: false,
    optedInRepresentatives: 0,
    otherVersion: 7,
  });
  expect(final.receipts).toEqual([
    ["cancelled", "resourceId"],
    ...Array.from({ length: 3 }, () => ["resourceId", "savedVersion"]),
  ]);
  expect(puts).toHaveLength(4);
  expect(new Set(puts.map((p) => p.key)).size).toBe(4);
  expect(puts.every((p) => p.csrf && /^support-reply-v1\./.test(p.key ?? ""))).toBe(true);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include("#care-support-coverage").analyze())
        .violations,
    ).toEqual([]);
    await page.locator("#care-support-coverage").evaluate((element) => {
      window.scrollTo({
        top: element.getBoundingClientRect().top + scrollY - 90,
        behavior: "instant",
      });
    });
    await page.screenshot({
      path: path.join(os.tmpdir(), `allied-w16f-native-coverage-${width}.png`),
    });
  }
  expect(exceptions).toEqual([]);
  expect(deniedQueues).toEqual([403, 403]);
  await expect(
    page.locator('section[aria-labelledby="care-channel-queue"]'),
  ).toContainText("Your account does not have permission for this action.");
  await verifyConsole(page, unexpectedConsole, warnings);
  expect(external).toEqual([]);
  fs.writeFileSync(
    path.join(os.tmpdir(), "allied-w16f-native-coverage-evidence.json"),
    JSON.stringify(final, null, 2),
  );
});
for (const role of ["ADMIN", "STAFF"] as const)
  test(`${role} has no owner editor and the actual coverage endpoint denies access`, async ({
    page,
    context,
  }) => {
    const id = identity();
    await signIn(context, role === "ADMIN" ? id.adminCookie : id.staffCookie);
    await page.goto("/admin/support", { waitUntil: "domcontentloaded" });
    await page
      .getByText("Conversation queue and your availability", { exact: true })
      .click();
    await expect(
      page.getByText("Branch support coverage (owner)", { exact: true }),
    ).toHaveCount(0);
    const response = await context.request.get(
      origin + `/api/v1/admin/workforce/support-chat/coverage/${id.home}`,
    );
    expect(response.status()).toBe(403);
  });
