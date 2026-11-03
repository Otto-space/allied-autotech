import { z } from "zod";

const kobo = z.string().regex(/^(0|[1-9]\d{0,17})$/);
const lineSchema = z.strictObject({
  orderItemId: z.uuid(),
  quantity: z.number().int().min(1).max(100000),
  subtotalKobo: kobo,
  discountKobo: kobo,
  taxKobo: kobo,
  totalKobo: kobo,
});
const allocationSchema = z.strictObject({
  version: z.literal(1),
  rule: z.literal("ORDER_HALF_UP_LARGEST_REMAINDER"),
  currency: z.literal("NGN"),
  subtotalKobo: kobo,
  discountKobo: kobo,
  taxKobo: kobo,
  totalKobo: kobo,
  lines: z.array(lineSchema).min(1).max(200),
});
export type OrderMoneyAllocation = z.infer<typeof allocationSchema>;
export type AllocatedOrderLine = OrderMoneyAllocation["lines"][number];

/** Integer largest remainder. Equal fractions retain the saved input order. */
export function allocateKobo(total: bigint, weights: readonly bigint[]): bigint[] {
  if (total < 0n || weights.some((weight) => weight < 0n))
    throw new Error("Invalid allocation amounts");
  const denominator = weights.reduce((sum, weight) => sum + weight, 0n);
  if (denominator === 0n) {
    if (total !== 0n) throw new Error("An allocation needs a nonzero basis");
    return weights.map(() => 0n);
  }
  const shares = weights.map((weight) => (total * weight) / denominator);
  let remaining = total - shares.reduce((sum, amount) => sum + amount, 0n);
  const order = weights
    .map((weight, index) => ({ index, remainder: (total * weight) % denominator }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  for (const { index } of order) {
    if (remaining === 0n) break;
    shares[index]! += 1n;
    remaining--;
  }
  return shares;
}

export function createOrderMoneyAllocation(
  items: readonly {
    id: string;
    quantity: number;
    unitPriceKobo: bigint;
    subtotalKobo: bigint;
  }[],
  discountKobo: bigint,
  taxKobo: bigint,
): OrderMoneyAllocation {
  if (
    !items.length ||
    items.length > 200 ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100000 ||
        item.unitPriceKobo < 0n ||
        item.subtotalKobo !== item.unitPriceKobo * BigInt(item.quantity),
    )
  )
    throw new Error("Invalid order allocation lines");
  const subtotalKobo = items.reduce((sum, item) => sum + item.subtotalKobo, 0n);
  if (discountKobo < 0n || discountKobo > subtotalKobo || taxKobo < 0n)
    throw new Error("Invalid order allocation totals");
  const discounts = allocateKobo(
    discountKobo,
    items.map((item) => item.subtotalKobo),
  );
  const taxes = allocateKobo(
    taxKobo,
    items.map((item, index) => item.subtotalKobo - discounts[index]!),
  );
  return allocationSchema.parse({
    version: 1,
    rule: "ORDER_HALF_UP_LARGEST_REMAINDER",
    currency: "NGN",
    subtotalKobo: String(subtotalKobo),
    discountKobo: String(discountKobo),
    taxKobo: String(taxKobo),
    totalKobo: String(subtotalKobo - discountKobo + taxKobo),
    lines: items.map((item, index) => ({
      orderItemId: item.id,
      quantity: item.quantity,
      subtotalKobo: String(item.subtotalKobo),
      discountKobo: String(discounts[index]),
      taxKobo: String(taxes[index]),
      totalKobo: String(item.subtotalKobo - discounts[index]! + taxes[index]!),
    })),
  });
}

/** Missing legacy snapshots stay missing; never reprice an issued historical order. */
export function readOrderMoneyAllocation(
  policySnapshot: unknown,
): OrderMoneyAllocation | null {
  if (
    !policySnapshot ||
    typeof policySnapshot !== "object" ||
    Array.isArray(policySnapshot) ||
    !("monetaryAllocation" in policySnapshot)
  )
    return null;
  const snapshot = allocationSchema.parse(policySnapshot.monetaryAllocation);
  const sums = { subtotalKobo: 0n, discountKobo: 0n, taxKobo: 0n, totalKobo: 0n };
  if (
    new Set(snapshot.lines.map((line) => line.orderItemId)).size !== snapshot.lines.length
  )
    throw new Error("Duplicate saved allocation lines");
  for (const line of snapshot.lines) {
    const subtotal = BigInt(line.subtotalKobo),
      discount = BigInt(line.discountKobo),
      tax = BigInt(line.taxKobo);
    if (
      discount > subtotal ||
      subtotal % BigInt(line.quantity) !== 0n ||
      subtotal - discount + tax !== BigInt(line.totalKobo)
    )
      throw new Error("Inconsistent saved allocation line");
    for (const key of Object.keys(sums) as (keyof typeof sums)[])
      sums[key] += BigInt(line[key]);
  }
  for (const key of Object.keys(sums) as (keyof typeof sums)[])
    if (sums[key] !== BigInt(snapshot[key]))
      throw new Error("Inconsistent saved allocation totals");
  const discounts = allocateKobo(
    BigInt(snapshot.discountKobo),
    snapshot.lines.map((line) => BigInt(line.subtotalKobo)),
  );
  const taxes = allocateKobo(
    BigInt(snapshot.taxKobo),
    snapshot.lines.map((line, index) => BigInt(line.subtotalKobo) - discounts[index]!),
  );
  if (
    snapshot.lines.some(
      (line, index) =>
        BigInt(line.discountKobo) !== discounts[index] ||
        BigInt(line.taxKobo) !== taxes[index],
    )
  )
    throw new Error("Saved allocation does not match its recorded rounding rule");
  return snapshot;
}

/** Disjoint unit ranges reconcile exactly, including successive partial refunds. */
export function allocatedUnitRange(
  line: AllocatedOrderLine,
  offset: number,
  quantity: number,
) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(quantity) ||
    offset < 0 ||
    quantity < 1 ||
    offset + quantity > line.quantity
  )
    throw new Error("Invalid allocated unit range");
  const count = BigInt(line.quantity);
  const portion = (amount: bigint) => {
    const remainder = amount % count;
    const cumulative = (units: number) =>
      (amount / count) * BigInt(units) +
      (BigInt(units) < remainder ? BigInt(units) : remainder);
    return cumulative(offset + quantity) - cumulative(offset);
  };
  const subtotalKobo = (BigInt(line.subtotalKobo) / count) * BigInt(quantity);
  const totalKobo = portion(BigInt(line.totalKobo));
  const taxKobo = portion(BigInt(line.taxKobo));
  const discountKobo = subtotalKobo + taxKobo - totalKobo;
  return { subtotalKobo, discountKobo, taxKobo, totalKobo };
}

export function assertOrderMoneyMatches(
  allocation: OrderMoneyAllocation,
  order: {
    subtotalKobo: bigint;
    discountAmountKobo: bigint;
    taxKobo: bigint;
    totalKobo: bigint;
    deliveryFeeKobo: bigint;
    items: readonly {
      id: string;
      quantity: number;
      subtotalKobo: bigint;
      unitPriceKobo: bigint;
    }[];
  },
) {
  if (
    BigInt(allocation.subtotalKobo) !== order.subtotalKobo ||
    BigInt(allocation.discountKobo) !== order.discountAmountKobo ||
    BigInt(allocation.taxKobo) !== order.taxKobo ||
    BigInt(allocation.totalKobo) !== order.totalKobo - order.deliveryFeeKobo ||
    allocation.lines.length !== order.items.length ||
    allocation.lines.some((line) => {
      const item = order.items.find((value) => value.id === line.orderItemId);
      return (
        !item ||
        item.quantity !== line.quantity ||
        item.subtotalKobo !== BigInt(line.subtotalKobo) ||
        item.unitPriceKobo * BigInt(item.quantity) !== item.subtotalKobo
      );
    })
  )
    throw new Error("Saved monetary allocation does not match the order");
}
