import { z } from "zod";
import {
  allocatedUnitRange,
  assertOrderMoneyMatches,
  readOrderMoneyAllocation,
} from "./order-money-allocation.js";
export const supplyExceptionKind = z.enum([
  "UNAVAILABLE",
  "WRONG_OR_UNSUITABLE_SUPPLY",
  "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE",
]);
export const affectedUnitRangeSchema = z
  .object({
    orderItemId: z.uuid(),
    offset: z.number().int().min(0).max(99999),
    quantity: z.number().int().min(1).max(100000),
  })
  .strict();
export const affectedUnitRangesSchema = z
  .array(affectedUnitRangeSchema)
  .min(1)
  .max(200)
  .superRefine((lines, ctx) => {
    const sorted = [...lines].sort(
      (a, b) => a.orderItemId.localeCompare(b.orderItemId) || a.offset - b.offset,
    );
    if (
      sorted.some(
        (line, index) =>
          index > 0 &&
          sorted[index - 1]!.orderItemId === line.orderItemId &&
          sorted[index - 1]!.offset + sorted[index - 1]!.quantity > line.offset,
      )
    )
      ctx.addIssue({ code: "custom", message: "Choose disjoint actual unit ranges" });
  });
export type AffectedUnitRange = z.infer<typeof affectedUnitRangeSchema>;
export function assertSupplyExceptionRanges(
  original: readonly { id: string; quantity: number }[],
  ranges: readonly AffectedUnitRange[],
) {
  affectedUnitRangesSchema.parse(ranges);
  if (
    ranges.some((range) => {
      const line = original.find((item) => item.id === range.orderItemId);
      return !line || range.offset + range.quantity > line.quantity;
    })
  )
    throw Error(
      "Affected goods must belong to the actual order within its saved quantities",
    );
}
export function assertNoSupplyOverlap(
  incoming: readonly AffectedUnitRange[],
  existing: readonly AffectedUnitRange[],
) {
  if (
    incoming.some((a) =>
      existing.some(
        (b) =>
          a.orderItemId === b.orderItemId &&
          a.offset < b.offset + b.quantity &&
          b.offset < a.offset + a.quantity,
      ),
    )
  )
    throw Error("These units already have an unresolved supply review");
}
/** Subtract intervals, never loop through quantities or infer that a paid item was handed over. */
export function uncoveredSupplyRanges(
  line: { id: string; quantity: number },
  collected: number,
  covered: readonly AffectedUnitRange[],
): AffectedUnitRange[] {
  if (!Number.isInteger(collected) || collected < 0 || collected > line.quantity)
    throw Error("Invalid physical handover total");
  let intervals = [{ from: collected, to: line.quantity }];
  for (const range of covered.filter((value) => value.orderItemId === line.id)) {
    if (
      range.offset < 0 ||
      range.quantity < 1 ||
      range.offset + range.quantity > line.quantity
    )
      throw Error("Invalid existing supply range");
    intervals = intervals.flatMap((part) =>
      range.offset >= part.to || range.offset + range.quantity <= part.from
        ? [part]
        : [
            { from: part.from, to: Math.max(part.from, range.offset) },
            { from: Math.min(part.to, range.offset + range.quantity), to: part.to },
          ].filter((part) => part.to > part.from),
    );
  }
  return intervals
    .filter((part) => part.to > part.from)
    .map((part) => ({
      orderItemId: line.id,
      offset: part.from,
      quantity: part.to - part.from,
    }));
}
export function supplyExceptionMoneyBasis(
  order: {
    policySnapshot: unknown;
    subtotalKobo: bigint;
    discountAmountKobo: bigint;
    taxKobo: bigint;
    totalKobo: bigint;
    deliveryFeeKobo: bigint;
    items: readonly {
      id: string;
      quantity: number;
      unitPriceKobo: bigint;
      subtotalKobo: bigint;
    }[];
  },
  ranges: readonly AffectedUnitRange[],
) {
  assertSupplyExceptionRanges(order.items, ranges);
  const allocation = readOrderMoneyAllocation(order.policySnapshot);
  if (!allocation)
    return {
      status: "HISTORICAL_BREAKDOWN_REVIEW_REQUIRED" as const,
      amounts: null,
      feeKobo: "0",
    };
  assertOrderMoneyMatches(allocation, order);
  const totals = { subtotalKobo: 0n, discountKobo: 0n, taxKobo: 0n, totalKobo: 0n };
  const lines = ranges.map((range) => {
    const amount = allocatedUnitRange(
      allocation.lines.find((line) => line.orderItemId === range.orderItemId)!,
      range.offset,
      range.quantity,
    );
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] += amount[key];
    return {
      ...range,
      ...Object.fromEntries(
        Object.entries(amount).map(([key, value]) => [key, String(value)]),
      ),
    };
  });
  return {
    status:
      order.deliveryFeeKobo === 0n
        ? ("SAVED_ORDER_ALLOCATION" as const)
        : ("ATTRIBUTABLE_CHARGES_REVIEW_REQUIRED" as const),
    amounts: {
      currency: "NGN",
      ...Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [key, String(value)]),
      ),
      lines,
    },
    feeKobo: "0",
  };
}
