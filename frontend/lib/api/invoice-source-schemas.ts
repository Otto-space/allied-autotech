import { z } from "zod";
import { money } from "./commerce-schemas";
export type InvoiceSourceType = "ORDER" | "BOOKING" | "VEHICLE_TRANSACTION";
const ref = z.object({ id: z.string().uuid() });
const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().optional() });
const orders = page(
  ref.extend({
    orderNumber: z.string(),
    status: z.string(),
    totalKobo: money,
    branch: z.object({ name: z.string() }),
    invoice: ref.nullable(),
  }),
);
const bookings = page(
  ref.extend({
    status: z.string(),
    service: z.object({ name: z.string() }),
    branch: z.object({ name: z.string() }).nullable(),
    quotes: z.array(z.object({ status: z.string() })),
  }),
);
const transactions = page(
  ref.extend({
    transactionNumber: z.string(),
    status: z.string(),
    agreedPriceKobo: money.nullable(),
    customerId: z.string().uuid().nullable(),
    vehicleListing: z.object({ title: z.string() }),
  }),
);
export type InvoiceSource = { id: string; label: string };
type SourcePage = { items: InvoiceSource[]; nextCursor?: string };
const invoiceableVehicleStatuses = [
  "PAYMENT_PENDING",
  "RESERVED",
  "PARTIALLY_PAID",
  "PAID",
  "HANDOVER_PENDING",
  "COMPLETED",
];
export const invoiceSourceOptions = {
  ORDER: {
    path: "/staff/orders",
    label: "Order",
    parse(value: unknown): SourcePage {
      const result = orders.parse(value);
      return {
        ...result,
        items: result.items
          .filter((item) => item.status !== "CANCELLED" && !item.invoice)
          .map((item) => ({
            id: item.id,
            label: `${item.orderNumber} · ${item.branch.name}`,
          })),
      };
    },
  },
  BOOKING: {
    path: "/staff/bookings",
    label: "Booking",
    parse(value: unknown): SourcePage {
      const result = bookings.parse(value);
      return {
        ...result,
        items: result.items
          .filter(
            (item) =>
              item.status !== "CANCELLED" &&
              item.quotes.some((quote) => quote.status === "ACCEPTED"),
          )
          .map((item) => ({
            id: item.id,
            label: `${item.service.name} · ${item.branch?.name ?? "Unassigned branch"} · ${item.id}`,
          })),
      };
    },
  },
  VEHICLE_TRANSACTION: {
    path: "/staff/vehicle-transactions",
    label: "Vehicle transaction",
    parse(value: unknown): SourcePage {
      const result = transactions.parse(value);
      return {
        ...result,
        items: result.items
          .filter(
            (item) =>
              item.customerId &&
              item.agreedPriceKobo !== null &&
              invoiceableVehicleStatuses.includes(item.status),
          )
          .map((item) => ({
            id: item.id,
            label: `${item.transactionNumber} · ${item.vehicleListing.title}`,
          })),
      };
    },
  },
} satisfies Record<
  InvoiceSourceType,
  { path: string; label: string; parse: (value: unknown) => SourcePage }
>;
