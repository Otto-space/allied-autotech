import { z } from "zod";
import { guestCheckoutBodySchema } from "./orders.schemas.js";

export const purchaseEmptySchema = z.object({}).strict().default({});
export const purchaseTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const purchaseRequestSchema = z.object({ email: z.email().max(254) }).strict();
export const purchaseVerifySchema = z.object({ token: purchaseTokenSchema }).strict();
export const purchaseRevokeSchema = z
  .object({ allSessions: z.boolean().default(false) })
  .strict();
export const purchaseCsrfHeadersSchema = z.looseObject({
  "x-csrf-token": purchaseTokenSchema,
});
export const purchasePaymentSchema = z.object({ orderId: z.uuid() }).strict();
export const purchasePaymentParamsSchema = z.object({ paymentId: z.uuid() }).strict();
export const purchaseAttemptParamsSchema = purchasePaymentParamsSchema
  .extend({ attemptId: z.uuid() })
  .strict();
export const purchaseGatewaySchema = z
  .object({ provider: z.enum(["PAYSTACK", "MONNIFY"]) })
  .strict();
export const purchaseQuoteParamsSchema = z.object({ quoteId: z.uuid() }).strict();
export const purchaseQuoteDecisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
export const purchaseQuoteAcceptSchema = purchaseQuoteDecisionSchema
  .extend({ contact: guestCheckoutBodySchema.shape.contact })
  .strict();
export const purchaseQuoteListSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  })
  .strict();
export const purchaseAftercareRecoverySchema = z
  .object({ operation: z.enum(["cancel", "aftercare"]) })
  .strict();
