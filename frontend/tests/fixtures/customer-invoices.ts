import type { Page } from "@playwright/test";
import type { z } from "zod";
import { invoiceSchema } from "@/lib/api/invoice-schemas";

export const invoiceId = (n: number) =>
  `d4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function invoiceRecord(
  n = 1,
  status: z.infer<typeof invoiceSchema>["status"] = "ISSUED",
): z.infer<typeof invoiceSchema> {
  return {
    id: invoiceId(n),
    invoiceNumber: `AA-INV-${2040 + n}`,
    currency: "NGN",
    status,
    version: 1,
    subtotalKobo: "8500000",
    taxKobo: "637500",
    depositCreditKobo: n === 1 ? "1773750" : "0",
    totalKobo: n === 1 ? "7363750" : "9137500",
    issuedAt: "2026-10-08T09:00:00Z",
    createdAt: "2026-10-08T08:00:00Z",
    dueAt: n === 3 ? null : "2026-10-15T16:00:00Z",
    paidAt: status === "PAID" ? "2026-10-08T12:00:00Z" : null,
    order:
      n === 2 || n === 4
        ? { id: invoiceId(201 + n), orderNumber: `AA-ORD-${1061 + n}` }
        : null,
    booking: n === 1 ? { id: invoiceId(202) } : null,
    vehicleTransaction:
      n === 3 ? { id: invoiceId(204), transactionNumber: "AA-VEH-1064" } : null,
    payments: [],
  };
}
export async function invoicesFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    records: [
      invoiceRecord(1),
      invoiceRecord(2, "PAID"),
      invoiceRecord(3, "VOID"),
      invoiceRecord(4),
    ],
    reads: [] as URL[],
    writes: [] as string[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.replace("/api/v1", "");
    if (route.request().method() !== "GET") state.writes.push(endpoint);
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: invoiceId(301),
        user: { id: invoiceId(302), email: "invoices@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/customers/invoices") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => (state.held = resolve));
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      const status = url.searchParams.get("status"),
        records = url.searchParams.has("cursor")
          ? [invoiceRecord(5, "PAID")]
          : state.records;
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : records.filter((r) => !status || r.status === status),
              ...(!url.searchParams.has("cursor") && state.mode !== "empty" && !status
                ? { nextCursor: invoiceId(4) }
                : {}),
            };
    }
    if (endpoint.startsWith("/customers/invoices/")) {
      const record =
        state.records.find((r) => r.id === endpoint.split("/")[3]) ??
        invoiceRecord(5, "PAID");
      data = record;
      if (endpoint.endsWith("/document"))
        data = {
          schemaVersion: 1,
          id: record.id,
          invoiceNumber: record.invoiceNumber,
          currency: "NGN",
          status: record.status,
          version: record.version,
          issuedAt: record.issuedAt,
          dueAt: record.dueAt,
          paidAt: record.paidAt,
          issuer: { name: "Allied AutoTech", address: "QA workshop", paymentTerms: "" },
          billTo: { name: "Synthetic QA", address: "QA only", reference: invoiceId(302) },
          source: {
            type: record.booking
              ? "BOOKING"
              : record.vehicleTransaction
                ? "VEHICLE_TRANSACTION"
                : "ORDER",
            id:
              record.booking?.id ??
              record.vehicleTransaction?.id ??
              record.order?.id ??
              invoiceId(202),
            reference:
              record.vehicleTransaction?.transactionNumber ??
              record.order?.orderNumber ??
              "QA booking",
            description: record.booking
              ? "Service booking"
              : record.vehicleTransaction
                ? "Vehicle purchase"
                : "Order",
          },
          lines: [
            {
              description: "QA invoice snapshot",
              quantity: 1,
              unitPriceKobo: record.subtotalKobo,
              subtotalKobo: record.subtotalKobo,
            },
          ],
          discountKobo: "0",
          deliveryKobo: "0",
          detailBasis: "SNAPSHOT",
          subtotalKobo: record.subtotalKobo,
          taxKobo: record.taxKobo,
          depositCreditKobo: record.depositCreditKobo,
          totalKobo: record.totalKobo,
          receipts: [],
          paymentRequests: [],
        };
    }
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA fixture",
        meta: { requestId: "invoices-qa" },
        data,
      },
    });
  });
  return state;
}
