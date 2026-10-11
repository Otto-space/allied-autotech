import { z } from "zod";
import { branchRef, orderSchema } from "./commerce-schemas";

// Historical orders may have no assigned branch. Preserve the owned record
// instead of rejecting the whole page because that optional relation is absent.
export const customerOrderListRecord = orderSchema.extend({
  branch: branchRef.nullable(),
});
const customerOrdersPage = z.object({
  items: z.array(customerOrderListRecord),
  nextCursor: z.uuid().optional(),
});
export const parseCustomerOrders = (value: unknown) => customerOrdersPage.parse(value);
