import { test, expect } from "@playwright/test";
import { z } from "zod";

test.skip(
  process.env.RUN_FRONTEND_DATABASE_TESTS !== "true",
  "Requires the guarded loopback backend harness and fresh isolated fixture.",
);
const fixtureSchema = z.object({
  email: z.string(),
  password: z.string(),
  branchId: z.string().uuid(),
  serviceId: z.string().uuid(),
  serviceName: z.string(),
  productId: z.string().uuid(),
  productName: z.string(),
});

test("real cookie login, server-rendered details, booking deposit, cart and checkout", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120_000);
  const fixtureResponse = await request.post("http://127.0.0.1:5000/__test/fixture");
  expect(fixtureResponse.ok()).toBe(true);
  const fixture = fixtureSchema.parse(await fixtureResponse.json());
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(fixture.email)).toBeVisible();
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name === "aat_session");
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  await page.goto("/dashboard/profile", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("First name")).toHaveValue("Browser");
  await page.getByLabel("First name").fill("BrowserUpdated");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your profile has been updated.")).toBeVisible();

  const serviceResponse = await page.goto(`/services/${fixture.serviceId}`, {
    waitUntil: "domcontentloaded",
  });
  expect(await serviceResponse?.text()).toContain(`<h1>${fixture.serviceName}</h1>`);
  await expect(
    page.getByRole("heading", { name: fixture.serviceName, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Workshop branch").selectOption(fixture.branchId);
  const slot = page.locator(".slot-grid .slot");
  await expect(slot).toHaveCount(1);
  await slot.click();
  await page.getByLabel("I have read and accept these deposit terms.").check();
  await page.getByRole("button", { name: "Request booking & review deposit" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking request received" }),
  ).toBeVisible();
  await expect(page.getByText("Status: AWAITING DEPOSIT")).toBeVisible();
  await expect(page.getByText(/Deposit due:.*3\.02/)).toBeVisible();
  await page.getByRole("link", { name: "Review booking & deposit" }).click();
  await expect(
    page.getByRole("link", { name: "Check deposit & payment options" }),
  ).toBeVisible();

  const productResponse = await page.goto(`/parts/${fixture.productId}`, {
    waitUntil: "domcontentloaded",
  });
  expect(await productResponse?.text()).toContain(`<h1>${fixture.productName}</h1>`);
  await expect(
    page.getByRole("heading", { name: fixture.productName, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Quantity").fill("2");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/customers/cart/items/${fixture.productId}`) &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: /cart/i }).click();
  expect((await saved).status()).toBe(200);
  await page.goto("/dashboard/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(fixture.productName)).toBeVisible();
  await page.getByLabel("Collection branch").selectOption(fixture.branchId);
  await page.getByRole("button", { name: "Create order & review total" }).click();
  await expect(page.getByRole("heading", { name: "Order created" })).toBeVisible();
  await page.getByRole("link", { name: "Review order & payment" }).click();
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(page.getByText(/2,500\.00/).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).some((cookie) => cookie.name === "aat_session")).toBe(
    false,
  );
});
