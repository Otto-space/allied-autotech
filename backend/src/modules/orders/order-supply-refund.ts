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
  let total: bigint;
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
      .parse(choice.supplyException.monetaryBasis);
    const expected = supplyExceptionMoneyBasis(
      order,
      affectedUnitRangesSchema.parse(choice.supplyException.affectedLines),
    );
    if (
      expected.status !== "SAVED_ORDER_ALLOCATION" ||
      !isDeepStrictEqual(expected.amounts, basis.amounts)
    )
      throw Error("Original monetary evidence changed");
    total = BigInt(basis.amounts.totalKobo);
  } catch {
    throw paymentConflict(
      "Reconcile the original monetary allocation and attributable charges before requesting a refund. Do not reprice historical goods or deduct a fee.",
    );
  }
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
