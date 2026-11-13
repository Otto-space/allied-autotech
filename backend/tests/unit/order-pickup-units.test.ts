import { describe, it, expect } from "vitest";
import {
  collectedPickupUnitRanges,
  pickupUnitRangeDifference,
  remainingPickupUnitRanges,
  planPickupUnitRanges,
} from "../../src/modules/orders/order-pickup-units.js";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const original = [{ orderItemId: id, quantity: 5 }],
  part = (offset: number, quantity: number) => ({ orderItemId: id, offset, quantity });
describe("immutable physical unit positions", () => {
  it("retains chronological quantity-only history before and between explicit handovers", () => {
    const history = [
      { lines: [{ orderItemId: id, quantity: 1 }], unitRanges: null },
      { lines: [{ orderItemId: id, quantity: 1 }], unitRanges: [part(1, 1)] },
      { lines: [{ orderItemId: id, quantity: 1 }] },
    ];
    expect(collectedPickupUnitRanges(original, history)).toEqual([part(0, 3)]);
    expect(
      planPickupUnitRanges(original, history, [{ orderItemId: id, quantity: 2 }]),
    ).toEqual([part(3, 2)]);
  });
  it("keeps gaps from excluded unfulfilled goods without counting them as collection", () => {
    const history = [
      { lines: [{ orderItemId: id, quantity: 1 }], unitRanges: [part(0, 1)] },
    ];
    expect(remainingPickupUnitRanges(original, history, [part(2, 1)])).toEqual([
      part(1, 1),
      part(3, 2),
    ]);
    expect(
      planPickupUnitRanges(
        original,
        history,
        [{ orderItemId: id, quantity: 3 }],
        [part(2, 1)],
      ),
    ).toEqual([part(1, 1), part(3, 2)]);
    expect(collectedPickupUnitRanges(original, history)).toEqual([part(0, 1)]);
  });
  it("never reinterprets an earlier legacy handover after a later exclusion", () => {
    const history = [{ lines: [{ orderItemId: id, quantity: 2 }], unitRanges: null }];
    expect(() => remainingPickupUnitRanges(original, history, [part(1, 1)])).toThrow();
    expect(
      pickupUnitRangeDifference(
        [part(0, 4)],
        collectedPickupUnitRanges(original, history),
      ),
    ).toEqual([part(2, 2)]);
  });
  it("rejects quantity, identity, overlap and range corruption instead of inventing a remainder", () => {
    for (const unitRanges of [
      [part(0, 2)],
      [part(5, 1)],
      [{ ...part(0, 1), orderItemId: other }],
      [part(0, 1), part(0, 1)],
    ])
      expect(() =>
        collectedPickupUnitRanges(original, [
          { lines: [{ orderItemId: id, quantity: 1 }], unitRanges },
        ]),
      ).toThrow();
    expect(() =>
      collectedPickupUnitRanges(original, [
        { lines: [{ orderItemId: id, quantity: 4 }] },
        { lines: [{ orderItemId: id, quantity: 2 }] },
      ]),
    ).toThrow();
    expect(() =>
      collectedPickupUnitRanges(original, [
        { lines: [{ orderItemId: id, quantity: 1 }], unitRanges: [] },
      ]),
    ).toThrow();
  });
  it("does not allow a selected quantity to cross excluded or already handed-over units", () => {
    const history = [
      { lines: [{ orderItemId: id, quantity: 1 }], unitRanges: [part(0, 1)] },
    ];
    expect(() =>
      planPickupUnitRanges(
        original,
        history,
        [{ orderItemId: id, quantity: 4 }],
        [part(2, 1)],
      ),
    ).toThrow();
    expect(() =>
      planPickupUnitRanges(original, history, [{ orderItemId: other, quantity: 1 }]),
    ).toThrow();
  });
  it("uses interval arithmetic for maximum quantities without materialising individual units", () => {
    const large = [{ orderItemId: id, quantity: 100000 }];
    expect(
      planPickupUnitRanges(
        large,
        [],
        [{ orderItemId: id, quantity: 1000 }],
        [part(500, 99000)],
      ),
    ).toEqual([part(0, 500), part(99500, 500)]);
  });
  it("subtracts only the overlapping part while retaining unrelated product identities", () => {
    expect(
      pickupUnitRangeDifference(
        [part(0, 5), { orderItemId: other, offset: 0, quantity: 2 }],
        [part(1, 3)],
      ),
    ).toEqual([part(0, 1), part(4, 1), { orderItemId: other, offset: 0, quantity: 2 }]);
  });
});
