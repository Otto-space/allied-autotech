import { z } from "zod";
import { nairaToKobo, koboToInput } from "@/lib/format/currency-input";
import type { Promotion } from "@/lib/api/promotion-schemas";
import type { RequestBody } from "@/lib/api/contracts";
const lagosTimestamp = (value: string) =>
  `${value.length === 16 ? `${value}:00` : value}+01:00`;
const promotionDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/,
    "Choose a Lagos date and time.",
  )
  .refine(
    (value) => z.iso.datetime({ offset: true }).safeParse(lagosTimestamp(value)).success,
    "Choose a valid date and time.",
  );
const dateInput = (value?: string) =>
  value
    ? new Date(Date.parse(value) + 3600000)
        .toISOString()
        .slice(0, -1)
        .replace(/\.000$/, "")
        .replace(/:00$/, "")
    : "";
const amount = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      return BigInt(nairaToKobo(value)) <= BigInt("9999999999999999");
    } catch {
      return false;
    }
  }, "Enter a non-negative NGN amount with up to two decimal places (maximum 99,999,999,999,999.99).");
const count = (maximum: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        (/^[0-9]+$/.test(value) && Number(value) >= 1 && Number(value) <= maximum),
      `Use a whole number from 1 to ${maximum.toLocaleString("en-NG")}, or leave blank.`,
    );
export const promotionFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a promotion name.").max(160),
    code: z.string().trim().max(80),
    description: z.string().trim().max(2000),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    percentage: z.string().trim(),
    fixedAmount: amount,
    minimumOrderAmount: amount,
    maximumDiscountAmount: amount,
    usageLimit: count(10000000),
    perCustomerLimit: count(100000),
    startsAt: promotionDate,
    endsAt: promotionDate,
    isActive: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.discountType === "PERCENTAGE") {
      let valid = false;
      try {
        const points = BigInt(nairaToKobo(value.percentage));
        valid = points >= BigInt(1) && points <= BigInt(10000);
      } catch {
        /* Invalid percentage is reported on its field. */
      }
      if (!valid)
        context.addIssue({
          code: "custom",
          path: ["percentage"],
          message: "Enter a percentage from 0.01 to 100, with up to two decimal places.",
        });
    } else if (!value.fixedAmount)
      context.addIssue({
        code: "custom",
        path: ["fixedAmount"],
        message: "Enter the fixed discount amount.",
      });
    if (
      Date.parse(lagosTimestamp(value.endsAt)) <=
      Date.parse(lagosTimestamp(value.startsAt))
    )
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must be after the start.",
      });
    if (
      value.usageLimit &&
      value.perCustomerLimit &&
      Number(value.perCustomerLimit) > Number(value.usageLimit)
    )
      context.addIssue({
        code: "custom",
        path: ["perCustomerLimit"],
        message: "The per-customer limit cannot exceed the total usage limit.",
      });
  });
export type PromotionValues = z.infer<typeof promotionFormSchema>;
export function promotionDefaults(item?: Promotion): PromotionValues {
  const inputMoney = (value: string | null | undefined) =>
    value == null ? "" : koboToInput(value);
  return {
    name: item?.name ?? "",
    code: item?.code ?? "",
    description: item?.description ?? "",
    discountType: item?.discountType ?? "PERCENTAGE",
    percentage:
      item?.percentageBasisPoints == null
        ? ""
        : koboToInput(String(item.percentageBasisPoints)),
    fixedAmount: inputMoney(item?.fixedAmountKobo),
    minimumOrderAmount: inputMoney(item?.minimumOrderAmountKobo),
    maximumDiscountAmount: inputMoney(item?.maximumDiscountAmountKobo),
    usageLimit: item?.usageLimit?.toString() ?? "",
    perCustomerLimit: item?.perCustomerLimit?.toString() ?? "",
    startsAt: dateInput(item?.startsAt),
    endsAt: dateInput(item?.endsAt),
    isActive: item?.isActive ?? false,
  };
}
export function promotionBody(
  value: PromotionValues,
  existing?: Promotion,
): RequestBody<"/admin/promotions", "post"> {
  const timestamp = (value: string, original?: string) =>
    original && dateInput(original) === value ? original : lagosTimestamp(value);
  return {
    name: value.name,
    code: value.code ? value.code.toUpperCase() : null,
    description: value.description || null,
    discountType: value.discountType,
    percentageBasisPoints:
      value.discountType === "PERCENTAGE" ? Number(nairaToKobo(value.percentage)) : null,
    fixedAmountKobo:
      value.discountType === "FIXED_AMOUNT" ? nairaToKobo(value.fixedAmount) : null,
    minimumOrderAmountKobo: value.minimumOrderAmount
      ? nairaToKobo(value.minimumOrderAmount)
      : null,
    maximumDiscountAmountKobo: value.maximumDiscountAmount
      ? nairaToKobo(value.maximumDiscountAmount)
      : null,
    usageLimit: value.usageLimit ? Number(value.usageLimit) : null,
    perCustomerLimit: value.perCustomerLimit ? Number(value.perCustomerLimit) : null,
    startsAt: timestamp(value.startsAt, existing?.startsAt),
    endsAt: timestamp(value.endsAt, existing?.endsAt),
    isActive: value.isActive,
  };
}
