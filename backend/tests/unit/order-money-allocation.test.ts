import { expect, it } from "vitest";
import {
  allocateKobo,
  allocatedUnitRange,
  createOrderMoneyAllocation,
  readOrderMoneyAllocation,
} from "../../src/modules/orders/order-money-allocation.js";
import { basisPoints } from "../../src/modules/policies/policy-money.js";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const item = (id = first, quantity = 1, unitPriceKobo = 10n) => ({
  id,
  quantity,
  unitPriceKobo,
  subtotalKobo: unitPriceKobo * BigInt(quantity),
});

it("allocates indivisible kobo by largest remainder and saved line order", () => {
  expect(allocateKobo(2n, [1n, 1n, 1n])).toEqual([1n, 1n, 0n]);
  expect(allocateKobo(7n, [1n, 2n, 3n])).toEqual([1n, 2n, 4n]);
  expect(allocateKobo(2n, [0n, 1n, 1n])).toEqual([0n, 1n, 1n]);
});
it("handles zero totals without inventing a basis and rejects invalid amounts", () => {
  expect(allocateKobo(0n, [0n, 0n])).toEqual([0n, 0n]);
  expect(allocateKobo(0n, [])).toEqual([]);
  for (const operation of [
    () => allocateKobo(-1n, [1n]),
    () => allocateKobo(1n, [-1n]),
    () => allocateKobo(1n, [0n]),
    () => allocateKobo(1n, []),
  ])
    expect(operation).toThrow();
});
it("keeps exact amounts beyond floating-point integer precision", () => {
  const value = 9007199254740993n;
  expect(allocateKobo(value, [1n, 1n])).toEqual([4503599627370497n, 4503599627370496n]);
});
it("saves discounts before VAT and reconciles every issued line to the aggregate amounts", () => {
  const snapshot = createOrderMoneyAllocation([item(), item(second)], 3n, 1n);
  expect(snapshot).toMatchObject({
    version: 1,
    subtotalKobo: "20",
    discountKobo: "3",
    taxKobo: "1",
    totalKobo: "18",
  });
  expect(snapshot.lines).toEqual([
    {
      orderItemId: first,
      quantity: 1,
      subtotalKobo: "10",
      discountKobo: "2",
      taxKobo: "0",
      totalKobo: "8",
    },
    {
      orderItemId: second,
      quantity: 1,
      subtotalKobo: "10",
      discountKobo: "1",
      taxKobo: "1",
      totalKobo: "10",
    },
  ]);
  expect(
    readOrderMoneyAllocation(
      JSON.parse(JSON.stringify({ monetaryAllocation: snapshot })),
    ),
  ).toEqual(snapshot);
});
it("preserves package quantities and their saved order instead of treating each line as one item", () => {
  const snapshot = createOrderMoneyAllocation([item(second, 5), item(first, 2)], 3n, 5n);
  expect(
    snapshot.lines.map((line) => [line.orderItemId, line.quantity, line.subtotalKobo]),
  ).toEqual([
    [second, 5, "50"],
    [first, 2, "20"],
  ]);
});
it("supports a fully discounted order without allocating tax to a zero basis", () => {
  const snapshot = createOrderMoneyAllocation([item(), item(second)], 20n, 0n);
  expect(snapshot.lines.map((line) => line.totalKobo)).toEqual(["0", "0"]);
  expect(() => createOrderMoneyAllocation([item()], 10n, 1n)).toThrow();
});
it("does not recalculate historical issued records without the new snapshot", () => {
  for (const source of [
    null,
    {},
    { finance: { version: 1, settings: { rounding: "legacy" } } },
  ])
    expect(readOrderMoneyAllocation(source)).toBeNull();
});
it("rejects malformed, inconsistent and duplicate saved financial data", () => {
  const snapshot = createOrderMoneyAllocation([item(), item(second)], 3n, 1n);
  const invalid = [
    { ...snapshot, version: 2 },
    { ...snapshot, totalKobo: "19" },
    { ...snapshot, lines: [snapshot.lines[0], snapshot.lines[0]] },
    {
      ...snapshot,
      lines: [{ ...snapshot.lines[0], totalKobo: "99" }, snapshot.lines[1]],
    },
  ];
  for (const monetaryAllocation of invalid)
    expect(() => readOrderMoneyAllocation({ monetaryAllocation })).toThrow();
});
it("rejects mismatched prices, duplicate lines and invalid package quantities before saving", () => {
  for (const items of [
    [],
    [item(), item()],
    [item(first, 0)],
    [{ ...item(), quantity: 1.5 }],
    [{ ...item(), subtotalKobo: 11n }],
  ])
    expect(() => createOrderMoneyAllocation(items, 0n, 0n)).toThrow();
  expect(() => createOrderMoneyAllocation([item()], 11n, 0n)).toThrow();
});
it("allocates partial refund remainders to the first saved units and never counts a remainder twice", () => {
  const line = createOrderMoneyAllocation([item(first, 3, 1n)], 1n, 0n).lines[0]!;
  expect(
    [0, 1, 2].map((offset) => allocatedUnitRange(line, offset, 1).totalKobo),
  ).toEqual([1n, 1n, 0n]);
  expect(allocatedUnitRange(line, 0, 3)).toEqual({
    subtotalKobo: 3n,
    discountKobo: 1n,
    taxKobo: 0n,
    totalKobo: 2n,
  });
  expect(
    allocatedUnitRange(line, 0, 1).totalKobo + allocatedUnitRange(line, 1, 2).totalKobo,
  ).toBe(2n);
});
it("conserves net, VAT and discount through successive partial quantities across rounding boundaries", () => {
  for (let quantity = 1; quantity <= 12; quantity++)
    for (let price = 1n; price <= 8n; price++) {
      const gross = price * BigInt(quantity);
      for (let discount = 0n; discount <= gross; discount++) {
        const tax = basisPoints(gross - discount, 750);
        const line = createOrderMoneyAllocation(
          [item(first, quantity, price)],
          discount,
          tax,
        ).lines[0]!;
        const sums = { subtotalKobo: 0n, discountKobo: 0n, taxKobo: 0n, totalKobo: 0n };
        for (let offset = 0; offset < quantity; offset++) {
          const part = allocatedUnitRange(line, offset, 1);
          expect(part.discountKobo).toBeGreaterThanOrEqual(0n);
          expect(part.taxKobo).toBeLessThanOrEqual(part.totalKobo);
          for (const key of Object.keys(sums) as (keyof typeof sums)[])
            sums[key] += part[key];
        }
        expect(sums).toEqual({
          subtotalKobo: gross,
          discountKobo: discount,
          taxKobo: tax,
          totalKobo: gross - discount + tax,
        });
      }
    }
});
it("rejects quantities outside the saved line and non-integer ranges", () => {
  const line = createOrderMoneyAllocation([item(first, 3)], 0n, 2n).lines[0]!;
  for (const [offset, quantity] of [
    [-1, 1],
    [0, 0],
    [0, 4],
    [2, 2],
    [0.5, 1],
    [0, 1.5],
  ])
    expect(() => allocatedUnitRange(line, offset!, quantity!)).toThrow();
});

it("preserves the existing 200-line checkout capacity", () => {
  const items = Array.from({ length: 200 }, (_, index) =>
    item(`33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`, 1, 1n),
  );
  const snapshot = createOrderMoneyAllocation(items, 0n, 15n);
  expect(snapshot.lines).toHaveLength(200);
  expect(readOrderMoneyAllocation({ monetaryAllocation: snapshot })!.totalKobo).toBe(
    "215",
  );
  expect(() => createOrderMoneyAllocation([...items, item()], 0n, 15n)).toThrow();
});
