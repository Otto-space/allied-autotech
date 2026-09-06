import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  promotionIneligible,
  promotionNotFound,
  promotionStale,
} from "./promotions.errors.js";
import {
  assertPromotionAdministrator,
  assertPromotionCustomer,
} from "./promotions.policy.js";
import { PromotionsRepository } from "./promotions.repository.js";
import type {
  PromotionCreateInput,
  PromotionListQuery,
  PromotionPreviewInput,
  PromotionUpdateInput,
} from "./promotions.schemas.js";
import type { PromotionEvaluation } from "./promotions.types.js";

const safe = (value: unknown): unknown =>
  typeof value === "bigint"
    ? value.toString()
    : value instanceof Date
      ? value
      : Array.isArray(value)
        ? value.map(safe)
        : value !== null && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, child]) => [key, safe(child)]),
            )
          : value;
const paginate = <T extends { id: string }>(rows: T[], limit: number) => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(rows.length > limit && last !== undefined ? { nextCursor: last.id } : {}),
  };
};

export class PromotionsService {
  readonly repository: PromotionsRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new PromotionsRepository(database);
  }

  async lockAndEvaluate(
    customerId: string,
    code: string,
    subtotalKobo: bigint,
    transaction: Prisma.TransactionClient,
  ): Promise<PromotionEvaluation> {
    const promotion = await this.repository.lockByCode(code, transaction);
    const now = new Date();
    if (
      promotion === null ||
      !promotion.isActive ||
      promotion.startsAt > now ||
      promotion.endsAt <= now ||
      subtotalKobo <= 0n ||
      (promotion.minimumOrderAmountKobo !== null &&
        subtotalKobo < promotion.minimumOrderAmountKobo)
    )
      throw promotionIneligible();
    const [globalUses, customerUses] = await this.repository.usageCounts(
      promotion.id,
      customerId,
      transaction,
    );
    if (
      (promotion.usageLimit !== null && globalUses >= promotion.usageLimit) ||
      (promotion.perCustomerLimit !== null && customerUses >= promotion.perCustomerLimit)
    )
      throw promotionIneligible();
    let discountAmountKobo =
      promotion.discountType === "PERCENTAGE"
        ? (subtotalKobo * BigInt(promotion.percentageBasisPoints!)) / 10_000n
        : promotion.fixedAmountKobo!;
    if (
      promotion.maximumDiscountAmountKobo !== null &&
      discountAmountKobo > promotion.maximumDiscountAmountKobo
    )
      discountAmountKobo = promotion.maximumDiscountAmountKobo;
    if (discountAmountKobo > subtotalKobo) discountAmountKobo = subtotalKobo;
    if (discountAmountKobo <= 0n) throw promotionIneligible();
    return {
      promotion: {
        id: promotion.id,
        code: promotion.code,
        discountType: promotion.discountType,
        percentageBasisPoints: promotion.percentageBasisPoints,
        fixedAmountKobo: promotion.fixedAmountKobo,
      },
      discountAmountKobo,
    };
  }

  async preview(actor: AuthenticatedActor, input: PromotionPreviewInput) {
    assertPromotionCustomer(actor);
    const profile = await this.database.customerProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (profile === null) throw promotionNotFound();
    const evaluation = await this.database.$transaction((transaction) =>
      this.lockAndEvaluate(
        profile.id,
        input.code,
        BigInt(input.subtotalKobo),
        transaction,
      ),
    );
    return safe({
      code: evaluation.promotion.code,
      discountAmountKobo: evaluation.discountAmountKobo,
    });
  }
  async list(actor: AuthenticatedActor, query: PromotionListQuery) {
    assertPromotionAdministrator(actor);
    return safe(paginate(await this.repository.list(query), query.limit));
  }
  async get(actor: AuthenticatedActor, id: string) {
    assertPromotionAdministrator(actor);
    const item = await this.repository.get(id);
    if (item === null) throw promotionNotFound();
    return safe(item);
  }
  async create(
    actor: AuthenticatedActor,
    input: PromotionCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPromotionAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const item = await this.repository.create(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "PROMOTION",
        entityId: item.id,
        newValues: {
          code: item.code,
          discountType: item.discountType,
          active: item.isActive,
        },
        context,
      });
      return safe(item);
    });
  }
  async update(
    actor: AuthenticatedActor,
    id: string,
    input: PromotionUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertPromotionAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const existing = await this.repository.lockById(id, transaction);
      if (existing === null) throw promotionNotFound();
      const effectiveType = input.discountType ?? existing.discountType;
      const effectivePercentage =
        input.percentageBasisPoints === undefined
          ? existing.percentageBasisPoints
          : input.percentageBasisPoints;
      const effectiveFixed =
        input.fixedAmountKobo === undefined
          ? existing.fixedAmountKobo
          : input.fixedAmountKobo === null
            ? null
            : BigInt(input.fixedAmountKobo);
      const startsAt =
        input.startsAt === undefined ? existing.startsAt : new Date(input.startsAt);
      const endsAt =
        input.endsAt === undefined ? existing.endsAt : new Date(input.endsAt);
      const usageLimit =
        input.usageLimit === undefined ? existing.usageLimit : input.usageLimit;
      const customerLimit =
        input.perCustomerLimit === undefined
          ? existing.perCustomerLimit
          : input.perCustomerLimit;
      if (
        startsAt >= endsAt ||
        (effectiveType === "PERCENTAGE"
          ? effectivePercentage === null || effectiveFixed !== null
          : effectiveFixed === null || effectivePercentage !== null) ||
        (usageLimit !== null && customerLimit !== null && customerLimit > usageLimit)
      )
        throw promotionIneligible();
      const result = await this.repository.update(id, input, transaction);
      if (result.count !== 1) throw promotionStale();
      const updated = await this.repository.get(id, transaction);
      if (updated === null) throw promotionNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "PROMOTION",
        entityId: id,
        oldValues: { version: existing.version, active: existing.isActive },
        newValues: { version: updated.version, active: updated.isActive },
        context,
      });
      return safe(updated);
    });
  }
}

export const promotionsService = new PromotionsService();
