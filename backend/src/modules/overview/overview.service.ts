import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  overviewQuerySchema,
  overviewRange,
  type OverviewQuery,
} from "./overview.schemas.js";

type Scope =
  | { kind: "CUSTOMER"; customerId: string }
  | { kind: "BRANCH"; branchId: string; name: string }
  | { kind: "ORGANISATION" };
const forbidden = () =>
  new AppError({
    code: errorCodes.forbidden,
    statusCode: 403,
    message: "Overview access is unavailable for this account",
  });

async function resolveScope(
  actor: AuthenticatedActor,
  tx: Prisma.TransactionClient,
): Promise<Scope> {
  if (actor.role === "CUSTOMER") {
    const profile = await tx.customerProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!profile) throw forbidden();
    return { kind: "CUSTOMER", customerId: profile.id };
  }
  if (!actor.mfaVerifiedAt) throw forbidden();
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN")
    return { kind: "ORGANISATION" };
  if (actor.role !== "STAFF") throw forbidden();
  const staff = await tx.staffProfile.findUnique({
    where: { userId: actor.userId },
    select: { branch: { select: { id: true, name: true, isActive: true } } },
  });
  if (!staff?.branch?.isActive) throw forbidden();
  return { kind: "BRANCH", branchId: staff.branch.id, name: staff.branch.name };
}

function recordScope(scope: Scope) {
  return scope.kind === "CUSTOMER"
    ? { customerId: scope.customerId }
    : scope.kind === "BRANCH"
      ? { branchId: scope.branchId }
      : {};
}

async function activity(
  tx: Prisma.TransactionClient,
  scope: Scope,
  query: OverviewQuery,
) {
  const range = overviewRange(query);
  const scopeSql =
    scope.kind === "CUSTOMER"
      ? Prisma.sql`AND "customerId" = ${scope.customerId}::uuid`
      : scope.kind === "BRANCH"
        ? Prisma.sql`AND "branchId" = ${scope.branchId}::uuid`
        : Prisma.empty;
  const rows = await tx.$queryRaw<
    Array<{ date: string; bookings: bigint; orders: bigint }>
  >(Prisma.sql`
    SELECT day AS date, SUM(bookings)::bigint AS bookings, SUM(orders)::bigint AS orders FROM (
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS day,
        COUNT(*) AS bookings, 0::bigint AS orders FROM "Booking"
      WHERE "createdAt" >= (${range.gte}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" < (${range.lt}::timestamptz AT TIME ZONE 'UTC') ${scopeSql}
      GROUP BY day
      UNION ALL
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD') AS day,
        0::bigint AS bookings, COUNT(*) AS orders FROM "Order"
      WHERE "createdAt" >= (${range.gte}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" < (${range.lt}::timestamptz AT TIME ZONE 'UTC') ${scopeSql}
      GROUP BY day
    ) AS daily GROUP BY day ORDER BY day
  `);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days = (Date.parse(query.to) - Date.parse(query.from)) / 86_400_000 + 1;
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.parse(query.from) + index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const row = byDate.get(date);
    return {
      date,
      bookings: Number(row?.bookings ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  });
}

async function financialTotals(tx: Prisma.TransactionClient, query: OverviewQuery) {
  const payments = await tx.payment.groupBy({
    by: ["currency"],
    where: {
      status: "SUCCEEDED",
      succeededAt: overviewRange(query),
      settledAttemptId: { not: null },
      settledAttempt: { status: "SUCCESSFUL", verificationStatus: "VERIFIED" },
    },
    _sum: { amountKobo: true },
    _count: { _all: true },
    orderBy: { currency: "asc" },
  });
  const refunds = await tx.refund.groupBy({
    by: ["currency"],
    where: {
      status: "SUCCEEDED",
      processedAt: overviewRange(query),
    },
    _sum: { amountKobo: true },
    _count: { _all: true },
    orderBy: { currency: "asc" },
  });
  const format = (rows: typeof payments) =>
    rows.map((row) => ({
      currency: row.currency,
      amountKobo: (row._sum.amountKobo ?? 0n).toString(),
      count: row._count._all,
    }));
  return { payments: format(payments), refunds: format(refunds) };
}

export class OverviewService {
  constructor(private readonly database: PrismaClient = prisma) {}
  async read(actor: AuthenticatedActor, input: OverviewQuery) {
    const query = overviewQuerySchema.parse(input);
    return this.database.$transaction(
      async (tx) => {
        const scope = await resolveScope(actor, tx);
        const where = { ...recordScope(scope), createdAt: overviewRange(query) };
        const statuses = await tx.booking.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          orderBy: { status: "asc" },
        });
        const orders = await tx.order.count({ where });
        const quotations = await tx.serviceQuote.count({
          where: {
            booking: recordScope(scope),
            issuedAt: overviewRange(query),
            status: { not: "DRAFT" },
          },
        });
        const inspections = await tx.inspectionRequest.count({
          where: {
            createdAt: overviewRange(query),
            ...(scope.kind === "CUSTOMER"
              ? { customerId: scope.customerId }
              : scope.kind === "BRANCH"
                ? { vehicleListing: { branchId: scope.branchId } }
                : {}),
          },
        });
        const vehicles =
          scope.kind === "CUSTOMER"
            ? await tx.customerVehicle.count({
                where: { customerId: scope.customerId, createdAt: overviewRange(query) },
              })
            : await tx.vehicle.count({
                where: {
                  createdAt: overviewRange(query),
                  ...(scope.kind === "BRANCH" ? { branchId: scope.branchId } : {}),
                },
              });
        const daily = await activity(tx, scope, query);
        const bookings = await tx.booking.findMany({
          where,
          take: 5,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            service: { select: { name: true } },
            status: true,
            scheduledAt: true,
            createdAt: true,
          },
        });
        const recentOrders = await tx.order.findMany({
          where,
          take: 4,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalKobo: true,
            currency: true,
            createdAt: true,
          },
        });
        // This branch is the only place overview queries payment/refund tables.
        const finance =
          scope.kind === "ORGANISATION" ? await financialTotals(tx, query) : undefined;
        return {
          scope: scope.kind,
          branch:
            scope.kind === "BRANCH" ? { id: scope.branchId, name: scope.name } : null,
          range: { ...query, timeZone: "Africa/Lagos" as const },
          generatedAt: new Date().toISOString(),
          counts: {
            bookings: statuses.reduce((sum, row) => sum + row._count._all, 0),
            orders,
            quotations,
            inspections,
            vehicles,
          },
          activity: daily,
          bookingStatuses: statuses.map((row) => ({
            status: row.status,
            count: row._count._all,
          })),
          recentBookings: bookings.map(
            ({ service, scheduledAt, createdAt, ...booking }) => ({
              ...booking,
              serviceName: service.name,
              scheduledAt: scheduledAt.toISOString(),
              createdAt: createdAt.toISOString(),
            }),
          ),
          recentOrders: recentOrders.map(({ totalKobo, createdAt, ...order }) => ({
            ...order,
            totalKobo: totalKobo.toString(),
            createdAt: createdAt.toISOString(),
          })),
          ...(finance ? { finance } : {}),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15_000,
      },
    );
  }
}
