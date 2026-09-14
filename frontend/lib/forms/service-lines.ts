import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
import { nairaToKobo } from "@/lib/format/currency-input";
export const paragraph = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Use one paragraph without control characters.",
    );
export const nairaInput = z
  .string()
  .trim()
  .regex(
    /^\d{1,14}(?:\.\d{1,2})?$/,
    "Enter a valid NGN amount with up to two decimal places.",
  );
export const serviceLineInput = z
  .object({
    type: z.enum(["PART", "LABOUR", "FEE"]),
    productId: z.string(),
    productLabel: z.string(),
    description: paragraph(500),
    quantity: z.number().int().min(1).max(10000),
    unitPrice: z.string(),
  })
  .superRefine((line, context) => {
    if (line.type === "PART") {
      if (!z.string().uuid().safeParse(line.productId).success)
        context.addIssue({
          code: "custom",
          path: ["productId"],
          message: "Choose a catalogue part.",
        });
    } else {
      if (!line.description)
        context.addIssue({
          code: "custom",
          path: ["description"],
          message: "Enter a description.",
        });
      const amount = nairaInput.safeParse(line.unitPrice);
      if (!amount.success)
        context.addIssue({
          code: "custom",
          path: ["unitPrice"],
          message: amount.error.issues[0].message,
        });
    }
  });
export const serviceLinesFormSchema = z.object({
  items: z.array(serviceLineInput).min(1, "Add at least one line item.").max(100),
  tax: nairaInput,
  notes: paragraph(4000),
  expiresAt: z.string(),
});
export type ServiceLinesForm = z.infer<typeof serviceLinesFormSchema>;
export const emptyServiceLine = (): ServiceLinesForm["items"][number] => ({
  type: "LABOUR",
  productId: "",
  productLabel: "",
  description: "",
  quantity: 1,
  unitPrice: "",
});
export function toServiceLines(
  items: ServiceLinesForm["items"],
): RequestBody<"/staff/bookings/{bookingId}/quotes", "post">["items"] {
  return items.map((line) =>
    line.type === "PART"
      ? {
          type: "PART",
          productId: line.productId,
          quantity: line.quantity,
          ...(line.description ? { description: line.description } : {}),
        }
      : {
          type: line.type,
          description: line.description,
          quantity: line.quantity,
          unitPriceKobo: nairaToKobo(line.unitPrice),
        },
  );
}
