import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  workPaymentFixture,
  paymentRow,
  decidePayment,
  bookingId as id,
} from "../fixtures/work-payments";
const button = (p: Page, name: string) => p.getByRole("button", { name, exact: true }),
  cards = (p: Page) => p.locator(".wp-records>.wp-payment"),
  url = (n = 0) => `/admin/payments?selected=${id(180000 + n)}&attempt=${id(184000 + n)}`;
async function manual(
  p: Page,
  note = "Independently checked bank entry",
  decision = "REJECTED",
) {
  await p.getByLabel("Manual payment decision", { exact: true }).selectOption(decision);
  await p.getByLabel("Manual payment reviewer note", { exact: true }).fill(note);
  await button(p, "Review manual payment decision").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
async function refund(p: Page) {
  await p.getByLabel("Refund amount (NGN)").fill("123.45");
  await p
    .getByLabel("Refund reason", { exact: true })
    .fill("Exact original refund reason");
  await button(p, "Review refund request").click();
  await expect(p.getByRole("dialog")).toBeVisible();
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} sees complete payment/source/attempt records with its own active identity`, async ({
    page,
  }) => {
    const f = await workPaymentFixture(page, role);
    await page.goto(url());
    await expect(cards(page)).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "Payment records", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator('.work-payments nav[aria-label="Breadcrumb"] li'),
    ).toHaveCount(2);
    await expect(cards(page).first()).toContainText(id(184000));
    await expect(cards(page).first()).toContainText("09:00:00.123");
    await expect(cards(page).first()).toContainText("Amina Okafor");
    await expect(cards(page).first().getByRole("link")).toHaveAttribute(
      "href",
      `/admin/orders/${id(181000)}`,
    );
    expect(f.payments.profileReads).toBeGreaterThan(0);
    expect(f.payments.writes).toHaveLength(0);
  });
test("Staff has no finance controls or private finance reads", async ({ page }) => {
  const f = await workPaymentFixture(page, "STAFF");
  await page.goto("/admin/payments");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Administrator access is required",
  );
  await expect(cards(page)).toHaveCount(0);
  expect(f.payments.reads).toHaveLength(0);
  expect(f.payments.directReads).toHaveLength(0);
});
for (const mode of ["error", "inactive", "mismatch", "denied"])
  test(`own-profile ${mode} blocks finance discovery before protected reads`, async ({
    page,
  }) => {
    const f = await workPaymentFixture(page);
    f.payments.profileMode = mode;
    await page.goto("/admin/payments");
    await expect(page.locator(".work-payments").getByRole("alert")).toBeVisible();
    expect(f.payments.reads).toHaveLength(0);
    expect(f.payments.writes).toHaveLength(0);
  });
test("supported filters, 25+3 cursor history, reload and Back retain scope and selected attempt", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  f.payments.records = Array.from({ length: 28 }, (_, n) => paymentRow(n));
  await page.goto(url());
  await expect(cards(page)).toHaveCount(25);
  await button(page, "Next").click();
  await expect(cards(page)).toHaveCount(3);
  await expect(page).toHaveURL(/cursor=/);
  await page.reload();
  await expect(cards(page)).toHaveCount(3);
  await page.goBack();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(cards(page)).toHaveCount(25);
  await page
    .getByLabel("Payment status", { exact: true })
    .selectOption("REQUIRES_REVIEW");
  await page.getByLabel("Payment provider filter").selectOption("MANUAL");
  await page.getByLabel("Customer profile reference (optional)").fill(id(7));
  await button(page, "Apply payment filters").click();
  await expect(page).toHaveURL(/customerId=/);
  await expect
    .poll(() => f.payments.reads.at(-1)?.searchParams.get("customerId"))
    .toBe(id(7));
  expect(f.payments.reads.at(-1)?.searchParams.has("selected")).toBe(false);
  await page.reload();
  await expect(page.getByLabel("Payment provider filter")).toHaveValue("MANUAL");
  await button(page, "Clear payment filters").click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(cards(page)).toHaveCount(25);
});
test("all source destinations and every provider attempt retain exact references without invented names", async ({
  page,
}) => {
  const f = await workPaymentFixture(page),
    booking = paymentRow(2, true),
    vehicle = paymentRow(3, true);
  booking.purpose = "BOOKING_DEPOSIT";
  booking.invoiceId = null;
  vehicle.purpose = "VEHICLE_FULL_PAYMENT";
  vehicle.invoiceId = null;
  vehicle.bookingId = null;
  vehicle.vehicleTransactionId = id(189000);
  vehicle.attempts[0].provider = "MONNIFY";
  f.payments.records.push(booking, vehicle);
  const second = {
    ...paymentRow(9, true).attempts[0],
    attemptNumber: 2,
    status: "FAILED" as const,
  };
  f.payments.records[0].attempts.unshift(second);
  await page.goto("/admin/payments?provider=PAYSTACK");
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText("Manual payment evidence");
  await expect(cards(page).first()).toContainText(second.id);
  await button(page, "Clear payment filters").click();
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(`a[href="/admin/invoices/${id(182001)}"]`)).toHaveCount(1);
  await expect(
    page.locator(`a[href="/admin/bookings/${booking.bookingId}"]`),
  ).toHaveCount(1);
  await expect(
    page.locator(`a[href="/admin/vehicle-sales/${vehicle.vehicleTransactionId}"]`),
  ).toHaveCount(1);
});
test("invalid filter links are explained without forwarding unsupported finance queries", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  for (const query of ["status=ADMIN", "customerId=bad", "q=private&limit=999"]) {
    await page.goto(`/admin/payments?${query}`);
    await expect(
      page.getByRole("heading", { name: "Payment filters unavailable" }),
    ).toBeVisible();
  }
  expect(f.payments.reads).toHaveLength(0);
  await button(page, "Reset payment filters").click();
  await expect(cards(page)).toHaveCount(2);
});
test("temporary failure retains labelled facts and disables changes; retry is distinct from empty", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await expect(cards(page)).toHaveCount(2);
  f.payments.mode = "error";
  await button(page, "Refresh payment records").click();
  await expect(button(page, "Retry payment records")).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await expect(button(page, "Review manual payment decision")).toBeDisabled();
  f.payments.mode = "empty";
  await button(page, "Retry payment records").click();
  await expect(
    page.getByRole("heading", { name: "No payments match this page and filters" }),
  ).toBeVisible();
});
test("denied collection reads clear private records, forms and saved facts before access recovers", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await expect(cards(page)).toHaveCount(2);
  f.payments.mode = "denied";
  await button(page, "Refresh payment records").click();
  await expect(
    page.getByRole("heading", { name: "Payment records unavailable", exact: true }),
  ).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("Amina Okafor", { exact: true })).toHaveCount(0);
  f.payments.mode = "normal";
  await button(page, "Check payment access and reload").click();
  await expect(cards(page)).toHaveCount(2);
});
test("manual validation, full long-note review and cancellation preserve opener focus without extra reads", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await button(page, "Review manual payment decision").click();
  await expect(page.getByLabel("Manual payment reviewer note")).toBeFocused();
  const note = "Independently matched reference. " + "Full factual basis. ".repeat(30);
  await manual(page, note);
  await expect(page.getByRole("dialog")).toContainText(note.trim());
  await expect(page.getByRole("dialog")).toContainText(id(184000));
  const reads = f.payments.directReads.length;
  await button(page, "Go back").click();
  await expect(button(page, "Review manual payment decision")).toBeFocused();
  await expect(page.getByLabel("Manual payment reviewer note")).toHaveValue(note);
  expect(f.payments.directReads).toHaveLength(reads);
  expect(f.payments.writes).toHaveLength(0);
});
test("manual approval is single-flight and confirms only the exact received decision", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page, "Exact bank verification", "APPROVED");
  f.payments.writeMode = "hold";
  await button(page, "Confirm change").click();
  await expect.poll(() => f.payments.writes.length).toBe(1);
  await expect(button(page, "Submitting…")).toBeDisabled();
  f.payments.held?.();
  await expect(
    page.getByRole("heading", { name: "Last confirmed manual decision" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Last confirmed manual decision" }),
  ).toBeFocused();
  await expect(page.locator(".wp-confirmed")).toContainText("Exact bank verification");
  await expect(button(page, "Review manual payment decision")).toHaveCount(0);
  expect(f.payments.writes[0].body).toEqual({
    decision: "APPROVED",
    reviewerNote: "Exact bank verification",
  });
});
test("payment decision draft and selected attempt survive reload", async ({ page }) => {
  await workPaymentFixture(page);
  await page.goto(url());
  await page
    .getByLabel("Manual payment reviewer note")
    .fill("Retained scoped manual note");
  await page.getByLabel("Manual payment reviewer note").blur();
  await page.reload();
  await expect(page.getByLabel("Manual payment reviewer note")).toHaveValue(
    "Retained scoped manual note",
  );
});
test("a competing terminal decision stops before UI dispatch and retains the current record", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page);
  decidePayment(f.payments.records[0], "REJECTED", "Another authorized operator decided");
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No payment change was sent");
  expect(f.payments.writes).toHaveLength(0);
  await button(page, "Go back").click();
  await expect(cards(page).first()).toContainText("Another authorized operator decided");
});
for (const mode of [
  "lost",
  "malformed",
  "wrong-note",
  "wrong-attempt",
  "wrong-source",
  "rate",
])
  test(`uncertain manual ${mode} remains locked through reload and reads current facts without replay`, async ({
    page,
  }) => {
    const f = await workPaymentFixture(page);
    await page.goto(url());
    await manual(page);
    f.payments.writeMode = mode;
    await button(page, "Confirm change").click();
    await expect(button(page, "Confirm change")).toBeDisabled();
    await button(page, "Close & review record").click();
    await expect(button(page, "Load current payment")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "A payment change needs reconciliation" }),
    ).toBeFocused();
    await page.reload();
    await expect(button(page, "Load current payment")).toBeVisible();
    await button(page, "Load current payment").click();
    await expect(page.locator(".work-payments")).toContainText(
      "this read does not prove the original request outcome",
    );
    expect(f.payments.writes).toHaveLength(1);
    if (mode === "rate")
      await expect(page.getByLabel("Manual payment reviewer note")).toHaveValue("");
  });
test("definite manual conflict preserves the draft without an uncertain-result claim", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page);
  f.payments.writeMode = "rejected";
  await button(page, "Confirm change").click();
  await expect(button(page, "Confirm change")).toBeDisabled();
  await expect(page.getByRole("dialog")).not.toContainText(
    "outcome could not be confirmed",
  );
  await button(page, "Go back").click();
  await expect(page.getByLabel("Manual payment reviewer note")).toHaveValue(
    "Independently checked bank entry",
  );
  await expect(button(page, "Load current payment")).toHaveCount(0);
});
test("an ineligible original submitter never receives a manual-decision action", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  f.payments.records[0].attempts[0].manualReview!.canReview = false;
  await page.goto(url());
  await expect(cards(page)).toHaveCount(2);
  await expect(button(page, "Review manual payment decision")).toHaveCount(0);
  await expect(cards(page).first()).toContainText(
    "A different administrator must decide",
  );
});
test("refund validation, exact kobo and received request status preserve financial meaning", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await page.getByLabel("Refund amount (NGN)").fill("75000.01");
  await page
    .getByLabel("Refund reason", { exact: true })
    .fill("Exact original refund reason");
  await button(page, "Review refund request").click();
  await expect(page.getByLabel("Refund amount (NGN)")).toBeFocused();
  await refund(page);
  await expect(page.getByRole("dialog")).toContainText(
    "no money is returned by this request",
  );
  await expect(page.getByRole("dialog")).toContainText("₦123.45");
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: /Refund request REF-QA/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Refund request REF-QA/ }),
  ).toBeFocused();
  expect(f.payments.writes[0].body.amountKobo).toBe("12345");
  await expect(page.locator(".wp-confirmed")).toContainText(
    "different authorized operator",
  );
});
for (const mode of ["lost", "wrong-actor", "wrong-amount", "wrong-note"])
  test(`uncertain refund ${mode} recovers the exact original request after reload without another POST`, async ({
    page,
  }) => {
    const f = await workPaymentFixture(page);
    await page.goto(url(1));
    await refund(page);
    f.payments.writeMode = mode;
    await button(page, "Confirm change").click();
    await button(page, "Close & review record").click();
    await expect(button(page, "Check original refund request")).toBeVisible();
    await page.reload();
    await button(page, "Check original refund request").click();
    await expect(page.locator(".work-payments")).toContainText(
      "Original refund request located",
    );
    await expect(
      page.getByRole("heading", { name: /Refund request REF-QA/ }),
    ).toBeFocused();
    await expect(
      page.getByRole("heading", { name: /Refund request REF-QA/ }),
    ).toBeVisible();
    expect(f.payments.writes).toHaveLength(1);
    expect(f.payments.lookupReads).toHaveLength(1);
  });
test("an absent original refund retains its lock after reload and makes no outcome-proof claim", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await refund(page);
  f.payments.writeMode = "uncommitted";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await page.reload();
  await button(page, "Check original refund request").click();
  await expect(page.locator(".wp-recovery")).toBeVisible();
  await expect(page.locator(".work-payments")).toContainText(
    "does not prove the request failed",
  );
  await expect(button(page, "Review original refund request")).toBeEnabled();
  expect(f.payments.writes).toHaveLength(1);
});
test("explicit retained refund retry sends the same immutable body/key and records one request", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await refund(page);
  f.payments.writeMode = "uncommitted";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  f.payments.writeMode = "normal";
  await button(page, "Review retained refund request").click();
  await expect(page.getByRole("dialog")).toContainText("Exact original refund reason");
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: /Refund request REF-QA/ }),
  ).toBeVisible();
  expect(f.payments.writes).toHaveLength(2);
  expect(f.payments.writes[1].key).toBe(f.payments.writes[0].key);
  expect(f.payments.writes[1].body).toEqual(f.payments.writes[0].body);
  expect(f.payments.refunds.size).toBe(1);
});
test("a contradictory original-refund lookup retains its lock", async ({ page }) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await refund(page);
  f.payments.writeMode = "lost";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  f.payments.lookupMode = "wrong-reason";
  await button(page, "Check original refund request").click();
  await expect(page.locator(".work-payments")).toContainText(
    "original refund request could not be confirmed",
  );
  await expect(page.locator(".wp-recovery")).toBeVisible();
  expect(f.payments.writes).toHaveLength(1);
});
test("current access revocation prevents dispatch and clears protected payment facts", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page);
  f.payments.profileMode = "denied";
  await button(page, "Confirm change").click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("Amina Okafor", { exact: true })).toHaveCount(0);
  expect(f.payments.writes).toHaveLength(0);
});
test("unavailable pending storage blocks dispatch before a financial write", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("aat:staff-payment:v1:")) throw Error("Blocked");
      return set.call(this, key, value);
    };
  });
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page);
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No payment change was sent");
  expect(f.payments.writes).toHaveLength(0);
});
test("seven widths and a full long-note dialog have no overflow or Axe violations", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  f.payments.records[0].paymentNumber = "PAY-" + "X".repeat(46);
  f.payments.records[0].attempts[0].manualReview!.payerName =
    "Long recorded payer ".repeat(8);
  await page.goto(url());
  await expect(cards(page)).toHaveCount(2);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await manual(page, "Exact full long reviewer note. ".repeat(25));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("reload refund recovery permits only the exact original body and key", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await refund(page);
  f.payments.writeMode = "uncommitted";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await page.reload();
  await expect(page.getByLabel("Refund reason", { exact: true })).toHaveValue(
    "Exact original refund reason",
  );
  await page.getByLabel("Refund reason", { exact: true }).fill("Changed original reason");
  await button(page, "Review original refund request").click();
  await button(page, "Confirm change").click();
  await expect(page.getByRole("dialog")).toContainText("No payment change was sent");
  expect(f.payments.writes).toHaveLength(1);
  await button(page, "Go back").click();
  await page
    .getByLabel("Refund reason", { exact: true })
    .fill("Exact original refund reason");
  f.payments.writeMode = "normal";
  await button(page, "Review original refund request").click();
  await button(page, "Confirm change").click();
  await expect(
    page.getByRole("heading", { name: /Refund request REF-QA/ }),
  ).toBeVisible();
  expect(f.payments.writes).toHaveLength(2);
  expect(f.payments.writes[1]).toEqual(f.payments.writes[0]);
  expect(f.payments.refunds.size).toBe(1);
});
test("denied original-refund reads clear protected facts while retaining a recovery lock", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url(1));
  await refund(page);
  f.payments.writeMode = "lost";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  f.payments.lookupMode = "denied";
  await button(page, "Check original refund request").click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText("Amina Okafor", { exact: true })).toHaveCount(0);
  expect(f.payments.writes).toHaveLength(1);
  f.payments.lookupMode = "normal";
  await button(page, "Check payment access and reload").click();
  await expect(button(page, "Check original refund request")).toBeVisible();
});
test("private evidence requires explicit temporary access and denial clears its protected workspace", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  f.payments.records[0].attempts[0].manualReview!.evidenceSha256 = "a".repeat(64);
  await page.goto(url());
  await expect(button(page, "Request payment evidence")).toBeEnabled();
  expect(f.payments.evidenceReads).toHaveLength(0);
  await button(page, "Request payment evidence").click();
  await expect(
    page.getByRole("link", { name: "Download payment evidence", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://storage.invalid/evidence/payment?signature=isolated",
  );
  f.payments.evidenceMode = "denied";
  await button(page, "Request payment evidence").click();
  await expect(cards(page)).toHaveCount(0);
  expect(f.payments.evidenceReads).toHaveLength(2);
});
test("redacted recovery references require explicit manual reconciliation without sending a write", async ({
  page,
}) => {
  const f = await workPaymentFixture(page);
  await page.goto(url());
  await manual(page);
  f.payments.writeMode = "lost";
  await button(page, "Confirm change").click();
  await button(page, "Close & review record").click();
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("aat:staff-payment:v1:")) sessionStorage.setItem(key, "pending");
  });
  await page.reload();
  await expect(button(page, "Confirm manual reconciliation")).toBeDisabled();
  await page.getByRole("checkbox").check();
  await button(page, "Confirm manual reconciliation").click();
  await expect(page.locator(".work-payments")).toContainText(
    "original request outcome was not automatically proven",
  );
  await expect(
    page.getByRole("heading", { name: f.payments.records[0].paymentNumber, exact: true }),
  ).toBeFocused();
  expect(f.payments.writes).toHaveLength(1);
});
