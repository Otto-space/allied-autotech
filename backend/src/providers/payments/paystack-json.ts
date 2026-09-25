import { z } from "zod";

export const paystackIdentifier = z.union([
  z.string().min(1).max(160).regex(/^\S+$/u),
  z.number().int().safe().positive(),
]);

/** Node 24 supplies the original numeric token to the JSON reviver. Paystack
 * IDs are uint64, so converting an already-rounded Number to String is unsafe.
 * Preserve only ID tokens; amounts keep their existing strict numeric checks. */
export function parsePaystackJson(text: string): unknown {
  return JSON.parse(
    text,
    (key: string, value: unknown, context?: { source?: string }): unknown => {
      if (
        key === "id" &&
        typeof value === "number" &&
        context?.source !== undefined &&
        /^[1-9]\d*$/u.test(context.source)
      )
        return context.source;
      return value;
    },
  );
}
