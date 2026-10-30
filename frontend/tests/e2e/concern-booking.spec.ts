import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { booking, branch, id } from "../fixtures/public-account-actions";

for (const width of [390, 1440]) {
  test(`concern request requires review and preserves an uncertain retry at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let phone = "+2348000000000";
    const contactWrites: unknown[] = [];
    const vehicleWrites: unknown[] = [];
    const calls: { body: Record<string, unknown>; key: string | undefined }[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname.replace(/^\/api\/v1/, "");
      let data: unknown = { items: [] };
      if (pathname === "/auth/session")
        data = { user: { id: id(91), role: "CUSTOMER" }, mfaRequired: false };
      if (pathname === "/customers/profile") {
        if (req.method() === "PATCH") {
          contactWrites.push(req.postDataJSON());
          phone = req.postDataJSON().phone;
        }
        data = {
          profileVersion: contactWrites.length + 1,
          mediaVersion: 0,
          photo: null,
          firstName: "Test",
          lastName: "Customer",
          phone,
          address: null,
          city: null,
          state: null,
          country: "Nigeria",
          user: { id: id(91), email: "customer@example.test" },
        };
      }
      if (pathname === "/customers/vehicles") {
        if (req.method() === "POST") {
          vehicleWrites.push(req.postDataJSON());
          data = {
            ...req.postDataJSON(),
            id: id(92),
            images: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else data = { vehicles: [] };
      }
      if (pathname === "/auth/csrf") data = { csrfToken: "s".repeat(64) };
      if (pathname === "/public/branches") data = { items: [branch] };
      if (pathname === "/public/booking-policy")
        data = {
          version: "test-policy",
          minimumAdvanceHours: 168,
          maximumAdvanceHours: 336,
          paymentHoldMinutes: 30,
          depositBasisPoints: 0,
          depositRefundableForCustomerCancellation: false,
          customerRescheduleLimit: 1,
          customerRescheduleCutoffHours: 24,
          reminderHoursBeforeAppointment: [24],
        };
      if (pathname === "/customers/bookings" && req.method() === "POST") {
        calls.push({ body: req.postDataJSON(), key: req.headers()["idempotency-key"] });
        expect(req.headers()["x-csrf-token"]).toBe("s".repeat(64));
        if (calls.length === 1) return route.abort("failed");
        data = {
          booking: {
            ...booking,
            service: null,
            customerConcern: calls[0].body.customerConcern,
            status: "REQUESTED",
          },
        };
      }
      return route.fulfill({
        json: {
          success: true,
          data,
          message: "Isolated concern fixture",
          meta: { requestId: "concern-test" },
        },
      });
    });
    await page.goto("/services/request");
    await expect(
      page.getByRole("heading", { name: "Tell us what your vehicle needs" }),
    ).toBeVisible();
    await page
      .getByLabel("What have you noticed?")
      .fill("The vehicle vibrates when braking");
    await page
      .getByRole("combobox", { name: "Workshop", exact: true })
      .selectOption(branch.id);
    const date = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16);
    await page.getByLabel("Preferred date and time (Lagos)").fill(date);
    await page
      .getByRole("button", { name: "Load saved vehicles & contact details" })
      .click();
    await page.getByRole("button", { name: "Edit contact details", exact: true }).click();
    const contactEditor = page.getByRole("dialog", {
      name: "Edit booking contact details",
    });
    await contactEditor
      .getByLabel("Phone number", { exact: true })
      .fill("+2348000000001");
    expect(
      (await new AxeBuilder({ page }).include(".garage-dialog").analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath("contact-entry.png") });
    await contactEditor
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      contactEditor.getByText("Your profile has been updated.", { exact: true }).first(),
    ).toBeVisible();
    await contactEditor.getByRole("button", { name: "Close contact details" }).click();
    await expect(contactEditor).toHaveCount(0);
    expect(contactWrites).toEqual([{ phone: "+2348000000001", expectedVersion: 1 }]);
    expect(calls).toHaveLength(0);
    await page.getByRole("button", { name: "Add a vehicle for this booking" }).click();
    const editor = page.getByRole("dialog", { name: "Add a vehicle" });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Make (required)", { exact: true }).fill("Toyota");
    await editor.getByLabel("Model (required)", { exact: true }).fill("Corolla");
    await editor.getByLabel("Year (required)", { exact: true }).fill("2020");
    expect(
      (await new AxeBuilder({ page }).include(".garage-dialog").analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath("vehicle-entry.png") });
    await editor.getByRole("button", { name: "Save vehicle", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByText("Selected vehicle:", { exact: false })).toContainText(
      "2020 Toyota Corolla",
    );
    expect(vehicleWrites).toHaveLength(1);
    expect(calls).toHaveLength(0);
    await expect(page.getByLabel("What have you noticed?")).toHaveValue(
      "The vehicle vibrates when braking",
    );
    await page.getByRole("button", { name: "Review request", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Review your request" }),
    ).toBeFocused();
    expect(calls).toHaveLength(0);
    await page.getByRole("button", { name: "Request a workshop visit" }).click();
    await expect(
      page.getByRole("button", { name: "Retry the same request" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit details" })).toBeDisabled();
    await page.getByRole("button", { name: "Retry the same request" }).click();
    await expect(
      page.getByRole("heading", { name: "Your request is saved" }),
    ).toBeVisible();
    expect(calls).toHaveLength(2);
    expect(calls[0].key).toBeTruthy();
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[0].body.vehicleId).toBe(id(92));
    expect(calls[0].body).not.toHaveProperty("serviceId");
    expect(calls[0].body).not.toHaveProperty("priceKobo");
    await expect(
      page.getByText("The workshop will review your concern.", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath("concern-receipt.png") });
  });
}

for (const mode of [
  "vehicle-uncertain",
  "contact-account-change",
  "vehicle-account-change",
] as const) {
  test(`embedded booking editor recovery: ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let owner = id(91);
    let vehicleWrites = 0;
    let bookingWrites = 0;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.replace("/api/v1", "");
      let data: unknown = { items: [] };
      if (endpoint === "/auth/session")
        data = { user: { id: owner, role: "CUSTOMER" }, mfaRequired: false };
      if (endpoint === "/auth/csrf") data = { csrfToken: "s".repeat(64) };
      if (endpoint === "/customers/profile")
        data = {
          profileVersion: 1,
          mediaVersion: 0,
          photo: null,
          firstName: "Previous",
          lastName: "Customer",
          phone: "+2348000000000",
          address: null,
          city: null,
          state: null,
          country: "Nigeria",
          user: { id: owner, email: "previous@example.test" },
        };
      if (endpoint === "/customers/vehicles") {
        if (request.method() === "POST") {
          vehicleWrites++;
          return route.abort("failed");
        }
        data = { vehicles: [] };
      }
      if (endpoint === "/customers/bookings" && request.method() === "POST")
        bookingWrites++;
      if (endpoint === "/public/branches") data = { items: [branch] };
      if (endpoint === "/public/booking-policy")
        data = {
          version: "test-policy",
          minimumAdvanceHours: 168,
          maximumAdvanceHours: 336,
          paymentHoldMinutes: 0,
          depositBasisPoints: 0,
          depositRefundableForCustomerCancellation: false,
          customerRescheduleLimit: 1,
          customerRescheduleCutoffHours: 24,
          reminderHoursBeforeAppointment: [24],
        };
      return route.fulfill({
        json: {
          success: true,
          message: "Isolated recovery fixture",
          data,
          meta: { requestId: "recovery-test" },
        },
      });
    });
    await page.goto("/services/request");
    await page
      .getByLabel("What have you noticed?")
      .fill("Private concern from previous account");
    await page
      .getByRole("button", { name: "Load saved vehicles & contact details" })
      .click();
    const contact = mode === "contact-account-change";
    await page
      .getByRole("button", {
        name: contact ? "Edit contact details" : "Add a vehicle for this booking",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    if (mode === "vehicle-uncertain") {
      await dialog.getByLabel("Make (required)", { exact: true }).fill("Toyota");
      await dialog.getByLabel("Model (required)", { exact: true }).fill("Corolla");
      await dialog.getByLabel("Year (required)", { exact: true }).fill("2020");
      await dialog.getByRole("button", { name: "Save vehicle", exact: true }).click();
      await expect(dialog.getByText(/couldn't confirm the save/)).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Save vehicle", exact: true }),
      ).toBeDisabled();
      await dialog.getByRole("button", { name: "Close vehicle dialog" }).click();
      await expect(
        page.getByRole("button", { name: "Add a vehicle for this booking" }),
      ).toBeDisabled();
      await expect(page.getByLabel("What have you noticed?")).toHaveValue(
        "Private concern from previous account",
      );
      await page
        .getByRole("button", { name: "Refresh vehicle & contact details" })
        .click();
      await expect(
        page.getByRole("button", { name: "Add a vehicle for this booking" }),
      ).toBeEnabled();
      expect(vehicleWrites).toBe(1);
    } else {
      owner = id(99);
      await page.evaluate(() => window.dispatchEvent(new Event("aat:session-changed")));
      await expect(dialog).toHaveCount(0);
      await expect(page.getByLabel("What have you noticed?")).toHaveValue("");
      await expect(page.getByText("previous@example.test", { exact: true })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole("button", { name: "Add a vehicle for this booking" }),
      ).toHaveCount(0);
      expect(vehicleWrites).toBe(0);
    }
    expect(bookingWrites).toBe(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
}
