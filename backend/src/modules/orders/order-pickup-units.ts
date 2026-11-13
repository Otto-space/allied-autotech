import { z } from "zod";
import { orderConflict } from "./orders.errors.js";
import { pickupLinesSchema, type PickupLine } from "./order-pickup.engine.js";
import {
  affectedUnitRangeSchema,
  type AffectedUnitRange,
} from "./order-supply-exception.engine.js";

// Engineering evidence bound; never expand one row per physical unit.
const evidence = z.array(affectedUnitRangeSchema).max(20000);
export type PickupUnitHistory = { lines: unknown; unitRanges?: unknown };
function invalid(): never {
  throw orderConflict(
    "Physical unit history needs authorised review before collection or supply resolution.",
  );
}
function lines(value: unknown) {
  const result = pickupLinesSchema.safeParse(value);
  if (!result.success) invalid();
  return result.data;
}
function ranges(value: unknown): AffectedUnitRange[] {
  const result = evidence.safeParse(value);
  if (!result.success) invalid();
  const sorted = [...result.data].sort(
    (a, b) => a.orderItemId.localeCompare(b.orderItemId) || a.offset - b.offset,
  );
  const merged: AffectedUnitRange[] = [];
  for (const row of sorted) {
    const previous = merged.at(-1);
    if (
      previous?.orderItemId === row.orderItemId &&
      previous.offset + previous.quantity > row.offset
    )
      invalid();
    if (
      previous?.orderItemId === row.orderItemId &&
      previous.offset + previous.quantity === row.offset
    )
      previous.quantity += row.quantity;
    else merged.push({ ...row });
  }
  return merged;
}
function bounded(original: PickupLine[], value: unknown) {
  const parsed = ranges(value),
    quantities = new Map(original.map((row) => [row.orderItemId, row.quantity]));
  if (
    parsed.some(
      (row) => row.offset + row.quantity > (quantities.get(row.orderItemId) ?? 0),
    )
  )
    invalid();
  return parsed;
}
/** Interval subtraction retains actual positions and never changes past handover. */
export function pickupUnitRangeDifference(source: unknown, removed: unknown) {
  const base = ranges(source),
    blocked = ranges(removed);
  return base.flatMap((row) => {
    let fragments = [{ ...row }];
    for (const cut of blocked.filter((cut) => cut.orderItemId === row.orderItemId))
      fragments = fragments.flatMap((part) => {
        const end = part.offset + part.quantity,
          cutEnd = cut.offset + cut.quantity;
        if (cut.offset >= end || cutEnd <= part.offset) return [part];
        return [
          { ...part, quantity: Math.max(0, cut.offset - part.offset) },
          {
            ...part,
            offset: Math.max(part.offset, cutEnd),
            quantity: Math.max(0, end - Math.max(part.offset, cutEnd)),
          },
        ].filter((part) => part.quantity > 0);
      });
    return fragments;
  });
}
function originalRanges(original: PickupLine[]) {
  return original.map((row) => ({ ...row, offset: 0 }));
}
function select(available: AffectedUnitRange[], requested: PickupLine[]) {
  const selected: AffectedUnitRange[] = [];
  for (const line of requested) {
    let needed = line.quantity;
    for (const part of available.filter(
      (part) => part.orderItemId === line.orderItemId,
    )) {
      if (!needed) break;
      const quantity = Math.min(needed, part.quantity);
      selected.push({ ...part, quantity });
      needed -= quantity;
    }
    if (needed) invalid();
  }
  return ranges(selected);
}
/** Read in immutable orderVersion/id order. Historical quantity-only rows consume
 * the earliest then-available units; do not reinterpret them using later refunds. */
export function collectedPickupUnitRanges(
  orderLines: unknown,
  history: readonly PickupUnitHistory[],
) {
  const original = lines(orderLines);
  let collected: AffectedUnitRange[] = [];
  for (const row of history) {
    const actual = lines(row.lines);
    const selected =
      row.unitRanges === null || row.unitRanges === undefined
        ? select(pickupUnitRangeDifference(originalRanges(original), collected), actual)
        : bounded(original, row.unitRanges);
    const totals = new Map<string, number>();
    for (const range of selected)
      totals.set(
        range.orderItemId,
        (totals.get(range.orderItemId) ?? 0) + range.quantity,
      );
    if (
      totals.size !== actual.length ||
      actual.some((line) => totals.get(line.orderItemId) !== line.quantity)
    )
      invalid();
    collected = bounded(original, [...collected, ...selected]);
  }
  return collected;
}
export function remainingPickupUnitRanges(
  orderLines: unknown,
  history: readonly PickupUnitHistory[],
  excluded: unknown = [],
) {
  const original = lines(orderLines),
    collected = collectedPickupUnitRanges(original, history),
    removed = bounded(original, excluded);
  // Exclusion is for unfulfilled goods only; wrong goods already handed over must
  // retain that physical event in their separate financial/case resolution.
  bounded(original, [...collected, ...removed]);
  return pickupUnitRangeDifference(originalRanges(original), [...collected, ...removed]);
}
export function planPickupUnitRanges(
  orderLines: unknown,
  history: readonly PickupUnitHistory[],
  requested: unknown,
  excluded: unknown = [],
) {
  return select(
    remainingPickupUnitRanges(orderLines, history, excluded),
    lines(requested),
  );
}

/** An actual refunded unit is either unfulfilled or previously handed over.
 * Preserve both dispositions; neither is evidence of stock being returned. */
export function supplyResolvedUnitPartition(
  orderLines: unknown,
  history: readonly PickupUnitHistory[],
  affectedLines: unknown,
) {
  const original = lines(orderLines),
    affected = bounded(original, affectedLines),
    collected = collectedPickupUnitRanges(original, history),
    unfulfilledLines = pickupUnitRangeDifference(affected, collected);
  return {
    unfulfilledLines,
    previouslyHandedLines: pickupUnitRangeDifference(affected, unfulfilledLines),
  };
}
