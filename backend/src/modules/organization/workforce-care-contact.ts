import type { Prisma } from "../../generated/prisma/client.js";
import { branchesFor, type WorkforceSnapshot } from "./workforce.policy.js";

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
      user: { select: { email: true, role: true } },
    },
  },
} satisfies Prisma.EnquirySelect & Prisma.ComplaintSelect;
export function projectWorkforceCareContact<T extends object>(row: T) {
  return projectContact(row, true);
}
export function projectWorkforceEnquiryContact<T extends { branchId: string | null }>(
  row: T,
  access: WorkforceSnapshot,
) {
  return projectContact(
    row,
    row.branchId !== null &&
      branchesFor(access, "CUSTOMER_ENQUIRIES").includes(row.branchId),
  );
}
function projectContact<T extends object>(row: T, includeContact: boolean) {
  const { name, email, phone, customerId, customer, ...record } = row as T & {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    customerId?: string | null;
    customer?: {
      firstName: string;
      lastName: string;
      phone: string;
      user: { email: string; role: string };
    } | null;
  };
  // A former customer promoted to staff does not expose new staff profile
  // contact data through a historical case. Retain its recorded contact instead.
  const account = customer?.user.role === "CUSTOMER" ? customer : null;
  return {
    ...record,
    ...(includeContact && (name !== undefined || customer !== undefined)
      ? {
          contact: {
            name: account
              ? `${account.firstName} ${account.lastName}`.trim()
              : (name ?? null),
            email: account?.user.email ?? email ?? null,
            phone: account?.phone ?? phone ?? null,
            customerId: customerId ?? null,
          },
        }
      : {}),
  };
}
