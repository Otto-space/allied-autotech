import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export const purchaseId = (n: number) =>
  `e6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function purchaseRecord(n = 1, status = "ENQUIRY") {
  return {
    id: purchaseId(n),
    transactionNumber: `VT-2026-${String(n).padStart(4, "0")}`,
    status,
    version: 0,
    askingPriceKobo: "2450000000",
    agreedPriceKobo: status === "ENQUIRY" ? null : "2400000050",
    reservationRequiredKobo: null,
    currency: "NGN",
    reservationExpiresAt: null,
    termsVersion: null,
    termsAcceptedAt: null,
    paidAt: null,
    cancellationReason: null,
    createdAt: "2026-10-09T08:00:00Z",
    statusHistory: [],
    handover: null,
    vehicleListing: {
      id: purchaseId(200 + n),
      title: [
        "2021 Toyota Camry",
        "2022 Lexus RX 350",
        "2020 Honda Accord",
        "2023 Toyota Highlander",
      ][(n - 1) % 4],
      status: "AVAILABLE",
      vehicle: {
        images: [
          {
            id: purchaseId(400 + n),
            url: "/api/v1/public/vehicles/images/" + purchaseId(400 + n),
            altText: "Vehicle listing photograph",
            isPrimary: true,
          },
        ],
      },
    },
  };
}
export async function purchasesFixture(page: Page, role = "CUSTOMER") {
  const image = readFileSync(
    path.join(process.cwd(), "public/images/allied-autotech/executive-campaign.webp"),
  );
  const state = {
    mode: "normal",
    records: [
      purchaseRecord(1),
      purchaseRecord(2, "PAYMENT_PENDING"),
      purchaseRecord(3, "RESERVED"),
      purchaseRecord(4, "CANCELLED"),
    ],
    reads: [] as URL[],
    writes: [] as string[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (route.request().method() !== "GET") state.writes.push(endpoint);
    if (endpoint.startsWith("/public/vehicles/images/"))
      return route.fulfill({ contentType: "image/webp", body: image });
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: purchaseId(301),
        user: { id: purchaseId(302), email: "purchases@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-09T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint.startsWith("/customers/vehicle-transactions/"))
      data =
        state.records.find((r) => r.id === endpoint.split("/").at(-1)) ??
        purchaseRecord(5, "COMPLETED");
    if (endpoint === "/customers/vehicle-transactions") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "offline") return route.abort("internetdisconnected");
      if (["error", "denied", "rate"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "denied" ? 403 : state.mode === "rate" ? 429 : 503,
          json: {
            success: false,
            error: {
              code:
                state.mode === "denied"
                  ? "FORBIDDEN"
                  : state.mode === "rate"
                    ? "RATE_LIMITED"
                    : "DATABASE_UNAVAILABLE",
            },
          },
        });
      const status = url.searchParams.get("status");
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : (url.searchParams.has("cursor")
                      ? [purchaseRecord(5, "COMPLETED")]
                      : state.records
                    ).filter((r) => !status || r.status === status),
              ...(!status && !url.searchParams.has("cursor") && state.mode !== "empty"
                ? { nextCursor: purchaseId(4) }
                : {}),
            };
    }
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA",
        meta: { requestId: "purchases-qa" },
        data,
      },
    });
  });
  return state;
}
