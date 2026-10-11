import { z } from "zod";
import { paymentSchema } from "./payment-schemas";

// The repository supplies createdAt. Older projections can still show their
// reference/status while explicitly acknowledging a missing creation date.
export const customerPaymentListRecord = paymentSchema.extend({
  createdAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
const customerPaymentsPage = z.object({
  items: z.array(customerPaymentListRecord),
  nextCursor: z.uuid().optional(),
});
export const parseCustomerPayments = (value: unknown) =>
  customerPaymentsPage.parse(value);
