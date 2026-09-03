import { z } from "zod";

const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      "Contains invalid characters",
    );

const name = cleanText(80).regex(
  /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u,
  "Contains unsupported characters",
);
const phone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number");
const nullableText = (maximum: number) => cleanText(maximum).nullable();

export const customerProfileUpdateBodySchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    phone: phone.optional(),
    address: nullableText(250).optional(),
    city: nullableText(100).optional(),
    state: nullableText(100).optional(),
    country: z.literal("Nigeria").optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

const vehicleFields = {
  make: cleanText(80),
  model: cleanText(80),
  year: z.coerce
    .number()
    .int()
    .min(1886)
    .max(new Date().getUTCFullYear() + 1),
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9 -]{1,19}$/)
    .nullable()
    .optional(),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Enter a valid VIN")
    .nullable()
    .optional(),
  color: nullableText(50).optional(),
  mileageKm: z.coerce.number().int().min(0).max(5_000_000).nullable().optional(),
} as const;

export const customerVehicleCreateBodySchema = z.object(vehicleFields).strict();
export const customerVehicleUpdateBodySchema = z
  .object({
    make: vehicleFields.make.optional(),
    model: vehicleFields.model.optional(),
    year: vehicleFields.year.optional(),
    registrationNumber: vehicleFields.registrationNumber,
    vin: vehicleFields.vin,
    color: vehicleFields.color,
    mileageKm: vehicleFields.mileageKm,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const customerVehicleParamsSchema = z.object({ vehicleId: z.uuid() }).strict();
export const customerVehicleListQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const customerEmptyQuerySchema = z.object({}).strict().default({});
export const customerEmptyBodySchema = z.object({}).strict().default({});

export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateBodySchema>;
export type CustomerVehicleCreateInput = z.infer<typeof customerVehicleCreateBodySchema>;
export type CustomerVehicleUpdateInput = z.infer<typeof customerVehicleUpdateBodySchema>;
export type CustomerVehicleListQuery = z.infer<typeof customerVehicleListQuerySchema>;
