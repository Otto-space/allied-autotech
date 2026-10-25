import type { Prisma } from "../../generated/prisma/client.js";

// Only Customer Care responsibility readers request this projection. Sales-only
// enquiry readers retain their existing field boundary, even on a shared branch.
export const workforceCareContactSelect = {
  name: true,
  email: true,
  phone: true,
  customerId: true,
  customer: {
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      user: { select: { email: true } },
    },
  },
} satisfies Prisma.EnquirySelect & Prisma.ComplaintSelect;
export function projectWorkforceCareContact<T extends object>(row: T) {
  const { name, email, phone, customerId, customer, ...record } = row as T & {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    customerId?: string | null;
    customer?: {
      firstName: string;
      lastName: string;
      phone: string;
      user: { email: string };
    } | null;
  };
  return {
    ...record,
    ...(name !== undefined || customer !== undefined
      ? {
          contact: {
            name: customer
              ? `${customer.firstName} ${customer.lastName}`.trim()
              : (name ?? null),
            email: customer?.user.email ?? email ?? null,
            phone: customer?.phone ?? phone ?? null,
            customerId: customerId ?? null,
          },
        }
      : {}),
  };
}
