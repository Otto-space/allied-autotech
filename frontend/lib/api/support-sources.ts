import { z } from "zod";
export const supportSourceTypes = [
  "PRODUCT",
  "SERVICE",
  "VEHICLE",
  "BOOKING",
  "QUOTATION",
  "ORDER",
  "VEHICLE_TRANSACTION",
] as const;
export type SupportSourceType = (typeof supportSourceTypes)[number];
export type SupportSource = {
  id: string;
  label: string;
  fields: Record<string, string>;
  inheritsBranch: boolean;
};
const entity = z.object({ id: z.uuid() });
const named = entity.extend({ name: z.string() });
const booking = entity.extend({
  service: named,
  scheduledAt: z.string().nullable(),
  branch: entity.nullable(),
  quotes: z.array(entity.extend({ quoteNumber: z.string(), status: z.string() })),
});
const page = <T extends z.ZodType>(schema: T, value: unknown) =>
  z.object({ items: z.array(schema), nextCursor: z.uuid().optional() }).parse(value);
export const supportSourcePaths = {
  PRODUCT: "/public/catalog/products",
  SERVICE: "/public/services",
  VEHICLE: "/public/vehicles",
  BOOKING: "/customers/bookings",
  QUOTATION: "/customers/bookings",
  ORDER: "/customers/orders",
  VEHICLE_TRANSACTION: "/customers/vehicle-transactions",
} as const;
export function parseSupportSources(
  type: SupportSourceType,
  value: unknown,
): { items: SupportSource[]; nextCursor?: string } {
  if (type === "BOOKING" || type === "QUOTATION") {
    const result = page(booking, value);
    return {
      ...result,
      items: result.items.flatMap<SupportSource>((row) =>
        type === "BOOKING"
          ? [
              {
                id: row.id,
                label: `${row.service.name} · ${row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" }) : "Unscheduled"}`,
                fields: { bookingId: row.id },
                inheritsBranch: !!row.branch,
              },
            ]
          : row.quotes.map((quote) => ({
              id: quote.id,
              label: `${quote.quoteNumber} · ${row.service.name} · ${quote.status.toLowerCase()}`,
              fields: { quoteId: quote.id },
              inheritsBranch: !!row.branch,
            })),
      ),
    };
  }
  if (type === "ORDER") {
    const result = page(entity.extend({ orderNumber: z.string() }), value);
    return {
      ...result,
      items: result.items.map((row) => ({
        id: row.id,
        label: row.orderNumber,
        fields: { orderId: row.id },
        inheritsBranch: true,
      })),
    };
  }
  if (type === "VEHICLE_TRANSACTION") {
    const result = page(
      entity.extend({
        transactionNumber: z.string(),
        vehicleListing: z.object({ title: z.string() }),
      }),
      value,
    );
    return {
      ...result,
      items: result.items.map((row) => ({
        id: row.id,
        label: `${row.transactionNumber} · ${row.vehicleListing.title}`,
        fields: { vehicleTransactionId: row.id },
        inheritsBranch: true,
      })),
    };
  }
  if (type === "VEHICLE") {
    const result = page(entity.extend({ title: z.string() }), value);
    return {
      ...result,
      items: result.items.map((row) => ({
        id: row.id,
        label: row.title,
        fields: { vehicleListingId: row.id },
        inheritsBranch: true,
      })),
    };
  }
  const result = page(named, value);
  return {
    ...result,
    items: result.items.map<SupportSource>((row) => ({
      id: row.id,
      label: row.name,
      fields: { [type === "PRODUCT" ? "productId" : "serviceId"]: row.id },
      inheritsBranch: false,
    })),
  };
}
