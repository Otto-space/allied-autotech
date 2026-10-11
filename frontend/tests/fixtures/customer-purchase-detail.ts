import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { purchaseId, purchaseRecord } from "./customer-purchases";
import { parseCustomerPurchaseDetail } from "@/lib/api/customer-purchase-detail-schema";
export { purchaseId };
export const purchaseDetailPath = `/dashboard/vehicle-transactions/${purchaseId(1)}`;
export function detailRecord() {
  return parseCustomerPurchaseDetail({
    ...purchaseRecord(1, "RESERVED"),
    reservationRequiredKobo: "50000000",
    reservationExpiresAt: "2027-01-01T10:00:00Z",
    termsVersion: "QA-v1",
    termsAcceptedAt: "2026-10-09T09:00:00Z",
    statusHistory: [
      {
        id: purchaseId(700),
        fromStatus: null,
        toStatus: "ENQUIRY",
        reason: "Vehicle enquiry received.",
        createdAt: "2026-10-08T09:00:00Z",
      },
      {
        id: purchaseId(701),
        fromStatus: "NEGOTIATING",
        toStatus: "RESERVED",
        reason: "Reservation recorded.",
        createdAt: "2026-10-09T09:00:00Z",
      },
    ],
  });
}
export async function purchaseDetailFixture(page: Page, role = "CUSTOMER") {
  const image = readFileSync(
    path.join(process.cwd(), "public/images/allied-autotech/showroom-editorial.webp"),
  );
  const state = {
    record: detailRecord(),
    mode: "normal",
    reads: [] as string[],
    writes: [] as string[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (route.request().method() !== "GET") state.writes.push(endpoint);
    state.reads.push(endpoint);
    if (endpoint.startsWith("/public/vehicles/images/"))
      return route.fulfill({ contentType: "image/webp", body: image });
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: purchaseId(301),
        user: { id: purchaseId(302), email: "purchase-detail@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-09T08:00:00Z",
      };
    if (endpoint.startsWith("/customers/vehicle-transactions/")) {
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied", "missing"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "denied" ? 403 : state.mode === "missing" ? 404 : 503,
          json: {
            success: false,
            error: {
              code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND",
            },
          },
        });
      data =
        state.mode === "malformed"
          ? { ...state.record, createdAt: "invalid" }
          : state.record;
    }
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Isolated QA response",
        meta: { requestId: "purchase-detail-qa" },
      },
    });
  });
  return state;
}
