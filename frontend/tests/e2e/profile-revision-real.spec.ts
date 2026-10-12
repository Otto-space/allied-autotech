import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const file = process.env.PROFILE_REVISION_SESSION_FILE;
test.skip(!file, "Requires the isolated profile API and synthetic session fixture");
test("real API conflict preserves and explicitly rebases a draft across reload", async ({
  page,
  browser,
}) => {
  const fixture = JSON.parse(readFileSync(file!, "utf8"));
  const base = process.env.PLAYWRIGHT_BASE_URL!;
  const second = await browser.newContext({ baseURL: base });
  try {
    await page.context().addCookies([
      {
        name: "aat_session",
        value: fixture.sessions[0],
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await second.addCookies([
      {
        name: "aat_session",
        value: fixture.sessions[1],
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/dashboard/profile");
    const original = (
      await (await second.request.get("/api/v1/customers/profile")).json()
    ).data;
    const draftName = original.firstName === "Ada" ? "Zainab" : "Ada";
    const serverCity = original.city === "Abuja" ? "Enugu" : "Abuja";
    await page.getByLabel("First name", { exact: true }).fill(draftName);
    const csrf = (
      await (
        await second.request.post("/api/v1/auth/csrf", {
          headers: { Origin: base },
          data: {},
        })
      ).json()
    ).data.csrfToken;
    const update = await second.request.patch("/api/v1/customers/profile", {
      headers: { Origin: base, "X-CSRF-Token": csrf },
      data: {
        expectedVersion: original.profileVersion,
        firstName: "Amaka",
        city: serverCity,
      },
    });
    expect(update.status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue(draftName);
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
    await expect(page.locator(".cp-review")).toContainText("Amaka");
    await expect(page.locator(".cp-review")).toContainText(serverCity);
    await page.getByRole("button", { name: "Keep my changes", exact: true }).click();
    await expect(page.getByLabel("City (optional)", { exact: true })).toHaveValue(
      serverCity,
    );
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(
      page.getByText("Your profile has been updated.", { exact: true }).first(),
    ).toBeVisible();
    const saved = (await (await second.request.get("/api/v1/customers/profile")).json())
      .data;
    expect(saved).toMatchObject({
      profileVersion: original.profileVersion + 2,
      firstName: draftName,
      city: serverCity,
      mediaVersion: original.mediaVersion,
    });
  } finally {
    await second.close();
  }
});

test("real committed save with dropped response recovers without another PATCH", async ({
  page,
}) => {
  const fixture = JSON.parse(readFileSync(file!, "utf8"));
  const base = process.env.PLAYWRIGHT_BASE_URL!;
  await page.context().addCookies([
    {
      name: "aat_session",
      value: fixture.sessions[0],
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const original = (await (await page.request.get("/api/v1/customers/profile")).json())
    .data;
  const nextName = original.firstName === "Zainab" ? "Ada" : "Zainab";
  let writes = 0;
  await page.route("**/api/v1/customers/profile", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    writes++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("connectionreset");
  });
  await page.goto("/dashboard/profile");
  await page.getByLabel("First name", { exact: true }).fill(nextName);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reload saved details", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload saved details", exact: true }).click();
  await page.getByRole("button", { name: "Keep my changes", exact: true }).click();
  await expect(page.getByLabel("First name", { exact: true })).toHaveValue(nextName);
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  const saved = (await (await page.request.get("/api/v1/customers/profile")).json()).data;
  expect(saved.profileVersion).toBe(original.profileVersion + 1);
  expect(writes).toBe(1);
});
