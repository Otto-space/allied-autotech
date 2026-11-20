import {
  readSupplyAlternativeTerms,
  supplyAlternativeAgreementVersion,
} from "./order-supply-alternative-terms.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";

/** Reuse the actual Care quotation. An alternative request is not acceptance or
 * a transfer of captured money. Lock original order before Enquiry/PartsQuote. */
export async function supplyAlternativeChoice(
  tx: Prisma.TransactionClient,
  enquiryId: string,
  expectedChoiceId?: string | null,
) {
  const concern = await tx.orderSupplyException.findUnique({
    where: { enquiryId },
    select: { id: true, orderId: true, kind: true },
  });
  if (!concern) {
    if (expectedChoiceId)
      throw orderConflict("This alternative must use its actual original Care case.");
    return null;
  }
  await lockSupplyOrder(tx, concern.orderId);
  const choice = await tx.orderSupplyRemedyChoice.findFirst({
    where: { supplyExceptionId: concern.id },
    orderBy: { orderVersion: "desc" },
    select: { id: true, orderId: true, choice: true },
  });
  if (
    concern.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" ||
    !choice ||
    choice.choice !== "SUITABLE_ALTERNATIVE_REVIEW" ||
    (expectedChoiceId !== undefined && expectedChoiceId !== choice.id)
  )
    throw orderConflict(
      "An alternative quotation needs the actual current customer alternative request. Technical assessment cannot be bypassed.",
    );
  return choice;
}

export async function hasAcceptedSupplyAlternative(
  tx: Prisma.TransactionClient,
  choiceId: string,
  includeCancelledHistory = false,
) {
  const quotes = await tx.partsQuote.findMany({
    where: {
      supplyRemedyChoiceId: choiceId,
      status: "ACCEPTED",
      orderId: { not: null },
      ...(includeCancelledHistory ? {} : { order: { status: { not: "CANCELLED" } } }),
    },
    take: includeCancelledHistory ? 101 : 2,
    select: {
      policySnapshot: true,
      supplyRemedyChoice: { select: { orderId: true } },
      order: { select: { policySnapshot: true } },
    },
  });
  if (
    includeCancelledHistory ? !quotes.length || quotes.length > 100 : quotes.length !== 1
  )
    return false;
  return quotes.some((quote) => {
    const terms = readSupplyAlternativeTerms(quote.policySnapshot);
    const policy = quote.order?.policySnapshot;
    const linked =
      policy && typeof policy === "object" && !Array.isArray(policy)
        ? policy["partsQuote"]
        : null;
    const ack =
      linked && typeof linked === "object" && !Array.isArray(linked)
        ? linked["alternativeAcceptance"]
        : null;
    return (
      !!terms &&
      terms.choiceId === choiceId &&
      terms.originalOrderId === quote.supplyRemedyChoice?.orderId &&
      !!ack &&
      typeof ack === "object" &&
      !Array.isArray(ack) &&
      ack["version"] === supplyAlternativeAgreementVersion &&
      ack["choiceId"] === choiceId
    );
  });
}

/** Explicit acceptance must acknowledge the immutable offered commercial handling,
 * not merely an earlier preference to ask for an alternative. */
export async function assertSupplyAlternativeAcceptance(
  tx: Prisma.TransactionClient,
  quote: {
    enquiryId: string;
    supplyRemedyChoiceId: string | null;
    policySnapshot: unknown;
  },
  agreementVersion?: string,
) {
  const choice = await supplyAlternativeChoice(
    tx,
    quote.enquiryId,
    quote.supplyRemedyChoiceId,
  );
  if (!choice) {
    if (agreementVersion !== undefined)
      throw orderConflict("This quotation is not an affected-goods alternative.");
    return;
  }
  const terms = readSupplyAlternativeTerms(quote.policySnapshot);
  if (
    agreementVersion !== supplyAlternativeAgreementVersion ||
    !terms ||
    terms.choiceId !== choice.id ||
    terms.originalOrderId !== choice.orderId
  )
    throw orderConflict(
      "Review the actual alternative terms and explicitly acknowledge separate original refund and new-order payment before accepting.",
    );
}
