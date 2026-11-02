import { expect, it } from "vitest";
import { positiveNaira } from "@/lib/forms/vehicle-record";
import { nairaToKobo } from "@/lib/format/currency-input";

it("normalizes grouped vehicle amounts exactly before review and kobo conversion", () => {
  for (const [input, expected] of [
    ["55,000,000.00", "5500000000"],
    ["55000000.00", "5500000000"],
    [" 1,234.50 ", "123450"],
    ["99,999,999,999,999.99", "9999999999999999"],
  ])
    expect(nairaToKobo(positiveNaira.parse(input))).toBe(expected);
});

it("rejects ambiguous grouping, zero, excess precision and oversized amounts", () => {
  for (const value of [
    "55000,000.00",
    "5,50,000",
    "55,,000",
    "0,000.00",
    "0",
    "-10",
    "1.234",
    "100,000,000,000,000.00",
    "₦1,000",
    "1e6",
  ])
    expect(positiveNaira.safeParse(value).success).toBe(false);
});
