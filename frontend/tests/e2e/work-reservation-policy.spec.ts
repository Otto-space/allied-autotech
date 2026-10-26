import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workReservationPolicyFixture,
  reservationPolicyRow,
  id,
} from "../fixtures/work-reservation-policy";
const root = "/admin/reservation-terms";
const reviewButton = (page: Page) =>
  page.getByRole("button", { name: "Review publication", exact: true });
const approval = (page: Page) =>
  page.getByLabel("I confirm this agreement or withdrawal has been approved.", {
    exact: true,
  });
async function fill(page: Page) {
  await page
    .getByLabel("Approval source", { exact: true })
    .fill("Synthetic owner agreement approval");
  await page
    .getByLabel("Written approval reference", { exact: true })
    .fill("Synthetic written agreement approval for isolated verification.");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2048-01-05T08:30");
  await approval(page).check();
}
async function review(page: Page) {
  await fill(page);
  await reviewButton(page).click();
}
async function confirm(page: Page, name = "Publish agreement") {
  await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
}
async function axe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
for (const width of [320, 375, 430, 768, 1280, 1440, 1920])
  test(`reservation agreement page and review at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    const f = await workReservationPolicyFixture(page),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(root);
    const nav = page.getByRole("navigation", { name: "Breadcrumb", exact: true });
    await expect(nav.locator("ol > li")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/admin",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveText(
      "Reservation agreements",
    );
    await expect(page.locator(".reservation-current")).toContainText("Revision 2");
    await expect(
      page.locator(".reservation-next").first().locator(":scope > summary"),
    ).toContainText("Revision 3 · Availability withdrawn");
    await expect(
      page.locator(".reservation-next").first().locator(":scope > summary"),
    ).toContainText("5 Jan 2032");
    await page.getByLabel("Agreement title", { exact: true }).focus();
    await expect(page.getByLabel("Agreement title", { exact: true })).toHaveCSS(
      "outline-width",
      "3px",
    );
    await page.getByText("Read current agreement", { exact: true }).click();
    await expect(page.locator(".reservation-current .agreement-text")).toContainText(
      "Synthetic agreement",
    );
    await page.getByText("Next scheduled revision", { exact: true }).click();
    await expect(page.locator(".reservation-next").first()).toContainText(
      "Availability withdrawn",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await axe(page);
    await review(page);
    await axe(page);
    await page.keyboard.press("Escape");
    await expect(reviewButton(page)).toBeFocused();
    await expect(approval(page)).not.toBeChecked();
    expect(f.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
test("exact publication retires draft, preserves current and then permits a distinct withdrawal", async ({
  page,
}) => {
  const f = await workReservationPolicyFixture(page);
  await page.goto(root);
  const text =
    'Synthetic exact text.\n\n<script>alert("not executable")</script>\nFinal line.';
  await page.getByLabel("Approved agreement text", { exact: true }).fill(text);
  await review(page);
  await expect(page.getByRole("dialog")).toContainText(text);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Agreement publication recorded", exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    kind: "VEHICLE_RESERVATION_TERMS",
    expectedVersion: 4,
    effectiveAt: "2048-01-05T07:30:00.000Z",
    settings: { enabled: true, body: text },
  });
  await expect(page.locator(".reservation-current")).toContainText("Revision 2");
  await expect(page.getByLabel("Written approval reference")).toHaveValue("");
  await page.getByLabel("Publication action").selectOption("withdraw");
  await expect(page.getByLabel("Agreement title", { exact: true })).toBeHidden();
  await page
    .getByLabel("Withdrawal reason", { exact: true })
    .fill("Synthetic withdrawal preserves all existing acceptances.");
  await review(page);
  await expect(page.getByRole("dialog")).toContainText(
    "Scheduled future revisions still take effect",
  );
  await confirm(page, "Withdraw availability");
  await expect(
    page.getByRole("heading", { name: "Agreement publication recorded", exact: true }),
  ).toBeFocused();
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]).toMatchObject({
    expectedVersion: 5,
    settings: {
      enabled: false,
      reason: "Synthetic withdrawal preserves all existing acceptances.",
    },
  });
});
test("publish and withdrawal drafts survive action switches and reload without approval consent", async ({
  page,
}) => {
  await workReservationPolicyFixture(page);
  await page.goto(root);
  await page
    .getByLabel("Agreement title", { exact: true })
    .fill("Synthetic retained title");
  await page
    .getByLabel("Approved agreement text", { exact: true })
    .fill("Synthetic retained body");
  await page.getByLabel("Publication action").selectOption("withdraw");
  await page
    .getByLabel("Withdrawal reason", { exact: true })
    .fill("Synthetic retained withdrawal");
  await fill(page);
  await page.reload();
  await expect(page.getByLabel("Publication action")).toHaveValue("withdraw");
  await expect(page.getByLabel("Withdrawal reason", { exact: true })).toHaveValue(
    "Synthetic retained withdrawal",
  );
  await expect(approval(page)).not.toBeChecked();
  await page.getByLabel("Publication action").selectOption("publish");
  await expect(page.getByLabel("Agreement title", { exact: true })).toHaveValue(
    "Synthetic retained title",
  );
  await expect(page.getByLabel("Approved agreement text", { exact: true })).toHaveValue(
    "Synthetic retained body",
  );
});
test("stale draft base survives refresh and reload until explicit replacement", async ({
  page,
}) => {
  const f = await workReservationPolicyFixture(page);
  await page.goto(root);
  await page
    .getByLabel("Agreement title", { exact: true })
    .fill("Synthetic unsent draft");
  f.history.unshift(reservationPolicyRow(5));
  await page.getByRole("button", { name: "Refresh agreements", exact: true }).click();
  await expect(page.locator(".reservation-stale")).toBeVisible();
  await page.reload();
  await expect(page.locator(".reservation-stale")).toBeVisible();
  await expect(page.getByLabel("Agreement title", { exact: true })).toHaveValue(
    "Synthetic unsent draft",
  );
  await page.getByRole("button", { name: "Reload action fields" }).click();
  await expect(page.locator(".reservation-stale")).toHaveCount(0);
  await expect(page.getByLabel("Agreement title", { exact: true })).toHaveValue(
    "Synthetic reservation agreement",
  );
  expect(f.writes).toEqual([]);
});
for (const changed of ["version", "identity"])
  test(`fresh ${changed} change blocks publication`, async ({ page }) => {
    const f = await workReservationPolicyFixture(page);
    await page.goto(root);
    await review(page);
    if (changed === "version") f.history.unshift(reservationPolicyRow(5));
    else f.base.profileOwner = id(99);
    await confirm(page);
    if (changed === "identity") {
      await expect(
        page.getByText(
          "Reservation policy requires an active, verified Super Admin account with MFA.",
          { exact: true },
        ),
      ).toBeVisible();
    } else {
      await expect(page.getByRole("dialog")).toContainText(
        "This record has changed or is no longer available.",
      );
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Publish agreement", exact: true }),
      ).toBeDisabled();
    }
    expect(f.writes).toEqual([]);
  });
for (const outcome of ["drop", "wrongActor"] as const)
  test(`${outcome} receipt stays locked after reload and reconciles without replay`, async ({
    page,
  }) => {
    const f = await workReservationPolicyFixture(page);
    f[outcome] = true;
    await page.goto(root);
    await review(page);
    await confirm(page);
    await expect(page.getByRole("dialog")).toContainText("could not be confirmed");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Approval needs reconciliation", exact: true }),
    ).toBeVisible();
    await expect(reviewButton(page)).toBeDisabled();
    await page.getByRole("button", { name: "Check current policy", exact: true }).click();
    await page.getByLabel("I independently reconciled", { exact: false }).check();
    await page.getByRole("button", { name: "Clear reconciled approval lock" }).click();
    await page.getByRole("button", { name: "Reload action fields" }).click();
    await expect(reviewButton(page)).toBeEnabled();
    expect(f.writes).toHaveLength(1);
  });
test("empty policy has no invented text and supports explicitly approved withdrawal", async ({
  page,
}) => {
  const f = await workReservationPolicyFixture(page);
  f.history = [];
  await page.goto(root);
  await expect(page.getByLabel("Agreement title", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Approved agreement text", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Publication action").selectOption("withdraw");
  await page
    .getByLabel("Withdrawal reason", { exact: true })
    .fill("Synthetic unavailability pending approved text");
  await review(page);
  await confirm(page, "Withdraw availability");
  await expect(
    page.getByRole("heading", { name: "Agreement publication recorded", exact: true }),
  ).toBeVisible();
  expect(f.writes[0]).toMatchObject({ expectedVersion: 0, settings: { enabled: false } });
});
test("current withdrawal is unavailable despite a later enabled revision", async ({
  page,
}) => {
  const f = await workReservationPolicyFixture(page);
  f.history[2] = {
    ...reservationPolicyRow(2),
    settings: { enabled: false, reason: "Synthetic current withdrawal" },
  };
  await page.goto(root);
  await expect(page.locator(".reservation-current")).toContainText("Unavailable");
  await expect(page.locator(".reservation-current")).toContainText(
    "Synthetic current withdrawal",
  );
  await expect(
    page.getByText("Latest recorded revision: 4", { exact: true }),
  ).toBeVisible();
  await axe(page);
});
test("maximum plain text is retained and reviewed literally", async ({ page }) => {
  await workReservationPolicyFixture(page);
  await page.goto(root);
  const text = "x".repeat(49900) + "\n<script>synthetic</script>";
  await page.getByLabel("Approved agreement text", { exact: true }).fill(text);
  await fill(page);
  await page.reload();
  await expect(page.getByLabel("Approved agreement text", { exact: true })).toHaveValue(
    text,
  );
  await approval(page).check();
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toContainText(text);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("invalid control text and past schedule cannot reach publication", async ({
  page,
}) => {
  const f = await workReservationPolicyFixture(page);
  await page.goto(root);
  await page
    .getByLabel("Approved agreement text", { exact: true })
    .fill("Synthetic\u0001control");
  await review(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Approved agreement text", { exact: true })).toBeFocused();
  await page
    .getByLabel("Approved agreement text", { exact: true })
    .fill("Synthetic valid body");
  await page
    .getByLabel("Effective date and time", { exact: false })
    .fill("2020-01-01T08:00");
  await reviewButton(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(f.writes).toEqual([]);
});
for (const mode of ["fail", "denied"] as const)
  test(`${mode} read is accessible and blocks actions`, async ({ page }) => {
    const f = await workReservationPolicyFixture(page);
    f[mode] = true;
    await page.goto(root);
    await expect(
      page.getByText(
        mode === "denied"
          ? "Reservation policy requires an active, verified Super Admin account with MFA."
          : "The request could not be completed. Please try again shortly.",
        { exact: true },
      ),
    ).toBeVisible();
    await axe(page);
    expect(f.writes).toEqual([]);
  });
for (const role of ["STAFF", "ADMIN"])
  test(`${role} cannot publish agreements`, async ({ page }) => {
    const f = await workReservationPolicyFixture(page);
    f.base.role = role;
    await page.goto(root);
    await expect(
      page.getByText(
        "Reservation policy requires an active, verified Super Admin account with MFA.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(reviewButton(page)).toHaveCount(0);
    expect(f.writes).toEqual([]);
  });
