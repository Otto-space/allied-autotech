import { z } from "zod";

export const overviewQuerySchema = z
  .strictObject({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .superRefine((value, context) => {
    const days = (Date.parse(value.to) - Date.parse(value.from)) / 86_400_000 + 1;
    if (value.from < "2000-01-01" || days < 1 || days > 90)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Choose 1 to 90 calendar days, from 2000 onward",
      });
  });
export type OverviewQuery = z.infer<typeof overviewQuerySchema>;

export function overviewRange(query: OverviewQuery) {
  const start = new Date(`${query.from}T00:00:00+01:00`);
  const end = new Date(Date.parse(`${query.to}T00:00:00+01:00`) + 86_400_000);
  return { gte: start, lt: end };
}

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const money = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amountKobo: z.string().regex(/^\d+$/),
  count,
});
export const overviewResponseSchema = z.object({
  scope: z.enum(["CUSTOMER", "BRANCH", "ORGANISATION"]),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  range: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    timeZone: z.literal("Africa/Lagos"),
  }),
  generatedAt: z.iso.datetime(),
  counts: z.object({
    bookings: count,
    orders: count,
    quotations: count,
    inspections: count,
    vehicles: count,
  }),
  activity: z
    .array(z.object({ date: z.iso.date(), bookings: count, orders: count }))
    .max(90),
  bookingStatuses: z.array(z.object({ status: z.string(), count })),
  recentBookings: z
    .array(
      z.object({
        id: z.uuid(),
        serviceName: z.string(),
        scheduledAt: z.iso.datetime(),
        createdAt: z.iso.datetime(),
        status: z.string(),
      }),
    )
    .max(5),
  recentOrders: z
    .array(
      z.object({
        id: z.uuid(),
        orderNumber: z.string(),
        createdAt: z.iso.datetime(),
        status: z.string(),
        totalKobo: z.string().regex(/^\d+$/),
        currency: z.string(),
      }),
    )
    .max(4),
  finance: z.object({ payments: z.array(money), refunds: z.array(money) }).optional(),
});
