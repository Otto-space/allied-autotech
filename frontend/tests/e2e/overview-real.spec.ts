import { test, expect } from "@playwright/test";
import { z } from "zod";
import { parseOverview } from "@/lib/api/overview-schemas";

test.skip(
  process.env.RUN_OVERVIEW_DATABASE_TESTS !== "true",
  "Requires the guarded disposable overview API on loopback 5011",
);
const accountsSchema = z.array(
  z.object({
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
    cookie: z.object({ name: z.string(), value: z.string() }),
  }),
);
for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])
  test(`${role} overview reads real scoped aggregates through the frontend proxy`, async ({
    page,
    context,
    request,
  }) => {
    const fixture = await request.get("http://127.0.0.1:5011/__test/overview-accounts");
    expect(fixture.ok()).toBe(true);
    const actor = accountsSchema
      .parse(await fixture.json())
      .find((account) => account.role === role)!;
    await context.addCookies([
      {
        ...actor.cookie,
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const response = page.waitForResponse((value) => value.url().includes("/overview?"));
    await page.goto(role === "CUSTOMER" ? "/dashboard" : "/admin");
    const received = await response;
    expect(received.status()).toBe(200);
    expect(received.headers()["cache-control"]).toContain("no-store");
    const body = await received.json();
    const overview = parseOverview(body.data);
    expect(overview.scope).toBe(
      role === "CUSTOMER" ? "CUSTOMER" : role === "STAFF" ? "BRANCH" : "ORGANISATION",
    );
    expect(overview.counts.bookings).toBeGreaterThan(0);
    await expect(page.locator(".overview-metric").first().locator("strong")).toHaveText(
      overview.counts.bookings.toLocaleString("en-NG"),
    );
    await expect(
      page.getByRole("heading", { name: "Recent bookings", exact: true }),
    ).toBeVisible();
    expect(JSON.stringify(body)).not.toContain("Not for the overview");
    if (["CUSTOMER", "STAFF"].includes(role)) {
      expect(body.data).not.toHaveProperty("finance");
      await expect(page.getByText("Payments collected", { exact: true })).toHaveCount(0);
    } else expect(body.data).toHaveProperty("finance");
    await page.getByLabel("From", { exact: true }).fill("2000-01-01");
    await page.getByLabel("To", { exact: true }).fill("2000-01-01");
    await page.getByRole("button", { name: "Apply dates", exact: true }).click();
    await expect(
      page.getByText("No new bookings or orders in this period.", { exact: true }),
    ).toBeVisible();
  });
