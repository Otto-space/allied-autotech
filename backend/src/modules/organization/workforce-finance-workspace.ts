import type { Prisma } from "../../generated/prisma/client.js";
import { workforceNotFound } from "./workforce.policy.js";

const branch = { select: { id: true, name: true } } as const;
export const workforceFinanceSelect = {
  id: true,
  paymentNumber: true,
  amountKobo: true,
  currency: true,
  status: true,
  purpose: true,
  createdAt: true,
  succeededAt: true,
  order: { select: { orderNumber: true, branch } },
  booking: { select: { service: { select: { name: true } }, branch } },
  invoice: {
    select: {
      invoiceNumber: true,
      order: { select: { branch } },
      booking: { select: { branch } },
    },
  },
} satisfies Prisma.PaymentSelect;
export const workforceFinanceDetailSelect = {
  ...workforceFinanceSelect,
  updatedAt: true,
  expiresAt: true,
  cancelledAt: true,
  expiredAt: true,
} satisfies Prisma.PaymentSelect;

export function financeScope(branchIds: string[]): Prisma.PaymentWhereInput {
  return {
    OR: [
      { order: { branchId: { in: branchIds } } },
      { booking: { branchId: { in: branchIds } } },
      {
        invoice: {
          OR: [
            { order: { branchId: { in: branchIds } } },
            { booking: { branchId: { in: branchIds } } },
          ],
        },
      },
    ],
  };
}
export function financeSearchFilters(
  branchIds: string[],
  q?: string,
): Prisma.PaymentWhereInput[] {
  return (q?.split(/\s+/).filter(Boolean) ?? []).map((term) => {
    const text = {
      contains: term.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return {
      OR: [
        { paymentNumber: text },
        { order: { orderNumber: text, branchId: { in: branchIds } } },
        {
          invoice: {
            invoiceNumber: text,
            OR: [
              { order: { branchId: { in: branchIds } } },
              { booking: { branchId: { in: branchIds } } },
            ],
          },
        },
      ],
    };
  });
}

type FinanceRecord = Prisma.PaymentGetPayload<{ select: typeof workforceFinanceSelect }>;
export function projectWorkforcePayment<T extends FinanceRecord>(
  row: T,
  branchIds: string[],
) {
  const { order, booking, invoice, ...record } = row;
  const sources: {
    kind: "ORDER" | "BOOKING" | "INVOICE";
    reference: string;
    branch: { id: string; name: string };
  }[] = [];
  const add = (
    kind: "ORDER" | "BOOKING" | "INVOICE",
    reference: string,
    sourceBranch: { id: string; name: string } | null | undefined,
  ) => {
    if (
      sourceBranch &&
      branchIds.includes(sourceBranch.id) &&
      !sources.some(
        (s) =>
          s.kind === kind && s.reference === reference && s.branch.id === sourceBranch.id,
      )
    )
      sources.push({ kind, reference, branch: sourceBranch });
  };
  if (order) add("ORDER", order.orderNumber, order.branch);
  if (booking) add("BOOKING", booking.service.name, booking.branch);
  if (invoice) {
    add("INVOICE", invoice.invoiceNumber, invoice.order?.branch);
    add("INVOICE", invoice.invoiceNumber, invoice.booking?.branch);
  }
  // A source moved out of scope between reads must never expose financial facts.
  if (!sources.length) workforceNotFound();
  return { ...record, amountKobo: record.amountKobo.toString(), sources };
}
