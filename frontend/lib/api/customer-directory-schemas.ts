import { z } from "zod";
import type { components } from "./generated";

const row = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  createdAt: z.string().datetime(),
});
const page = z.object({ items: z.array(row), nextCursor: z.string().optional() });
const detail = row.extend({
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string(),
});
const related = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      status: z.string().nullable(),
      createdAt: z.string().datetime(),
      amountKobo: z.string().nullable(),
      currency: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().optional(),
});
export const parseCustomerDirectory = (
  value: unknown,
): components["schemas"]["CustomerDirectoryPage"] => page.parse(value);
export const parseCustomerDetail = (
  value: unknown,
): components["schemas"]["CustomerDirectoryDetail"] => detail.parse(value);
export const parseCustomerRelated = (
  value: unknown,
): components["schemas"]["CustomerRelatedPage"] => related.parse(value);
