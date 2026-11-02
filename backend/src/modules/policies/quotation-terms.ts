import type { Prisma } from "../../generated/prisma/client.js";
import { paymentConflict } from "../payments/payments.errors.js";
import { approvedPolicy, policySnapshot } from "./policies.service.js";

/** The recorded approved quotation term is seven days, never a credit period.
 * Unexpected settings require policy review, rather than a guessed expiry. */
export async function quotationTerms(
  database: Prisma.TransactionClient,
  issuedAt = new Date(),
) {
  const policy = await approvedPolicy(database, "quotation");
  const settings = policy.settings;
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    settings["validityDays"] !== 7 ||
    settings["shorterOverride"] !== false
  )
    throw paymentConflict("The approved seven-day quotation terms need review");
  return {
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 7 * 86_400_000),
    snapshot: policySnapshot(policy),
  };
}
