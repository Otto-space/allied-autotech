import { z } from "zod";
const name = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80, "Use up to 80 characters.")
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u,
    "Use letters, spaces, apostrophes or hyphens.",
  );
export const registrationFields = z.object({
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(32, "Use up to 32 characters.")
    .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z
    .string()
    .min(12, "Use a unique passphrase of at least 12 characters.")
    .max(128, "Use up to 128 characters."),
});
export type RegistrationField = keyof z.infer<typeof registrationFields>;
