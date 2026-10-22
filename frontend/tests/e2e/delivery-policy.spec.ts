import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workDeliveryPolicyFixture,
  deliveryPolicyRow,
  id,
} from "../fixtures/work-delivery-policy";
const root = "/admin/delivery-policy";
const reviewButton = (p: Page) =>
  p.getByRole("button", { name: "Review delivery approval", exact: true });
async function fill(p: Page) {
  await p
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic owner delivery approval");
  await p
    .getByLabel("Written approval or reference")
    .fill("Synthetic signed delivery list and exact fee approval for verification.");
  await p
    .getByLabel("Effective date and time", { exact: false })
    .fill("2048-01-05T08:30");
}
async function review(p: Page) {
  await fill(p);
  await reviewButton(p).click();
}
async function confirm(p: Page) {
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Approve delivery", exact: true })
    .click();
}
async function axe(p: Page) {
  expect(
    (
      await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`delivery responsive and accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workDeliveryPolicyFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    const nav = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(nav.locator("ol > li")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Delivery setup");
    await expect(
      page.getByRole("region", { name: "Current delivery policy", exact: true }),
    ).toContainText("Version 2");
    await expect(page.locator(".delivery-schedule")).toContainText("Version 3");
    await expect(page.locator(".delivery-schedule")).toContainText(
      "Latest recorded version: 4.",
    );
    await expect(
      page.getByText("Delivery available at checkout", { exact: true }),
    ).toBeVisible();
    await page.getByText("Delivery policy history", { exact: true }).click();
    await page.locator(".delivery-version > summary").first().click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(reviewButton(page)).toBeFocused();
    expect(f.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
test("exact complete-list publication includes zero and maximum fees and retires draft", async ({
  page,
}) => {
  const f = await workDeliveryPolicyFixture(page);
  await page.goto(root);
  await page
    .getByLabel("Delivery fee (NGN, before tax)", { exact: true })
    .first()
    .fill("9999999999999.99");
  await page
    .getByLabel("Delivery fee (NGN, before tax)", { exact: true })
    .nth(1)
    .fill("0.00");
  await review(page);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(f.writes).toEqual([]);
  await reviewButton(page).click();
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Delivery policy recorded" }),
  ).toBeFocused();
  await expect(
    page.getByText("Latest recorded version: 5.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "DELIVERY",
    expectedVersion: 4,
    effectiveAt: "2048-01-05T07:30:00.000Z",
    settings: {
      collectionEnabled: true,
      zones: [
        { id: "synthetic-central", feeKobo: "999999999999999" },
        { id: "synthetic-extended", feeKobo: "0" },
      ],
    },
  });
  await expect(page.getByLabel("Written approval or reference")).toHaveValue("");
  await expect(
    page.getByRole("region", { name: "Current delivery policy", exact: true }),
  ).toContainText("Version 2");
});
test("added and removed area identities and values persist across reload", async ({
  page,
}) => {
  const f = await workDeliveryPolicyFixture(page);
  await page.goto(root);
  await page.getByRole("button", { name: "Remove area 1", exact: true }).click();
  await page.getByRole("button", { name: "Add delivery area", exact: true }).click();
  await page.getByLabel("Area name", { exact: true }).nth(1).fill("Synthetic new area");
  await page.getByLabel("City", { exact: true }).nth(1).fill("Port Harcourt");
  await page.getByLabel("State", { exact: true }).nth(1).fill("Rivers");
  await page
    .getByLabel("Delivery fee (NGN, before tax)", { exact: true })
    .nth(1)
    .fill("101.01");
  const newId = await page.locator('input[name="delivery.1-id"]').inputValue();
  await page.reload();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("Area name", { exact: true }).first()).toHaveValue(
    "Synthetic extended area",
  );
  await expect(page.getByLabel("Area name", { exact: true }).nth(1)).toHaveValue(
    "Synthetic new area",
  );
  await expect(page.locator('input[name="delivery.1-id"]')).toHaveValue(newId);
  await review(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Delivery policy recorded" }),
  ).toBeVisible();
  expect(f.writes[0]).toMatchObject({
    settings: {
      zones: [
        { id: "synthetic-extended", feeKobo: "500000" },
        { id: newId, feeKobo: "10101" },
      ],
    },
  });
});
test("structure-only draft keeps its base through refresh and reload", async ({
  page,
}) => {
  const f = await workDeliveryPolicyFixture(page);
  await page.goto(root);
  await page.getByRole("button", { name: "Remove area 1", exact: true }).click();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(1);
  f.history.unshift(deliveryPolicyRow(5));
  await page.getByRole("button", { name: "Refresh delivery policy" }).click();
  await expect(page.locator(".delivery-schedule")).toContainText(
    "Latest recorded version: 5.",
  );
  await expect(reviewButton(page)).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Area name", { exact: true })).toHaveValue(
    "Synthetic extended area",
  );
  await expect(reviewButton(page)).toBeDisabled();
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(2);
  await expect(reviewButton(page)).toBeEnabled();
  expect(f.writes).toEqual([]);
});
test("empty policy supplies no areas and permits recovery from an empty draft", async ({
  page,
}) => {
  const f = await workDeliveryPolicyFixture(page);
  f.history = [];
  f.deliveryEnabled = false;
  await page.goto(root);
  await expect(
    page.getByText("No delivery policy is effective at this check."),
  ).toBeVisible();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(0);
  await fill(page);
  await reviewButton(page).click();
  await expect(
    page.getByRole("button", { name: "Add delivery area", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add delivery area", exact: true }).click();
  await expect(
    page.getByLabel("Delivery fee (NGN, before tax)", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Remove area 1", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
test("area limit is 100 with complete row structure", async ({ page }) => {
  const f = await workDeliveryPolicyFixture(page);
  f.history = f.history.map((r) => ({
    ...r,
    settings: {
      ...r.settings,
      zones: Array.from({ length: 100 }, (_, i) => ({
        ...r.settings.zones[0]!,
        id: `zone-${i}`,
        label: `Synthetic area ${i + 1}`,
      })),
    },
  }));
  await page.goto(root);
  await expect(page.getByLabel("Area name", { exact: true })).toHaveCount(100);
  await expect(
    page.getByRole("button", { name: "Add delivery area", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Remove area 100", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add delivery area", exact: true }),
  ).toBeEnabled();
  expect(f.writes).toEqual([]);
});
for (const fee of ["-1", "1.001", "10000000000000.00", "1e3"])
  test(`rejects invalid exact fee ${fee}`, async ({ page }) => {
    const f = await workDeliveryPolicyFixture(page);
    await page.goto(root);
    await fill(page);
    await page
      .getByLabel("Delivery fee (NGN, before tax)", { exact: true })
      .first()
      .fill(fee);
    await reviewButton(page).click();
    await expect(
      page.getByLabel("Delivery fee (NGN, before tax)", { exact: true }).first(),
    ).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(f.writes).toEqual([]);
  });
for (const change of ["version", "identity"])
  test(`fresh ${change} prevents approval`, async ({ page }) => {
    const f = await workDeliveryPolicyFixture(page);
    await page.goto(root);
    await review(page);
    if (change === "version") f.history.unshift(deliveryPolicyRow(5));
    else f.base.profileOwner = id(999);
    await confirm(page);
    if (change === "identity")
      await expect(
        page.getByRole("button", { name: "Refresh permission" }),
      ).toBeVisible();
    else
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Approve delivery", exact: true }),
      ).toBeDisabled();
    expect(f.writes).toEqual([]);
  });
for (const outcome of ["lost", "wrong actor"])
  test(`${outcome} requires reconciliation after reload with no replay`, async ({
    page,
  }) => {
    const f = await workDeliveryPolicyFixture(page);
    f.drop = outcome === "lost";
    f.wrongActor = outcome === "wrong actor";
    await page.goto(root);
    await review(page);
    await confirm(page);
    await page.getByRole("button", { name: "Close & review record" }).click();
    await page.reload();
    await expect(reviewButton(page)).toBeDisabled();
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear reconciled approval lock" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /I independently reconciled/ }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await expect(reviewButton(page)).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });
for (const condition of ["checkout", "delivery"])
  test(`approval is distinct from ${condition} availability`, async ({ page }) => {
    const f = await workDeliveryPolicyFixture(page);
    f.deliveryEnabled = false;
    if (condition === "checkout") f.checkoutEnabled = false;
    await page.goto(root);
    await expect(
      page.getByRole("region", { name: "Current delivery policy", exact: true }),
    ).toContainText("Approved");
    await expect(
      page.getByText("Delivery unavailable at checkout", { exact: true }),
    ).toBeVisible();
    if (condition === "checkout")
      await expect(
        page.getByText("Checkout is unavailable under the current financial policy.", {
          exact: true,
        }),
      ).toBeVisible();
    await expect(reviewButton(page)).toBeEnabled();
    expect(f.writes).toEqual([]);
  });
for (const status of ["error", "denied"])
  test(`${status} state is accessible and permits no approval`, async ({ page }) => {
    const f = await workDeliveryPolicyFixture(page);
    f.fail = status === "error";
    f.denied = status === "denied";
    await page.goto(root);
    await expect(
      page.getByRole("button", {
        name: status === "denied" ? "Refresh permission" : "Refresh delivery policy",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".delivery-form")).toHaveCount(0);
    await axe(page);
    expect(f.writes).toEqual([]);
  });
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot approve delivery`, async ({ page }) => {
    const f = await workDeliveryPolicyFixture(page);
    f.base.role = role;
    await page.goto(root);
    await expect(
      page.getByText(
        "Delivery policy requires an active, verified Super Admin account with MFA.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.locator(".delivery-form")).toHaveCount(0);
    expect(f.writes).toEqual([]);
  });
