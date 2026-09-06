import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  PromotionCreateInput,
  PromotionListQuery,
  PromotionUpdateInput,
} from "./promotions.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export const promotionSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  discountType: true,
  percentageBasisPoints: true,
  fixedAmountKobo: true,
  minimumOrderAmountKobo: true,
  maximumDiscountAmountKobo: true,
  usageLimit: true,
  perCustomerLimit: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PromotionSelect;

const money = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : BigInt(value);

export class PromotionsRepository {
  constructor(private readonly database: PrismaClient = prisma) {}
  list(query: PromotionListQuery, client: DatabaseClient = this.database) {
    return client.promotion.findMany({
      where: query.isActive === undefined ? {} : { isActive: query.isActive },
      select: promotionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  get(id: string, client: DatabaseClient = this.database) {
    return client.promotion.findUnique({ where: { id }, select: promotionSelect });
  }
  async lockByCode(code: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Promotion" WHERE "code" = ${code}::citext FOR UPDATE`;
    return rows[0] === undefined ? null : this.get(rows[0].id, client);
  }
  async lockById(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Promotion" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows[0] === undefined ? null : this.get(id, client);
  }
  create(input: PromotionCreateInput, client: DatabaseClient) {
    return client.promotion.create({
      data: {
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        discountType: input.discountType,
        percentageBasisPoints: input.percentageBasisPoints ?? null,
        fixedAmountKobo: money(input.fixedAmountKobo) ?? null,
        minimumOrderAmountKobo: money(input.minimumOrderAmountKobo) ?? null,
        maximumDiscountAmountKobo: money(input.maximumDiscountAmountKobo) ?? null,
        usageLimit: input.usageLimit ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        isActive: input.isActive,
      },
      select: promotionSelect,
    });
  }
  update(id: string, input: PromotionUpdateInput, client: DatabaseClient) {
    return client.promotion.updateMany({
      where: { id, version: input.expectedVersion },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.code === undefined ? {} : { code: input.code }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.discountType === undefined ? {} : { discountType: input.discountType }),
        ...(input.percentageBasisPoints === undefined
          ? {}
          : { percentageBasisPoints: input.percentageBasisPoints }),
        ...(input.fixedAmountKobo === undefined
          ? {}
          : {
              fixedAmountKobo:
                input.fixedAmountKobo === null ? null : BigInt(input.fixedAmountKobo),
            }),
        ...(input.minimumOrderAmountKobo === undefined
          ? {}
          : {
              minimumOrderAmountKobo:
                input.minimumOrderAmountKobo === null
                  ? null
                  : BigInt(input.minimumOrderAmountKobo),
            }),
        ...(input.maximumDiscountAmountKobo === undefined
          ? {}
          : {
              maximumDiscountAmountKobo:
                input.maximumDiscountAmountKobo === null
                  ? null
                  : BigInt(input.maximumDiscountAmountKobo),
            }),
        ...(input.usageLimit === undefined ? {} : { usageLimit: input.usageLimit }),
        ...(input.perCustomerLimit === undefined
          ? {}
          : { perCustomerLimit: input.perCustomerLimit }),
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }),
        ...(input.endsAt === undefined ? {} : { endsAt: new Date(input.endsAt) }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        version: { increment: 1 },
      },
    });
  }
  usageCounts(promotionId: string, customerId: string, client: DatabaseClient) {
    return Promise.all([
      client.promotionUsage.count({
        where: { promotionId, order: { status: { not: "CANCELLED" } } },
      }),
      client.promotionUsage.count({
        where: { promotionId, order: { customerId, status: { not: "CANCELLED" } } },
      }),
    ]);
  }
  createUsage(
    evaluation: {
      promotion: {
        id: string;
        code: string | null;
        discountType: "PERCENTAGE" | "FIXED_AMOUNT";
        percentageBasisPoints: number | null;
        fixedAmountKobo: bigint | null;
      };
      discountAmountKobo: bigint;
    },
    orderId: string,
    client: DatabaseClient,
  ) {
    return client.promotionUsage.create({
      data: {
        promotionId: evaluation.promotion.id,
        orderId,
        promotionCodeSnapshot: evaluation.promotion.code,
        discountTypeSnapshot: evaluation.promotion.discountType,
        percentageBasisPointsSnapshot: evaluation.promotion.percentageBasisPoints,
        fixedAmountKoboSnapshot: evaluation.promotion.fixedAmountKobo,
        discountAmountKobo: evaluation.discountAmountKobo,
      },
    });
  }
}
