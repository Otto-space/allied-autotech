import { hasAcceptedSupplyAlternative } from "./order-supply-alternative.js";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { paymentConflict } from "../payments/payments.errors.js";
import {
  affectedUnitRangesSchema,
  supplyExceptionMoneyBasis,
} from "./order-supply-exception.engine.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";

/** Reuse an actual buyer cancellation, never an operator's assertion of one.
 * SQL checks the immutable account/verified-guest audit and saved zero-fee rule.
 * This is evidence for a REQUEST only; normal approval and settlement still apply. */
export async function preconfirmationSupplyCancellationBasis(
  tx: Prisma.TransactionClient,
  orderId: string | null,
) {
  if (!orderId || !(await tx.orderSupplyException.count({ where: { orderId } }))) return;
  const [row] = await tx.$queryRaw<{ basis: unknown }[]>`
    SELECT aat_preconfirmation_supply_cancellation_basis(${orderId}::uuid) AS basis`;
  if (row?.basis === null) return;
  return z
    .object({
      version: z.literal("PRECONFIRMATION_SUPPLY_CANCELLATION_V1"),
      orderId: z.uuid(),
      cancellationAuditId: z.uuid(),
      purchaseAccess: z.enum(["ACCOUNT", "EMAIL_VERIFIED_GUEST"]),
      cancellationPolicy: z
        .object({
          id: z.uuid(),
          key: z.literal("cancellation"),
          version: z.number().int().positive(),
          approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
          source: z.string(),
          effectiveAt: z.string(),
          settings: z.record(z.string(), z.json()),
        })
        .strict(),
    })
    .strict()
    .parse(row?.basis);
}

/** Called inside the existing refund transaction, before locking the attempt.
 * This binds a request; existing finance approval, dispatch and verification remain authoritative. */
export async function assertSupplyRefundBinding(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string | null;
    choiceId?: string | undefined;
    amountKobo: bigint;
  },
) {
  if (!input.orderId) {
    if (input.choiceId)
      throw paymentConflict(
        "A supply remedy must use its actual original order payment.",
      );
    return;
  }
  const order = await lockSupplyOrder(tx, input.orderId);
  if (!input.choiceId) {
    if (await tx.orderSupplyException.count({ where: { orderId: order.id } }))
      throw paymentConflict(
        "Bind the affected supply remedy before requesting a new refund.",
      );
    return;
  }
  const choice = await tx.orderSupplyRemedyChoice.findUnique({
    where: { id: input.choiceId },
    include: { supplyException: true },
  });
  if (
    !choice ||
    choice.orderId !== order.id ||
    (choice.choice !== "REFUND_REVIEW" &&
      !(
        choice.choice === "SUITABLE_ALTERNATIVE_REVIEW" &&
        (await hasAcceptedSupplyAlternative(tx, choice.id))
      )) ||
    choice.supplyException.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" ||
    (await tx.orderSupplyRemedyChoice.count({
      where: {
        supplyExceptionId: choice.supplyExceptionId,
        orderVersion: { gt: choice.orderVersion },
      },
    }))
  )
    throw paymentConflict(
      "Review the actual current customer refund request before requesting money.",
    );
  const total = savedSupplyRefundAmount(order, choice.supplyException);
  if (
    await tx.refund.count({
      where: {
        paymentAttempt: { payment: { orderId: order.id } },
        supplyRemedyChoiceId: null,
        status: { notIn: ["FAILED", "CANCELLED"] },
      },
    })
  )
    throw paymentConflict(
      "Reconcile earlier unbound refunds before requesting the affected original portion.",
    );
  const committed =
    (
      await tx.refund.aggregate({
        where: {
          supplyRemedyChoice: { supplyExceptionId: choice.supplyExceptionId },
          status: { notIn: ["FAILED", "CANCELLED"] },
        },
        _sum: { amountKobo: true },
      })
    )._sum.amountKobo ?? 0n;
  if (input.amountKobo <= 0n || committed + input.amountKobo > total)
    throw paymentConflict(
      "The refund exceeds the remaining affected original portion, including its saved tax. No handling deduction is authorised.",
    );
}

/** Reuse the same immutable original allocation for request and settlement review. */
export function savedSupplyRefundAmount(
  order: Awaited<ReturnType<typeof lockSupplyOrder>>,
  concern: { monetaryBasis: unknown; affectedLines: unknown },
) {
  try {
    const basis = z
      .object({
        status: z.literal("SAVED_ORDER_ALLOCATION"),
        feeKobo: z.literal("0"),
        financialApproval: z.literal(false),
        reviewOnly: z.literal(true),
        provenance: z.literal("ENGINEERING_UNDER_OWNER_D17_DELEGATION"),
        amounts: z
          .object({
            currency: z.literal("NGN"),
            totalKobo: z.string().regex(/^[1-9][0-9]*$/),
          })
          .passthrough(),
      })
      .parse(concern.monetaryBasis);
    const expected = supplyExceptionMoneyBasis(
      order,
      affectedUnitRangesSchema.parse(concern.affectedLines),
    );
    if (
      expected.status !== "SAVED_ORDER_ALLOCATION" ||
      !isDeepStrictEqual(expected.amounts, basis.amounts)
    )
      throw Error("Original monetary evidence changed");
    return BigInt(basis.amounts.totalKobo);
  } catch {
    throw paymentConflict(
      "Reconcile the original monetary allocation and attributable charges before requesting a refund. Do not reprice historical goods or deduct a fee.",
    );
  }
}
