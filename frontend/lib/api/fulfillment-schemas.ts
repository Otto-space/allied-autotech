import { z } from "zod";
import { business } from "@/lib/business";
const isPlainText = (value: string) =>
  [...value].every(
    (character) =>
      (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
  );
const areaText = (max: number) =>
  z
    .string()
    .trim()
    .min(2)
    .max(max)
    .refine(isPlainText, "Use plain text without control characters.");
export const deliveryZoneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  label: areaText(160),
  city: areaText(120),
  state: areaText(120),
  feeKobo: z.string().regex(/^\d{1,15}$/),
});
export const deliverySettingsSchema = z
  .object({
    collectionEnabled: z.literal(true),
    collectionAddress: z.literal(business.address),
    zones: z.array(deliveryZoneSchema).min(1).max(100),
  })
  .refine(
    (value) => new Set(value.zones.map((zone) => zone.id)).size === value.zones.length,
    "Zone references must be unique.",
  );
export const fulfillmentOptionsSchema = z
  .object({
    serverTime: z.iso.datetime({ offset: true }),
    currency: z.literal("NGN"),
    checkoutEnabled: z.boolean(),
    collection: z.object({
      enabled: z.literal(true),
      address: z.literal(business.address),
    }),
    delivery: z.discriminatedUnion("enabled", [
      z.object({
        enabled: z.literal(false),
        policyVersion: z.null(),
        zones: z.array(z.never()).max(0),
      }),
      z.object({
        enabled: z.literal(true),
        policyVersion: z.number().int().positive(),
        zones: z.array(deliveryZoneSchema).min(1).max(100),
      }),
    ]),
  })
  .refine(
    (value) =>
      new Set(value.delivery.zones.map((zone) => zone.id)).size ===
      value.delivery.zones.length,
    "Delivery areas must be distinct.",
  );
export const parseFulfillmentOptions = (value: unknown) =>
  fulfillmentOptionsSchema.parse(value);
const deliveryText = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Complete this field.")
    .max(max)
    .refine(isPlainText, "Use plain text without control characters.");
export const deliveryContactSchema = z.object({
  name: deliveryText(160),
  phone: deliveryText(32),
  address: deliveryText(500),
});
