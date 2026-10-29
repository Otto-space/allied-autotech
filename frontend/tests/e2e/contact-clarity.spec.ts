import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const branchId = "f6000000-0000-4000-8000-000000000001";

for (const width of [360, 390, 768, 1440]) {
  test(`Contact concise guidance and single workshop submit at ${width}`, async ({
    page,
  }, info) => {
    const kind = width === 390 || width === 768 ? "complaint" : "enquiry";
    const writes: unknown[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydration|hydrating|uncaught/i.test(message.text()))
        errors.push(message.text());
    });
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname;
      const ok = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          json: {
            success: true,
            message: "Isolated contact clarity fixture",
            data,
            meta: { requestId: "contact-clarity" },
          },
        });
      if (endpoint.endsWith("/public/branches") && request.method() === "GET")
        return ok({ items: [{ id: branchId, name: "Port Harcourt test branch" }] });
      if (
        endpoint.endsWith(
          `/public/support/${kind === "enquiry" ? "enquiries" : "complaints"}`,
        ) &&
        request.method() === "POST"
      ) {
        writes.push(request.postDataJSON());
        return ok(
          {
            id: "f6000000-0000-4000-8000-000000000002",
            status: "OPEN",
            createdAt: "2026-10-29T00:00:00Z",
          },
          202,
        );
      }
      return route.fulfill({
        status: 401,
        json: { success: false, error: { code: "ISOLATED_UNMATCHED_REQUEST" } },
      });
    });
    await page.setViewportSize({ width, height: 936 });
    await page.goto("/contact#enquiry");
    await expect(page).toHaveTitle(/Contact & customer care/);
    await expect(page.locator("main h1")).toHaveText("Let’s talk about your vehicle.");
    if (kind === "complaint")
      await page.getByRole("radio", { name: "Complaint", exact: true }).check();
    const branch = page.getByLabel("Handling branch", { exact: true });
    await expect(branch).toHaveText("Port Harcourt test branch");
    expect(await branch.evaluate((el) => el.tagName)).toBe("OUTPUT");
    await expect(page.getByRole("combobox", { name: "Handling branch" })).toHaveCount(0);
    await expect(page.locator(".contact-next-step")).toContainText("keep the reference");
    await expect(page.getByRole("heading", { name: "Helpful details" })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Send an enquiry", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Raise a complaint", exact: true }),
    ).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`contact-${width}-layout.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: `Review ${kind}`, exact: true }).click();
    await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Subject", { exact: true })).toHaveAccessibleDescription(
      "Enter a subject for your request.",
    );
    const message = page.getByLabel(
      kind === "enquiry" ? "Your message" : "Complaint details",
      { exact: true },
    );
    await expect(message).toHaveAccessibleDescription(
      "Enter a message with the details of your request.",
    );
    await page.getByLabel("Your name", { exact: true }).fill("Contact Fixture");
    await page.getByLabel("Email address", { exact: true }).fill("contact@example.test");
    await page.getByRole("button", { name: `Review ${kind}`, exact: true }).click();
    await expect(page.getByLabel("Subject", { exact: true })).toBeFocused();
    await page.getByLabel("Subject", { exact: true }).fill("Workshop question");
    await page.getByRole("button", { name: `Review ${kind}`, exact: true }).click();
    await expect(message).toBeFocused();
    await message.fill("Please explain the next step for my vehicle.");
    const review = page.getByRole("button", { name: `Review ${kind}`, exact: true });
    await review.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(message).toHaveValue("Please explain the next step for my vehicle.");
    await expect(review).toBeFocused();
    await review.hover();
    expect(await review.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include(".contact-care").analyze()).violations,
    ).toEqual([]);
    await review.press("Enter");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: `Send ${kind}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: kind === "enquiry" ? "Enquiry received" : "Complaint received",
        exact: true,
      }),
    ).toBeFocused();
    expect(writes).toEqual([
      {
        subject: "Workshop question",
        branchId,
        name: "Contact Fixture",
        email: "contact@example.test",
        ...(kind === "enquiry"
          ? { type: "GENERAL", message: "Please explain the next step for my vehicle." }
          : { description: "Please explain the next step for my vehicle." }),
      },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`contact-${width}-receipt.png`) });
  });
}
