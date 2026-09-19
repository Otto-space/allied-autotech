import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.iso.datetime({ offset: true });
const money = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  amountKobo: z.string().regex(/^\d+$/),
  count,
});
const schema = z.object({
  scope: z.enum(["CUSTOMER", "BRANCH", "ORGANISATION"]),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  range: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    timeZone: z.literal("Africa/Lagos"),
  }),
  generatedAt: date,
  counts: z.object({
    bookings: count,
    orders: count,
    quotations: count,
    inspections: count,
    vehicles: count,
  }),
  activity: z
    .array(z.object({ date: z.iso.date(), bookings: count, orders: count }))
    .min(1)
    .max(90),
  bookingStatuses: z.array(z.object({ status: z.string(), count })),
  recentBookings: z
    .array(
      z.object({
        id: z.uuid(),
        serviceName: z.string(),
        scheduledAt: date,
        createdAt: date,
        status: z.string(),
      }),
    )
    .max(5),
  recentOrders: z
    .array(
      z.object({
        id: z.uuid(),
        orderNumber: z.string(),
        createdAt: date,
        status: z.string(),
        totalKobo: z.string().regex(/^\d+$/),
        currency: z.string(),
      }),
    )
    .max(4),
  finance: z.object({ payments: z.array(money), refunds: z.array(money) }).optional(),
});
export const parseOverview = (value: unknown) => schema.parse(value);
export type Overview = z.infer<typeof schema>;

export function overviewDates(days: number, now = new Date()) {
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return {
    from: new Date(Date.parse(to) - (days - 1) * 86_400_000).toISOString().slice(0, 10),
    to,
  };
}
export function validOverviewDates(from: string, to: string) {
  if (!z.iso.date().safeParse(from).success || !z.iso.date().safeParse(to).success)
    return false;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return from >= "2000-01-01" && days >= 1 && days <= 90;
}

export function overviewMoney(value: string, currency: string) {
  const minor = BigInt(value);
  const hundred = BigInt(100);
  return `${currency} ${(minor / hundred).toLocaleString("en-NG")}.${(minor % hundred).toString().padStart(2, "0")}`;
}
